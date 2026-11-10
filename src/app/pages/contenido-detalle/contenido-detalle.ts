
import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TmdbService } from '../../services/tmdb.service';
import { SupabaseService } from '../../services/supabase.service';
import { ListsService, UserList } from '../../services/lists.service';
import { ProfileService, UserProfile } from '../../services/profile.service';

interface Review {
  id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  profile?: UserProfile | null;
}

@Component({
  selector: 'app-contenido-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './contenido-detalle.html',
  styleUrl: './contenido-detalle.css'
})
export class ContenidoDetalle implements OnInit, OnDestroy {

  type: 'movie' | 'tv' = 'movie';
  contentId = '';

  content: any = null;
  reviews: Review[] = [];
  myLists: UserList[] = [];

  currentUserId: string | null = null;
  myReview: Review | null = null;

  rating = 0;
  reviewText = '';

  isFavorite = false;
  selectedListId = '';

  loading = true;
  listsLoading = false;
  savingReview = false;
  favoriteLoading = false;
  addingToList = false;
  creatingList = false;

  newListName = '';

  error = '';
  notice = '';
  listsError = '';

  private routeSubscription?: Subscription;

  constructor(
    public tmdb: TmdbService,
    private supabase: SupabaseService,
    private listsService: ListsService,
    private profileService: ProfileService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  private refreshView(): void {
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const type = params.get('type');
      const id = params.get('id');

      if (
        (type !== 'movie' && type !== 'tv') ||
        !id ||
        !/^\d+$/.test(id)
      ) {
        this.content = null;
        this.error = 'La dirección de esta película o serie no es válida.';
        this.loading = false;
        this.refreshView();
        return;
      }

      this.type = type;
      this.contentId = id;

      this.content = null;
      this.reviews = [];
      this.myLists = [];
      this.myReview = null;

      this.rating = 0;
      this.reviewText = '';

      this.isFavorite = false;
      this.selectedListId = '';

      this.error = '';
      this.notice = '';
      this.listsError = '';

      this.loading = true;
      this.refreshView();

      void this.loadContent();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  async loadContent(): Promise<void> {
    this.loading = true;
    this.listsLoading = true;
    this.error = '';
    this.notice = '';
    this.listsError = '';

    this.refreshView();

    try {
      const { data: authData, error: authError } =
        await this.supabase.client.auth.getUser();

      if (authError || !authData.user) {
        throw new Error('Inicia sesión para consultar esta ficha.');
      }

      this.currentUserId = authData.user.id;

      const listsPromise = this.loadMyLists();

      const [content, reviews, favorite] = await Promise.all([
        this.tmdb.getDetails(Number(this.contentId), this.type),

        this.supabase.client
          .from('content_reviews')
          .select('id, user_id, rating, review_text, created_at')
          .eq('content_source', 'tmdb')
          .eq('content_type', this.type)
          .eq('content_id', this.contentId)
          .order('created_at', { ascending: false }),

        this.supabase.client
          .from('content_favorites')
          .select('id')
          .eq('user_id', authData.user.id)
          .eq('content_source', 'tmdb')
          .eq('content_type', this.type)
          .eq('content_id', this.contentId)
          .maybeSingle()
      ]);

      if (!content) {
        throw new Error('No hemos encontrado esta película o serie en TMDB.');
      }

      if (reviews.error) throw reviews.error;
      if (favorite.error) throw favorite.error;

      this.content = content;
      this.reviews = (reviews.data ?? []) as Review[];
      this.isFavorite = !!favorite.data;

      await this.loadReviewProfiles();

      this.myReview =
        this.reviews.find(review =>
          review.user_id === this.currentUserId
        ) ?? null;

      if (this.myReview) {
        this.rating = Number(this.myReview.rating);
        this.reviewText = this.myReview.review_text ?? '';
      }

      await listsPromise;

    } catch (error: any) {
      console.error('Error cargando el detalle:', error);

      this.error =
        error?.message || 'No hemos podido cargar esta ficha.';

    } finally {
      this.loading = false;
      this.refreshView();
    }
  }

  /**
   * Recupera los perfiles de todas las personas que han valorado este contenido
   * en una sola consulta, evitando hacer una petición por cada reseña.
   */
  private async loadReviewProfiles(): Promise<void> {
    const userIds = [...new Set(this.reviews.map(review => review.user_id))];

    if (!userIds.length) {
      this.reviews = this.reviews.map(review => ({ ...review, profile: null }));
      return;
    }

    try {
      const profiles = await this.profileService.getPublicProfiles(userIds);
      const profilesById = new Map(profiles.map(profile => [profile.id, profile]));

      this.reviews = this.reviews.map(review => ({
        ...review,
        profile: profilesById.get(review.user_id) ?? null
      }));
    } catch (error) {
      // Si falla la consulta de perfiles, las reseñas siguen mostrándose.
      console.error('No se pudieron recuperar los perfiles de las reseñas:', error);
      this.reviews = this.reviews.map(review => ({ ...review, profile: null }));
    }
  }

  getReviewAuthor(review: Review): string {
    return review.profile?.display_name?.trim()
      || review.profile?.username?.trim()
      || 'Miembro de Bangtan Olé';
  }

  getReviewInitials(review: Review): string {
    const name = this.getReviewAuthor(review);
    return name
      .split(/\\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'A';
  }

  async loadMyLists(): Promise<void> {
    this.listsLoading = true;
    this.listsError = '';
    this.refreshView();

    try {
      const lists = await this.listsService.getMyLists();

      this.myLists = lists;

      if (
        !this.selectedListId ||
        !this.myLists.some(list => list.id === this.selectedListId)
      ) {
        this.selectedListId = this.myLists[0]?.id ?? '';
      }

      console.log('Listas recuperadas:', this.myLists.length);

    } catch (error: any) {
      console.error('Error recuperando las listas:', error);

      this.myLists = [];
      this.selectedListId = '';
      this.listsError =
        error?.message || 'No se han podido cargar tus listas.';

    } finally {
      this.listsLoading = false;
      this.refreshView();
    }
  }

  get title(): string {
    return this.content?.title || this.content?.name || 'Sin título';
  }

  get originalTitle(): string {
    return this.content?.original_title ||
      this.content?.original_name ||
      '';
  }

  get releaseDate(): string {
    return this.content?.release_date ||
      this.content?.first_air_date ||
      '';
  }

  get year(): string {
    return this.releaseDate
      ? this.releaseDate.slice(0, 4)
      : '';
  }

  get genres(): string[] {
    return (this.content?.genres ?? [])
      .map((genre: any) => genre.name)
      .filter(Boolean);
  }

  get averageRating(): number {
    if (!this.reviews.length) return 0;

    const total = this.reviews.reduce(
      (sum, review) => sum + Number(review.rating),
      0
    );

    return total / this.reviews.length;
  }

  get posterUrl(): string {
    return this.tmdb.getPoster(
      this.content?.poster_path ?? null,
      'w500'
    );
  }

  get backdropUrl(): string {
    return this.tmdb.getBackdrop(
      this.content?.backdrop_path ?? null
    );
  }

  get duration(): string {
    if (this.type === 'movie') {
      const minutes = this.content?.runtime;

      if (!minutes) return '';

      const hours = Math.floor(minutes / 60);
      const remaining = minutes % 60;

      return hours
        ? `${hours} h ${remaining} min`
        : `${remaining} min`;
    }

    const episodes = this.content?.episode_run_time ?? [];

    return episodes.length
      ? `${episodes[0]} min por episodio`
      : '';
  }

  async saveReview(): Promise<void> {
    this.error = '';
    this.notice = '';

    if (!this.currentUserId) {
      this.error = 'Inicia sesión para publicar una reseña.';
      this.refreshView();
      return;
    }

    if (
      this.rating < 1 ||
      this.rating > 5 ||
      !Number.isInteger(this.rating * 2)
    ) {
      this.error = 'Selecciona una puntuación entre 1 y 5.';
      this.refreshView();
      return;
    }

    this.savingReview = true;
    this.refreshView();

    try {
      const { data, error } = await this.supabase.client
        .from('content_reviews')
        .upsert({
          user_id: this.currentUserId,
          content_source: 'tmdb',
          content_type: this.type,
          content_id: this.contentId,
          rating: this.rating,
          review_text: this.reviewText.trim() || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,content_source,content_type,content_id'
        })
        .select('id, user_id, rating, review_text, created_at')
        .single();

      if (error) throw error;

      this.myReview = data as Review;

      const index = this.reviews.findIndex(
        review => review.user_id === this.currentUserId
      );

      if (index >= 0) {
        this.reviews[index] = this.myReview;
      } else {
        this.reviews.unshift(this.myReview);
      }

      await this.loadReviewProfiles();
      this.myReview = this.reviews.find(
        review => review.user_id === this.currentUserId
      ) ?? this.myReview;

      this.notice = 'Tu valoración se ha guardado correctamente.';

    } catch (error: any) {
      console.error('Error guardando la reseña:', error);
      this.error = error?.message || 'No se ha podido guardar tu reseña.';

    } finally {
      this.savingReview = false;
      this.refreshView();
    }
  }

  async deleteReview(): Promise<void> {
    if (!this.currentUserId || !this.myReview) return;

    this.error = '';
    this.notice = '';

    try {
      const { error } = await this.supabase.client
        .from('content_reviews')
        .delete()
        .eq('id', this.myReview.id)
        .eq('user_id', this.currentUserId);

      if (error) throw error;

      this.reviews = this.reviews.filter(
        review => review.id !== this.myReview?.id
      );

      this.myReview = null;
      this.rating = 0;
      this.reviewText = '';

      this.notice = 'Tu reseña se ha eliminado.';

    } catch (error: any) {
      console.error('Error eliminando la reseña:', error);
      this.error = 'No se ha podido eliminar tu reseña.';

    } finally {
      this.refreshView();
    }
  }

  async toggleFavorite(): Promise<void> {
    if (!this.currentUserId || this.favoriteLoading) return;

    this.favoriteLoading = true;
    this.error = '';
    this.notice = '';
    this.refreshView();

    try {
      if (this.isFavorite) {
        const { error } = await this.supabase.client
          .from('content_favorites')
          .delete()
          .eq('user_id', this.currentUserId)
          .eq('content_source', 'tmdb')
          .eq('content_type', this.type)
          .eq('content_id', this.contentId);

        if (error) throw error;

        this.isFavorite = false;
        this.notice = 'Se ha quitado de tus favoritos.';

      } else {
        const { error } = await this.supabase.client
          .from('content_favorites')
          .upsert({
            user_id: this.currentUserId,
            content_source: 'tmdb',
            content_type: this.type,
            content_id: this.contentId
          }, {
            onConflict: 'user_id,content_source,content_type,content_id'
          });

        if (error) throw error;

        this.isFavorite = true;
        this.notice = 'Añadido a tus favoritos.';
      }

    } catch (error: any) {
      console.error('Error actualizando favoritos:', error);
      this.error = error?.message || 'No se han podido actualizar tus favoritos.';

    } finally {
      this.favoriteLoading = false;
      this.refreshView();
    }
  }

  async addToList(): Promise<void> {
    if (!this.selectedListId || this.addingToList) {
      this.error = 'Selecciona una lista primero.';
      this.refreshView();
      return;
    }

    this.addingToList = true;
    this.error = '';
    this.notice = '';
    this.refreshView();

    try {
      await this.listsService.addItem(this.selectedListId, {
        source: 'tmdb',
        type: this.type,
        id: this.contentId
      });

      this.notice = 'Contenido añadido a tu lista.';

    } catch (error: any) {
      console.error('Error añadiendo a la lista:', error);
      this.error = error?.message || 'No se ha podido añadir a la lista.';

    } finally {
      this.addingToList = false;
      this.refreshView();
    }
  }

  async createList(): Promise<void> {
    const name = this.newListName.trim();

    if (!name || this.creatingList) {
      this.error = 'Escribe un nombre para tu nueva lista.';
      this.refreshView();
      return;
    }

    this.creatingList = true;
    this.error = '';
    this.notice = '';
    this.refreshView();

    try {
      const created = await this.listsService.createList({
        name,
        isPublic: false
      });

      this.myLists = [created, ...this.myLists];
      this.selectedListId = created.id;
      this.newListName = '';

      await this.addToList();

    } catch (error: any) {
      console.error('Error creando la lista:', error);
      this.error = error?.message || 'No se ha podido crear la lista.';

    } finally {
      this.creatingList = false;
      this.refreshView();
    }
  }

  getReviewDate(value: string): string {
    return new Date(value).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}
