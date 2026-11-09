
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CategoriesService } from '../../services/categories.service';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { TmdbService, CatalogItem } from '../../services/tmdb.service';

import {
  CommunityCatalogService,
  CommunityCatalogItem,
} from '../../services/community-catalog.service';

import {
  COMMUNITY_CATEGORIES,
  CommunityCategory,
  CommunityCategoryOption,
} from '../../models/community-catalog.model';

@Component({
  selector: 'app-anadir-ficha',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './anadir-ficha.html',
  styleUrl: './anadir-ficha.css',
})
export class AnadirFicha implements OnInit, OnDestroy {

  categories: CommunityCategoryOption[] = [];
  loadingCategories = true;

  category: CommunityCategory = 'movie';

  title = '';
  originalTitle = '';
  year: number | null = null;
  overview = '';
  country = '';
  genresText = '';

  details: Record<string, string | number | null> = {};

  posterFile: File | null = null;
  posterPreview: string | null = null;

  tmdbResults: CatalogItem[] = [];
  communityMatches: CommunityCatalogItem[] = [];
  selectedTmdb: CatalogItem | null = null;

  checking = false;
  saving = false;

  error = '';
  notice = '';

  showDuplicate = false;
  duplicateItem: CommunityCatalogItem | null = null;

  showSimilar = false;
  confirmedDifferent = false;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchRequest = 0;

  constructor(
    public tmdb: TmdbService,
    private community: CommunityCatalogService,
    private router: Router,
    private categoriesService: CategoriesService,
    private preferencesService: UserPreferencesService,
    private cdr: ChangeDetectorRef,
  ) {}

  // CARGAR LAS CATEGORÍAS ELEGIDAS POR EL USUARIO
  async ngOnInit(): Promise<void> {
    this.loadingCategories = true;
    this.error = '';

    try {
      const [available, selectedIds] = await Promise.all([
        this.categoriesService.getActiveCategories(),
        this.preferencesService.getMyPreferences(),
      ]);

      const selected = available.filter(category =>
        selectedIds.includes(Number(category.id))
      );

      const selectedSlugs = selected.map(category =>
        this.normalizeCategory(`${category.slug} ${category.name}`)
      );

      this.categories = COMMUNITY_CATEGORIES.filter(option =>
        selectedSlugs.some(slug =>
          this.matchesPreference(option.id, slug)
        )
      );

      if (this.categories.length > 0) {
        this.category = this.categories[0].id;
      } else {
        this.error =
          'No tienes categorías seleccionadas. Ve a tu perfil y elige tus intereses para poder crear fichas.';
      }

    } catch (error) {
      console.error('Error cargando las categorías personales:', error);

      this.error =
        'No hemos podido cargar tus categorías. Recarga la página e inténtalo de nuevo.';

    } finally {
      this.loadingCategories = false;

      // Actualizar la vista al terminar la consulta.
      this.cdr.detectChanges();
    }
  }

  private normalizeCategory(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private matchesPreference(
    id: CommunityCategory,
    slug: string
  ): boolean {

    const aliases: Record<CommunityCategory, string[]> = {
      movie: ['peliculasserie', 'peliculas', 'cine', 'series'],
      tv: ['peliculasserie', 'peliculas', 'cine', 'series'],
      book: ['libros', 'lectura', 'book'],
      music: ['musica', 'music'],
      skincare: ['skincare', 'belleza', 'beauty'],
      fashion: ['modaestilo', 'moda', 'estilo', 'fashion'],
      travel: ['viajes', 'viaje', 'travel', 'turismo'],
      other: ['otros', 'otro', 'other'],
    };

    return aliases[id].some(alias => slug.includes(alias));
  }

  // ICONOS DE BANGTAN OLÉ
  getCategoryFeatherIcon(id: CommunityCategory): string {

    const icons: Record<CommunityCategory, string> = {
      movie: 'bo-film',
      tv: 'bo-film',
      book: 'bo-book-open',
      music: 'bo-music',
      skincare: 'bo-star',
      fashion: 'bo-image',
      travel: 'bo-compass',
      other: 'bo-folder',
    };

    return icons[id];
  }

  get selectedCategory(): CommunityCategoryOption {
    return (
      this.categories.find(x => x.id === this.category) ??
      COMMUNITY_CATEGORIES.find(x => x.id === this.category)!
    );
  }

  get usesTmdb(): boolean {
    return this.category === 'movie' || this.category === 'tv';
  }

  get previewTitle(): string {
    return this.title.trim() || 'Tu nueva ficha';
  }

  get previewSubtitle(): string {
    return [
      this.year ? String(this.year) : '',
      this.selectedCategory.label,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  // CAMBIAR CATEGORÍA
  selectCategory(category: CommunityCategory): void {

    if (!this.categories.some(item => item.id === category)) {
      return;
    }

    if (this.category === category) return;

    this.category = category;
    this.details = {};

    this.selectedTmdb = null;
    this.tmdbResults = [];
    this.communityMatches = [];

    this.showSimilar = false;
    this.showDuplicate = false;
    this.confirmedDifferent = false;

    this.notice = '';
    this.error = '';

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.originalTitle = '';
    this.year = null;
  }

  // BÚSQUEDA DE TÍTULOS
  onTitleChange(): void {

    this.error = '';
    this.notice = '';
    this.showSimilar = false;
    this.confirmedDifferent = false;

    this.selectedTmdb = null;

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    const value = this.title.trim();

    if (!this.usesTmdb || value.length < 2) {
      this.tmdbResults = [];
      this.communityMatches = [];
      return;
    }

    this.searchTimer = setTimeout(() => {
      void this.checkMatches(value);
    }, 450);
  }

  async checkMatches(value = this.title.trim()): Promise<void> {

    if (!this.usesTmdb || value.length < 2) return;

    const request = ++this.searchRequest;
    this.checking = true;

    try {

      const [tmdbResults, communityMatches] = await Promise.all([
        this.tmdb.search(
          value,
          this.category as 'movie' | 'tv'
        ).catch(() => [] as CatalogItem[]),

        this.community.findMatches(
          value,
          this.category as 'movie' | 'tv'
        ),
      ]);

      if (request !== this.searchRequest) return;

      this.tmdbResults = tmdbResults.slice(0, 8);
      this.communityMatches = communityMatches;

      const exact = communityMatches.find(item =>
        this.normalize(item.title) === this.normalize(value) &&
        (item.release_year ?? 0) === (this.year ?? 0)
      );

      if (exact) {
        this.duplicateItem = exact;
        this.showDuplicate = true;

      } else if (communityMatches.length) {
        this.showSimilar = true;
        this.confirmedDifferent = false;
      }

    } catch (error: any) {
      this.error =
        error?.message || 'No se han podido comprobar las coincidencias.';

    } finally {
      if (request === this.searchRequest) {
        this.checking = false;
      }
    }
  }

  // SELECCIONAR RESULTADO DE TMDB
  chooseTmdb(item: CatalogItem): void {

    this.selectedTmdb = item;

    this.title = item.title || item.name || this.title;
    this.originalTitle = item.title || item.name || '';

    const date = item.release_date || item.first_air_date;

    this.year = date ? Number(date.slice(0, 4)) : null;
    this.overview = item.overview || '';

    this.notice = 'Datos de TMDB añadidos. Puedes editarlos.';
  }

  // SUBIR PORTADA
  onPosterSelected(event: Event): void {

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.error = '';

    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error = 'Elige una imagen JPG, PNG o WEBP.';
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.error = 'La imagen no puede superar los 5 MB.';
      input.value = '';
      return;
    }

    if (this.posterPreview) {
      URL.revokeObjectURL(this.posterPreview);
    }

    this.posterFile = file;
    this.posterPreview = URL.createObjectURL(file);
  }

  removePoster(): void {

    if (this.posterPreview) {
      URL.revokeObjectURL(this.posterPreview);
    }

    this.posterPreview = null;
    this.posterFile = null;
  }

  confirmDifferent(): void {
    this.confirmedDifferent = true;
    this.showSimilar = false;
  }

  openExisting(): void {
    if (this.duplicateItem) {
      void this.router.navigate([
        '/ficha-comunidad',
        this.duplicateItem.id,
      ]);
    }
  }

  // GUARDAR FICHA
  async save(): Promise<void> {

    this.error = '';

    if (!this.categories.some(item => item.id === this.category)) {
      this.error = 'Selecciona una de tus categorías disponibles.';
      return;
    }

    if (!this.title.trim()) {
      this.error = 'Escribe un título antes de continuar.';
      return;
    }

    const missing = this.selectedCategory.fields
      .filter(field => field.required)
      .some(field =>
        !String(this.details[field.key] ?? '').trim()
      );

    if (missing) {
      this.error =
        'Completa los campos obligatorios de esta categoría.';
      return;
    }

    if (
      this.usesTmdb &&
      this.communityMatches.length &&
      !this.confirmedDifferent &&
      !this.communityMatches.some(item =>
        this.normalize(item.title) === this.normalize(this.title) &&
        (item.release_year ?? 0) === (this.year ?? 0)
      )
    ) {
      this.showSimilar = true;
      return;
    }

    this.saving = true;

    try {

      const item = await this.community.create({
        category: this.category,
        title: this.title,
        original_title: this.originalTitle || null,
        release_year: this.year,
        overview: this.overview,

        country:
          this.country ||
          (this.category === 'travel'
            ? String(this.details['country'] ?? '')
            : ''),

        genres: this.genresText
          .split(',')
          .map(value => value.trim())
          .filter(Boolean),

        tmdb_id: this.selectedTmdb?.id ?? null,
        poster: this.posterFile,
        details: this.details,
      });

      await this.router.navigate([
        '/ficha-comunidad',
        item.id,
      ]);

    } catch (error: any) {

      const message =
        error?.message || 'No se ha podido publicar la ficha.';

      if (message.startsWith('DUPLICATE:')) {
        await this.router.navigate([
          '/ficha-comunidad',
          message.split(':')[1],
        ]);
      } else {
        this.error = message;
      }

    } finally {
      this.saving = false;
    }
  }

  ngOnDestroy(): void {

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    if (this.posterPreview) {
      URL.revokeObjectURL(this.posterPreview);
    }
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase();
  }
}
