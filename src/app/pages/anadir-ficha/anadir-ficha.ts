import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FichaDuplicateModals } from '../ficha-duplicate-modals/ficha-duplicate-modals';

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
  imports: [CommonModule, FormsModule, RouterLink, FichaDuplicateModals],
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
  similarTmdbPosterPath: string | null = null;
  private similarPosterRequest = 0;

  checking = false;
  saving = false;
  verificationFailed = false;

  error = '';
  notice = '';

  showDuplicate = false;
  duplicateItem: CommunityCatalogItem | null = null;

  // Datos recuperados de TMDB para fichas antiguas.
  duplicateTmdbPosterPath: string | null = null;
  duplicateTmdbId: number | null = null;

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

  async ngOnInit(): Promise<void> {
    this.loadingCategories = true;
    this.error = '';

    try {
      const [available, selectedIds] = await Promise.all([
        this.categoriesService.getActiveCategories(),
        this.preferencesService.getMyPreferences(),
      ]);

      const selected = available.filter((category) => selectedIds.includes(Number(category.id)));

      const selectedSlugs = selected.map((category) =>
        this.normalizeCategory(`${category.slug} ${category.name}`),
      );

      this.categories = COMMUNITY_CATEGORIES.filter((option) =>
        selectedSlugs.some((slug) => this.matchesPreference(option.id, slug)),
      );

      if (this.categories.length > 0) {
        this.category = this.categories[0].id;
      } else {
        this.error =
          'No tienes categorías seleccionadas. Ve a tu perfil y elige tus intereses para poder crear fichas.';
      }
    } catch (error) {
      console.error('Error cargando las categorías:', error);
      this.error = 'No hemos podido cargar tus categorías. Recarga la página e inténtalo de nuevo.';
    } finally {
      this.loadingCategories = false;
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

  private matchesPreference(id: CommunityCategory, slug: string): boolean {
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

    return aliases[id].some((alias) => slug.includes(alias));
  }

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
      this.categories.find((x) => x.id === this.category) ??
      COMMUNITY_CATEGORIES.find((x) => x.id === this.category)!
    );
  }

  get usesTmdb(): boolean {
    return this.category === 'movie' || this.category === 'tv';
  }

  get previewTitle(): string {
    return this.title.trim() || 'Tu nueva ficha';
  }

  get previewSubtitle(): string {
    return [this.year ? String(this.year) : '', this.selectedCategory.label]
      .filter(Boolean)
      .join(' · ');
  }

  selectCategory(category: CommunityCategory): void {
    if (!this.categories.some((item) => item.id === category)) return;
    if (this.category === category) return;

    this.category = category;
    this.searchRequest++;
    this.similarPosterRequest++;

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }

    this.details = {};
    this.selectedTmdb = null;
    this.tmdbResults = [];
    this.communityMatches = [];
    this.similarTmdbPosterPath = null;
    this.showSimilar = false;
    this.showDuplicate = false;
    this.duplicateItem = null;
    this.duplicateTmdbId = null;
    this.duplicateTmdbPosterPath = null;
    this.confirmedDifferent = false;
    this.checking = false;
    this.verificationFailed = false;
    this.notice = '';
    this.error = '';
    this.originalTitle = '';
    this.year = null;
  }

  dismissDuplicate(): void {
    // Cerrar el aviso no elimina la coincidencia: save() seguirá bloqueándola.
    this.showDuplicate = false;
  }

  onTitleChange(): void {
    this.error = '';
    this.notice = '';
    this.searchRequest++;
    this.similarPosterRequest++;
    this.showSimilar = false;
    this.showDuplicate = false;
    this.duplicateItem = null;
    this.duplicateTmdbId = null;
    this.duplicateTmdbPosterPath = null;
    this.confirmedDifferent = false;
    this.selectedTmdb = null;
    this.tmdbResults = [];
    this.communityMatches = [];
    this.similarTmdbPosterPath = null;
    this.verificationFailed = false;
    this.checking = false;

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }

    const value = this.title.trim();
    if (!this.usesTmdb || value.length < 2) return;

    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.checkMatches(value);
    }, 450);
  }

  async checkMatches(value = this.title.trim()): Promise<void> {
    if (!this.usesTmdb || value.trim().length < 2) return;

    const request = ++this.searchRequest;
    const category = this.category as 'movie' | 'tv';
    this.checking = true;
    this.verificationFailed = false;
    this.error = '';

    try {
      const [tmdbResult, communityResult] = await Promise.allSettled([
        this.tmdb.search(value, category),
        this.community.findMatches(value, category),
      ]);

      if (request !== this.searchRequest) return;

      this.tmdbResults = tmdbResult.status === 'fulfilled'
        ? tmdbResult.value.slice(0, 8)
        : [];
      this.communityMatches = communityResult.status === 'fulfilled'
        ? communityResult.value
        : [];

      if (tmdbResult.status === 'rejected' || communityResult.status === 'rejected') {
        this.verificationFailed = true;
        this.error = 'No hemos podido comprobar todas las coincidencias. No publiques todavía la ficha; inténtalo de nuevo.';
        return;
      }

      this.similarTmdbPosterPath = null;
      if (this.communityMatches.length) {
        void this.loadSimilarPoster(this.communityMatches[0]);
      }

      const exact = this.communityMatches.find((item) => {
        const sameTitle = this.normalize(item.title) === this.normalize(value);
        const sameYear = item.release_year === this.year;
        return sameTitle && sameYear;
      });

      if (exact) {
        // Una coincidencia exacta se avisa inmediatamente al escribir el título.
        this.duplicateItem = exact;
        this.showSimilar = false;
        this.confirmedDifferent = false;
        this.showDuplicate = true;
        await this.loadDuplicatePoster(exact);
        if (request !== this.searchRequest) return;
      } else {
        this.duplicateItem = null;
        this.showDuplicate = false;
        this.showSimilar = false;
        this.confirmedDifferent = false;
      }
    } catch (error) {
      console.error('Error comprobando coincidencias:', error);
      if (request === this.searchRequest) {
        this.verificationFailed = true;
        this.error = 'No hemos podido comprobar las coincidencias. Inténtalo de nuevo.';
      }
    } finally {
      if (request === this.searchRequest) {
        this.checking = false;
        this.cdr.detectChanges();
      }
    }
  }

  async chooseTmdb(item: CatalogItem): Promise<void> {
    this.searchRequest++;
    this.selectedTmdb = item;
    this.title = item.title || item.name || this.title;
    this.originalTitle = item.title || item.name || '';

    const date = item.release_date || item.first_air_date;
    this.year = date ? Number(date.slice(0, 4)) : null;
    this.overview = item.overview || '';

    this.duplicateItem = null;
    this.duplicateTmdbId = null;
    this.duplicateTmdbPosterPath = null;
    this.showDuplicate = false;
    this.showSimilar = false;
    this.confirmedDifferent = false;
    this.verificationFailed = false;
    this.notice = '';
    this.error = '';

    try {
      const existing = await this.community.findByTmdbId(item.id, this.category);
      if (existing) {
        this.duplicateItem = existing;
        await this.loadDuplicatePoster(existing);
        this.showDuplicate = true;
        this.notice = 'Esta película o serie ya está publicada en Bangtan Olé.';
        return;
      }

      const exact = await this.community.findExactTitle(this.title, this.year, this.category);
      if (exact) {
        this.duplicateItem = exact;
        await this.loadDuplicatePoster(exact);
        this.showDuplicate = true;
        this.notice = 'Ya existe una ficha con este título y año.';
        return;
      }

      this.notice = 'Este contenido está disponible en TMDB. Ábrelo para valorarlo y reseñarlo.';
    } catch (error) {
      console.error('Error comprobando la ficha existente:', error);
      this.verificationFailed = true;
      this.error = 'No hemos podido comprobar si ya existe una ficha comunitaria. Puedes abrir la ficha de TMDB, pero no crear una copia.';
    }
  }

  openSelectedTmdb(): void {
    if (!this.selectedTmdb || !this.usesTmdb) return;
    void this.router.navigate(['/contenido', this.category, this.selectedTmdb.id]);
  }

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
    if (!this.confirmedDifferent || this.verificationFailed) return;
    this.showSimilar = false;
    void this.save();
  }

 private async loadDuplicatePoster(item: CommunityCatalogItem): Promise<void> {
  this.duplicateTmdbPosterPath = null;
  this.duplicateTmdbId = item.tmdb_id ?? null;

  if (item.content_type !== 'movie' && item.content_type !== 'tv') {
    return;
  }

  try {
    let tmdbId = item.tmdb_id;
    let tmdbResult: CatalogItem | null = null;

    // Si la ficha antigua no tiene ID de TMDB, buscamos por título.
    if (!tmdbId) {
      const results = await this.tmdb.search(item.title, item.content_type);

      tmdbResult = results.find((result) => {
        const resultTitle = result.title || result.name || '';
        const resultDate = result.release_date || result.first_air_date;
        const resultYear = resultDate
          ? Number(resultDate.slice(0, 4))
          : null;

        return (
          this.normalize(resultTitle) === this.normalize(item.title) &&
          (!item.release_year || resultYear === item.release_year)
        );
      }) ?? null;

      if (!tmdbResult) return;

      tmdbId = tmdbResult.id;
      this.duplicateTmdbId = tmdbResult.id;
    }

    // Recuperamos todos los detalles para obtener también el año.
    const details = await this.tmdb.getDetails(tmdbId, item.content_type);

    const date =
      details?.release_date ||
      details?.first_air_date ||
      tmdbResult?.release_date ||
      tmdbResult?.first_air_date;

    // Actualizamos el objeto local para que el modal muestre el año.
    // Esto NO modifica ni guarda la ficha en Supabase.
    if (!item.release_year && date) {
      item.release_year = Number(date.slice(0, 4));
    }

    // Recuperamos el póster solamente si la ficha no tiene uno propio.
    if (!item.poster_url) {
      this.duplicateTmdbPosterPath =
        details?.poster_path ||
        tmdbResult?.poster_path ||
        null;
    }

    if (this.duplicateItem?.id === item.id) {
      this.cdr.detectChanges();
    }
  } catch (error) {
    console.warn(
      'No se ha podido recuperar la información de TMDB:',
      error
    );
  }
}

  private async loadSimilarPoster(item: CommunityCatalogItem): Promise<void> {
    const request = ++this.similarPosterRequest;
    this.similarTmdbPosterPath = null;

    if (item.poster_url) return;
    if (item.content_type !== 'movie' && item.content_type !== 'tv') return;

    try {
      if (item.tmdb_id) {
        const details = await this.tmdb.getDetails(item.tmdb_id, item.content_type);
        if (request === this.similarPosterRequest) {
          this.similarTmdbPosterPath = details?.poster_path ?? null;
        }
      } else {
        const results = await this.tmdb.search(item.title, item.content_type);
        const match = results.find((result) => {
          const resultTitle = result.title || result.name || '';
          const date = result.release_date || result.first_air_date;
          const resultYear = date ? Number(date.slice(0, 4)) : null;

          return (
            this.normalize(resultTitle) === this.normalize(item.title) &&
            (!item.release_year || resultYear === item.release_year)
          );
        });

        if (request === this.similarPosterRequest) {
          this.similarTmdbPosterPath = match?.poster_path ?? null;
        }
      }

      if (request === this.similarPosterRequest) {
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.warn('No se ha podido recuperar el póster de la ficha similar:', error);
    }
  }

  openExisting(): void {
    if (!this.duplicateItem) return;

    const item = this.duplicateItem;

    if (item.content_type === 'movie' || item.content_type === 'tv') {
      const tmdbId = item.tmdb_id ?? this.duplicateTmdbId;

      if (tmdbId) {
        void this.router.navigate(['/contenido', item.content_type, tmdbId]);
        return;
      }
    }

    void this.router.navigate(['/ficha-comunidad', item.id]);
  }

  async save(): Promise<void> {
    this.error = '';
    if (this.saving) return;

    if (!this.categories.some((item) => item.id === this.category)) {
      this.error = 'Selecciona una de tus categorías disponibles.';
      return;
    }
    if (!this.title.trim()) {
      this.error = 'Escribe un título antes de continuar.';
      return;
    }
    if (this.checking) {
      this.error = 'Espera a que termine la comprobación de coincidencias.';
      return;
    }
    if (this.usesTmdb && this.verificationFailed) {
      this.error = 'No se han podido comprobar las coincidencias. Inténtalo de nuevo antes de publicar.';
      return;
    }
    if (this.usesTmdb && this.selectedTmdb) {
      this.notice = 'Este contenido ya tiene ficha en TMDB. Ábrela para valorarlo y reseñarlo.';
      return;
    }
    const missing = this.selectedCategory.fields
      .filter((field) => field.required)
      .some((field) => !String(this.details[field.key] ?? '').trim());
    if (missing) {
      this.error = 'Completa los campos obligatorios de esta categoría.';
      return;
    }

    // Al pulsar «Crear ficha», mostrar siempre la comparación de similitudes
    // si la búsqueda encontró fichas comunitarias. El aviso de duplicado ya
    // se muestra mientras se escribe; cerrarlo permite revisar la comparación.
    // La protección definitiva contra duplicados exactos sigue en el servicio.
    if (this.usesTmdb && this.communityMatches.length > 0 && !this.confirmedDifferent) {
      this.showDuplicate = false;
      this.showSimilar = true;
      return;
    }
    if (this.showSimilar && !this.confirmedDifferent) return;

    this.saving = true;
    try {
      const item = await this.community.create({
        category: this.category,
        title: this.title,
        original_title: this.originalTitle || null,
        release_year: this.year,
        overview: this.overview,
        country: this.country || (this.category === 'travel' ? String(this.details['country'] ?? '') : ''),
        genres: this.genresText.split(',').map((value) => value.trim()).filter(Boolean),
        tmdb_id: null,
        poster: this.posterFile,
        details: this.details,
      });
      await this.router.navigate(['/ficha-comunidad', item.id]);
    } catch (error: any) {
      const message = error?.message || 'No se ha podido publicar la ficha.';
      if (message.startsWith('DUPLICATE:')) {
        const duplicateId = message.split(':')[1];
        await this.router.navigate(['/ficha-comunidad', duplicateId]);
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
