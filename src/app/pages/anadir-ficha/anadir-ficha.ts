import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TmdbService, CatalogItem } from '../../services/tmdb.service';
import { CommunityCatalogService, CommunityCatalogItem } from '../../services/community-catalog.service';

@Component({
  selector: 'app-anadir-ficha',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './anadir-ficha.html',
  styleUrl: './anadir-ficha.css'
})
export class AnadirFicha implements OnInit, OnDestroy {
  type: 'movie' | 'tv' = 'movie';
  title = '';
  originalTitle = '';
  year: number | null = null;
  overview = '';
  country = '';
  genresText = '';
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
public tmdb: TmdbService,    private community: CommunityCatalogService,
    private router: Router
  ) {}

  ngOnInit() {}
  ngOnDestroy() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.posterPreview) URL.revokeObjectURL(this.posterPreview);
  }

  onTitleChange() {
    this.error = '';
    this.notice = '';
    this.showSimilar = false;
    this.confirmedDifferent = false;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const value = this.title.trim();
    if (value.length < 2) {
      this.tmdbResults = [];
      this.communityMatches = [];
      return;
    }
    this.searchTimer = setTimeout(() => void this.checkMatches(value), 450);
  }

  async checkMatches(value = this.title.trim()) {
    if (value.length < 2) return;
    const request = ++this.searchRequest;
    this.checking = true;
    try {
      const [tmdbResults, communityMatches] = await Promise.all([
        this.tmdb.search(value, this.type).catch(() => [] as CatalogItem[]),
        this.community.findMatches(value, this.type)
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
      } else if (communityMatches.length > 0) {
        this.showSimilar = true;
        this.confirmedDifferent = false;
      }
    } catch (e: any) {
      this.error = e?.message || 'No se han podido comprobar las coincidencias.';
    } finally {
      if (request === this.searchRequest) this.checking = false;
    }
  }

  chooseTmdb(item: CatalogItem) {
    this.selectedTmdb = item;
    this.title = item.title || item.name || this.title;
    this.originalTitle = item.title || item.name || '';
    const date = item.release_date || item.first_air_date;
    this.year = date ? Number(date.slice(0, 4)) : null;
    this.overview = item.overview || '';
    this.notice = 'Hemos utilizado los datos de TMDB como punto de partida. Puedes editarlos.';
  }

  onPosterSelected(event: Event) {
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
    if (this.posterPreview) URL.revokeObjectURL(this.posterPreview);
    this.posterFile = file;
    this.posterPreview = URL.createObjectURL(file);
  }

  removePoster() {
    if (this.posterPreview) URL.revokeObjectURL(this.posterPreview);
    this.posterPreview = null;
    this.posterFile = null;
  }

  confirmDifferent() {
    this.confirmedDifferent = true;
    this.showSimilar = false;
  }

  openExisting() {
    if (this.duplicateItem) {
      this.router.navigate(['/ficha-comunidad', this.duplicateItem.id]);
    }
  }

  async save() {
    this.error = '';
    if (!this.title.trim()) {
      this.error = 'Escribe un título antes de continuar.';
      return;
    }
    if (this.communityMatches.length && !this.confirmedDifferent &&
        !this.communityMatches.some(item => this.normalize(item.title) === this.normalize(this.title) &&
          (item.release_year ?? 0) === (this.year ?? 0))) {
      this.showSimilar = true;
      return;
    }

    this.saving = true;
    try {
      const item = await this.community.create({
        title: this.title,
        original_title: this.originalTitle || null,
        content_type: this.type,
        release_year: this.year,
        overview: this.overview,
        country: this.country,
        genres: this.genresText.split(',').map(x => x.trim()).filter(Boolean),
        tmdb_id: this.selectedTmdb?.id ?? null,
        poster: this.posterFile
      });
      await this.router.navigate(['/ficha-comunidad', item.id]);
    } catch (e: any) {
      const message = e?.message || 'No se ha podido publicar la ficha.';
      if (message.startsWith('DUPLICATE:')) {
        const id = message.split(':')[1];
        await this.router.navigate(['/ficha-comunidad', id]);
      } else {
        this.error = message;
      }
    } finally {
      this.saving = false;
    }
  }

  private normalize(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
  }
}
