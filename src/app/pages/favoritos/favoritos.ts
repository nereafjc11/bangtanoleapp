import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FavoritesService, ContentFavorite } from '../../services/favorites.service';
import { TmdbService } from '../../services/tmdb.service';
import {
  CommunityCatalogService,
  CommunityCatalogItem,
} from '../../services/community-catalog.service';

interface FavoriteView {
  id: string;
  source: 'tmdb' | 'community';
  type: string;
  contentId: string;
  title: string;
  year: string;
  poster: string;
  overview: string;
}

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './favoritos.html',
  styleUrl: './favoritos.css',
})
export class Favoritos implements OnInit {
  items: FavoriteView[] = [];
  loading = true;
  error = '';
  removingId: string | null = null;
  showRemoveConfirm = false;
  pendingFavorite: FavoriteView | null = null;

  constructor(
    private favoritesService: FavoritesService,
    public tmdb: TmdbService,
    private community: CommunityCatalogService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadFavorites();
  }

  async loadFavorites(): Promise<void> {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    try {
      const favorites = await this.favoritesService.getMyFavorites();
      const resolved = await Promise.all(favorites.map((item) => this.resolveFavorite(item)));
      this.items = resolved.filter((item): item is FavoriteView => item !== null);
    } catch (error) {
      console.error('Error cargando favoritos:', error);
      this.error = error instanceof Error ? error.message : 'No se pudieron cargar tus favoritos.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async resolveFavorite(favorite: ContentFavorite): Promise<FavoriteView | null> {
    if (favorite.content_source === 'community') {
      const item = await this.community.getById(favorite.content_id).catch(() => null);
      if (!item) return null;
      return {
        id: favorite.id,
        source: 'community',
        type: favorite.content_type,
        contentId: favorite.content_id,
        title: item.title,
        year: item.release_year ? String(item.release_year) : '',
        poster: item.poster_url || '',
        overview: item.overview || '',
      };
    }

    try {
      const details = await this.tmdb.getDetails(
        Number(favorite.content_id),
        favorite.content_type === 'tv' ? 'tv' : 'movie',
      );
      return {
        id: favorite.id,
        source: 'tmdb',
        type: favorite.content_type,
        contentId: favorite.content_id,
        title: details?.title || details?.name || 'Contenido sin título',
        year: (details?.release_date || details?.first_air_date || '').slice(0, 4),
        poster: this.tmdb.getPoster(details?.poster_path || null, 'w342'),
        overview: details?.overview || '',
      };
    } catch (error) {
      console.error('No se pudo recuperar el contenido TMDB:', favorite.content_id, error);
      return null;
    }
  }

  openItem(item: FavoriteView): void {
    if (item.source === 'tmdb') {
      void this.router.navigate(['/contenido', item.type, item.contentId]);
    } else {
      void this.router.navigate(['/ficha-comunidad', item.contentId]);
    }
  }

  // Abre el modal personalizado antes de quitar un favorito.
  removeFavorite(item: FavoriteView, event: Event): void {
    event.stopPropagation();
    if (this.removingId) return;
    this.pendingFavorite = item;
    this.showRemoveConfirm = true;
    this.cdr.markForCheck();
  }

  closeRemoveConfirm(): void {
    if (this.removingId) return;
    this.showRemoveConfirm = false;
    this.pendingFavorite = null;
    this.cdr.markForCheck();
  }

  async confirmRemoveFavorite(): Promise<void> {
    const item = this.pendingFavorite;
    if (!item || this.removingId) return;

    this.removingId = item.id;
    this.error = '';
    this.cdr.markForCheck();

    try {
      await this.favoritesService.removeFavorite({
        source: item.source,
        type: item.type,
        id: item.contentId,
      });
      this.items = this.items.filter((current) => current.id !== item.id);
      this.showRemoveConfirm = false;
      this.pendingFavorite = null;
    } catch (error) {
      console.error('Error eliminando favorito:', error);
      this.error = error instanceof Error ? error.message : 'No se pudo quitar de favoritos.';
    } finally {
      this.removingId = null;
      this.cdr.markForCheck();
    }
  }
}
