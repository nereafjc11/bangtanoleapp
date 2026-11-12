import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { ProfileService, UserProfile } from '../../services/profile.service';

import { SupabaseService } from '../../services/supabase.service';
import { AvatarService } from '../../services/avatar.service';
import { TmdbService } from '../../services/tmdb.service';
import { CommunityCatalogService } from '../../services/community-catalog.service';
import { ReviewsService, ContentReview } from '../../services/reviews.service';
import { CategoriesService, Category } from '../../services/categories.service';
import { UserPreferencesService } from '../../services/user-preferences.service';

type SocialListType = 'followers' | 'following' | 'friends';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit, OnDestroy {
  showEditProfile = false;
  private profileService = inject(ProfileService);
  private avatarService = inject(AvatarService);
  private reviewsService = inject(ReviewsService);
  private tmdb = inject(TmdbService);
  private communityCatalog = inject(CommunityCatalogService);
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private changeDetector = inject(ChangeDetectorRef);
  private categoriesService = inject(CategoriesService);
  private preferencesService = inject(UserPreferencesService);

  categories: Category[] = [];
  selectedCategories: number[] = [];
  loadingEditCategories = false;
  birthdayDate = '';

  private routeSubscription?: Subscription;
  private loadRequest = 0;
  private socialRequest = 0;
  currentUserId: string | null = null;
  socialFollowStates: Record<string, boolean> = {};
  socialFollowLoadingIds = new Set<string>();
  profile: UserProfile | null = null;

  isOwnProfile = true;

  myReviews: Array<ContentReview & { displayTitle: string; displayImage: string | null }> = [];
  reviewsLoading = false;
  reviewsError = '';

  email = '';
  username = '';
  displayName = '';
  bio = '';
  country = '';
  location = '';
  interestsText = '';
  websiteUrl = '';
  isPrivate = false;
  listsCount = 0;
  favoritesCount = 0;
  reviewsCount = 0;

  avatarUrl = '';
  selectedFile: File | null = null;
  previewUrl = '';
  coverUrl = '';
  selectedCoverFile: File | null = null;
  coverPreviewUrl = '';
  coverPositionX = 50;
  coverPositionY = 50;
  coverZoom = 1;
  coverZoomPercent = 100;
  coverDragging = false;
  private coverDragPointerId: number | null = null;
  private coverDragLastX = 0;
  private coverDragLastY = 0;
  uploadingCover = false;
  private editSnapshot: {
    username: string; displayName: string; bio: string; country: string;
    location: string; interestsText: string; websiteUrl: string; isPrivate: boolean; selectedCategories: number[]; birthdayDate: string;
  } | null = null;

  loading = false;
  saving = false;
  uploadingAvatar = false;
  followLoading = false;

  followersCount = 0;
  followingCount = 0;
  mutualFriends: UserProfile[] = [];
  isFollowingUser = false;

  socialListType: SocialListType | null = null;
  socialUsers: UserProfile[] = [];
  socialSearch = '';
  socialListLoading = false;
  socialListError = '';

  errorMessage = '';
  successMessage = '';

  get filteredSocialUsers(): UserProfile[] {
    const query = this.socialSearch.trim().toLocaleLowerCase();
    if (!query) return this.socialUsers;

    return this.socialUsers.filter((person) => {
      const name = (person.display_name ?? '').toLocaleLowerCase();
      const username = (person.username ?? '').toLocaleLowerCase();
      return name.includes(query) || username.includes(query);
    });
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      const requestedId = params.get('id');
      void this.loadProfile(requestedId);
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();

    this.clearImagePreviews();
  }

  async loadProfile(requestedId: string | null): Promise<void> {
    const currentRequest = ++this.loadRequest;

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.profile = null;
    this.email = '';
    this.username = '';
    this.displayName = '';
    this.bio = '';
    this.country = '';
    this.location = '';
    this.interestsText = '';
    this.websiteUrl = '';
    this.isPrivate = false;
    this.listsCount = 0;
    this.favoritesCount = 0;
    this.reviewsCount = 0;
    this.avatarUrl = '';
    this.coverUrl = '';

    this.followersCount = 0;
    this.followingCount = 0;
    this.mutualFriends = [];
    this.isFollowingUser = false;

    this.socialListType = null;
    this.socialUsers = [];
    this.socialListError = '';
    this.socialFollowStates = {};
    this.myReviews = [];
    this.reviewsError = '';

    this.selectedFile = null;

    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = '';
    }

    try {
      const {
        data: { user },
        error,
      } = await this.supabase.client.auth.getUser();

      if (error || !user) {
        await this.router.navigate(['/auth/login']);
        return;
      }

      if (currentRequest !== this.loadRequest) return;

      this.currentUserId = user.id;
      this.isOwnProfile = !requestedId || requestedId === user.id;

      if (this.isOwnProfile) {
        this.email = user.email ?? '';
        this.profile = await this.profileService.getMyProfile();

        if (currentRequest !== this.loadRequest) return;

        const registrationName = user.user_metadata?.['nombre'] ?? '';

        this.username = this.profile.username ?? '';
        this.displayName = this.profile.display_name || registrationName;
        this.bio = this.profile.bio ?? '';
        this.country = this.profile.country ?? '';
        this.location = this.profile.location ?? '';
        this.interestsText = (this.profile.interests ?? []).join(', ');
        this.websiteUrl = this.profile.website_url ?? '';
        this.birthdayDate = this.profile.birthday_date ?? '';
        this.isPrivate = this.profile.is_private ?? false;
        this.avatarUrl = this.profile.avatar_url ?? '';
        this.coverUrl = this.profile.cover_url ?? '';

        if (!this.profile.display_name && registrationName) {
          await this.profileService.updateMyProfile({
            username: this.username || null,
            display_name: registrationName,
            bio: this.bio || null,
          });
        }
      } else {
        if (!requestedId) {
          throw new Error('No se ha indicado el usuario que se quiere consultar.');
        }

        this.profile = await this.profileService.getPublicProfile(requestedId);

        if (currentRequest !== this.loadRequest) return;

        this.username = this.profile.username ?? '';
        this.displayName = this.profile.display_name ?? '';
        this.bio = this.profile.bio ?? '';
        this.country = this.profile.country ?? '';
        this.location = this.profile.location ?? '';
        this.interestsText = (this.profile.interests ?? []).join(', ');
        this.websiteUrl = this.profile.website_url ?? '';
        this.birthdayDate = this.profile.birthday_date ?? '';
        this.isPrivate = this.profile.is_private ?? false;
        this.avatarUrl = this.profile.avatar_url ?? '';
        this.coverUrl = this.profile.cover_url ?? '';
      }

      if (currentRequest !== this.loadRequest) return;

      const [followers, following] = await Promise.all([
        this.profileService.getFollowersCount(this.profile.id),
        this.profileService.getFollowingCount(this.profile.id),
      ]);

      if (currentRequest !== this.loadRequest) return;

      this.followersCount = followers;
      this.followingCount = following;
      this.mutualFriends = await this.profileService.getMutualFriends(this.profile.id);

      const [lists, favorites, reviews] = await Promise.all([
        this.profileService.getListsCount(this.profile.id),
        this.profileService.getFavoritesCount(this.profile.id),
        this.profileService.getReviewsCount(this.profile.id)
      ]);
      this.listsCount = lists;
      this.favoritesCount = favorites;
      this.reviewsCount = reviews;

      if (this.isOwnProfile) {
        await this.loadMyReviews();
        if (currentRequest !== this.loadRequest) return;
      }

      if (!this.isOwnProfile) {
        this.isFollowingUser = await this.profileService.isFollowing(this.profile.id);
      }
    } catch (error) {
      if (currentRequest !== this.loadRequest) return;

      console.error('Error al cargar el perfil:', error);
      this.errorMessage = 'No hemos podido cargar este perfil. Inténtalo de nuevo.';
    } finally {
      if (currentRequest === this.loadRequest) {
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    }
  }

  // =====================================
  // LISTAS SOCIALES
  // =====================================

  async openSocialList(type: SocialListType): Promise<void> {
    if (!this.profile) return;

    // Si se pulsa de nuevo la pestaña activa, cerramos el popup.
    if (this.socialListType === type && !this.socialListLoading) {
      this.closeSocialList();
      return;
    }

    // Identificador para evitar que una consulta antigua
    // sobrescriba la lista que se está mostrando ahora.
    const requestId = ++this.socialRequest;
    const profileId = this.profile.id;

    this.socialListType = type;
    this.socialUsers = [];
    this.socialListError = '';
    this.socialListLoading = true;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const loadPromise =
        type === 'followers'
          ? this.profileService.getFollowers(profileId)
          : type === 'following'
            ? this.profileService.getFollowing(profileId)
            : this.profileService.getMutualFriends(profileId);

      const timeoutPromise = new Promise<UserProfile[]>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              'La consulta está tardando demasiado. Comprueba tu conexión e inténtalo de nuevo.',
            ),
          );
        }, 15000);
      });

      const users = await Promise.race([loadPromise, timeoutPromise]);

      if (requestId !== this.socialRequest) return;

      this.socialUsers = users;

      const states = await Promise.all(
        users
          .filter((person) => person.id !== this.currentUserId)
          .map(async (person) => ({
            id: person.id,
            following: await this.profileService.isFollowing(person.id),
          })),
      );

      if (requestId !== this.socialRequest) return;

      this.socialFollowStates = {};
      for (const state of states) {
        this.socialFollowStates[state.id] = state.following;
      }
    } catch (error) {
      if (requestId !== this.socialRequest) return;

      console.error('Error cargando la lista social:', error);

      this.socialListError =
        error instanceof Error
          ? error.message
          : 'No hemos podido cargar esta lista. Inténtalo de nuevo.';
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      if (requestId === this.socialRequest) {
        this.socialListLoading = false;
        this.changeDetector.detectChanges();
      }
    }
  }

  closeSocialList(): void {
    this.socialRequest++;
    this.socialListType = null;
    this.socialUsers = [];
    this.socialSearch = '';
    this.socialFollowStates = {};
    this.socialListError = '';
    this.socialListLoading = false;
  }

  async toggleSocialUserFollow(person: UserProfile): Promise<void> {
    if (person.id === this.currentUserId || this.socialFollowLoadingIds.has(person.id)) {
      return;
    }

    const wasFollowing = !!this.socialFollowStates[person.id];
    this.socialFollowLoadingIds.add(person.id);
    this.socialListError = '';
    this.changeDetector.detectChanges();

    try {
      if (wasFollowing) {
        await this.profileService.unfollowUser(person.id);
        this.socialFollowStates[person.id] = false;
      } else {
        await this.profileService.followUser(person.id);
        this.socialFollowStates[person.id] = true;
      }

      if (this.isOwnProfile) {
        this.followingCount = Math.max(0, this.followingCount + (wasFollowing ? -1 : 1));
      }
    } catch (error) {
      console.error('Error al actualizar seguimiento desde la lista:', error);
      this.socialListError = 'No hemos podido actualizar el seguimiento. Inténtalo de nuevo.';
    } finally {
      this.socialFollowLoadingIds.delete(person.id);
      this.changeDetector.detectChanges();
    }
  }

  openSocialUser(user: UserProfile): void {
    this.closeSocialList();

    void this.router.navigate(['/profile', user.id]);
  }

  // =====================================
  // SEGUIR Y DEJAR DE SEGUIR
  // =====================================

  async toggleFollow(): Promise<void> {
    if (!this.profile || this.isOwnProfile || this.followLoading) {
      return;
    }

    this.followLoading = true;
    this.errorMessage = '';

    try {
      if (this.isFollowingUser) {
        await this.profileService.unfollowUser(this.profile.id);
        this.isFollowingUser = false;
        this.followersCount = Math.max(0, this.followersCount - 1);
      } else {
        await this.profileService.followUser(this.profile.id);
        this.isFollowingUser = true;
        this.followersCount++;
      }
    } catch (error) {
      console.error('Error al actualizar seguimiento:', error);
      this.errorMessage = 'No hemos podido actualizar el seguimiento. Inténtalo de nuevo.';
    } finally {
      this.followLoading = false;
      this.changeDetector.detectChanges();
    }
  }

  // =====================================
  // FOTOGRAFÍA DE PERFIL
  // =====================================

  async startEditProfile(): Promise<void> {
    if (!this.isOwnProfile || this.loadingEditCategories || this.saving) return;
    this.editSnapshot = {
      username: this.username, displayName: this.displayName, bio: this.bio,
      country: this.country, location: this.location, interestsText: this.interestsText,
      websiteUrl: this.websiteUrl, isPrivate: this.isPrivate,
      selectedCategories: [...this.selectedCategories],
      birthdayDate: this.birthdayDate
    };
    this.selectedFile = null;
    this.selectedCoverFile = null;
    this.coverPositionX = 50;
    this.coverPositionY = 50;
    this.coverZoom = 1;
    this.coverZoomPercent = 100;
    this.clearImagePreviews();
    this.showEditProfile = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.loadingEditCategories = true;
    try {
      const [categories, selected] = await Promise.all([
        this.categoriesService.getActiveCategories(),
        this.preferencesService.getMyPreferences()
      ]);
      this.categories = categories;
      this.selectedCategories = [...selected];
    } catch (error) {
      console.error('Error al cargar los intereses para editar el perfil:', error);
      this.errorMessage = 'No hemos podido cargar tus intereses. Puedes volver a intentarlo.';
    } finally {
      this.loadingEditCategories = false;
      this.changeDetector.detectChanges();
    }
  }

  getCategoryIcon(categoryName: string): string {
    // Mantiene exactamente la misma correspondencia de BangtanIcons que el menú lateral.
    const value = (categoryName ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (value.includes('serie') || value.includes('pelicula') || value.includes('cine') || value.includes('film')) {
      return 'film';
    }

    if (value.includes('skincare') || value.includes('belleza') || value.includes('beauty')) {
      return 'star';
    }

    if (value.includes('musica') || value.includes('music')) {
      return 'music';
    }

    if (value.includes('libro') || value.includes('lectura') || value.includes('book')) {
      return 'book-open';
    }

    if (value.includes('moda') || value.includes('estilo') || value.includes('fashion') || value.includes('ropa')) {
      return 'shopping-bag';
    }

    if (value.includes('otro') || value.includes('other') || value.includes('misc')) {
      return 'grid';
    }

    if (value.includes('viaje') || value.includes('travel') || value.includes('turismo') || value.includes('aventura')) {
      return 'map';
    }

    return 'compass';
  }

  toggleInterest(categoryId: number): void {
    this.selectedCategories = this.selectedCategories.includes(categoryId)
      ? this.selectedCategories.filter(id => id !== categoryId)
      : [...this.selectedCategories, categoryId];
    this.errorMessage = '';
  }

  isInterestSelected(categoryId: number): boolean {
    return this.selectedCategories.includes(categoryId);
  }

  cancelEditProfile(): void {
    if (this.saving) return;
    if (this.editSnapshot) Object.assign(this, this.editSnapshot);
    this.selectedCategories = this.editSnapshot?.selectedCategories ? [...this.editSnapshot.selectedCategories] : this.selectedCategories;
    this.selectedFile = null;
    this.selectedCoverFile = null;
    this.clearImagePreviews();
    this.showEditProfile = false;
    this.editSnapshot = null;
    this.errorMessage = '';
  }

  private clearImagePreviews(): void {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    if (this.coverPreviewUrl) URL.revokeObjectURL(this.coverPreviewUrl);
    this.previewUrl = '';
    this.coverPreviewUrl = '';
  }

  onCoverSelected(event: Event): void {
    if (!this.isOwnProfile || !this.showEditProfile) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.errorMessage = 'Selecciona una portada JPG, PNG o WEBP.';
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'La portada no puede superar los 5 MB.';
      input.value = '';
      return;
    }
    if (this.coverPreviewUrl) URL.revokeObjectURL(this.coverPreviewUrl);
    this.selectedCoverFile = file;
    this.coverPreviewUrl = URL.createObjectURL(file);
    this.coverPositionX = 50;
    this.coverPositionY = 50;
    this.coverZoom = 1;
    this.coverZoomPercent = 100;
    this.errorMessage = '';
  }

  onCoverPointerDown(event: PointerEvent): void {
    if (!this.selectedCoverFile || (event.target as HTMLElement).closest('button, label, input')) return;
    const element = event.currentTarget as HTMLElement;
    this.coverDragging = true;
    this.coverDragPointerId = event.pointerId;
    this.coverDragLastX = event.clientX;
    this.coverDragLastY = event.clientY;
    element.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  onCoverPointerMove(event: PointerEvent): void {
    if (!this.coverDragging || this.coverDragPointerId !== event.pointerId) return;
    const element = event.currentTarget as HTMLElement;
    const deltaX = event.clientX - this.coverDragLastX;
    const deltaY = event.clientY - this.coverDragLastY;
    this.coverDragLastX = event.clientX;
    this.coverDragLastY = event.clientY;
    this.coverPositionX = Math.max(0, Math.min(100, this.coverPositionX - (deltaX / Math.max(1, element.clientWidth)) * 100));
    this.coverPositionY = Math.max(0, Math.min(100, this.coverPositionY - (deltaY / Math.max(1, element.clientHeight)) * 100));
  }

  onCoverPointerUp(event: PointerEvent): void {
    if (this.coverDragPointerId !== event.pointerId) return;
    this.coverDragging = false;
    this.coverDragPointerId = null;
  }

  private async createAdjustedCover(file: File): Promise<File> {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('No se pudo leer la imagen de portada.'));
        image.src = objectUrl;
      });

      // Proporción de la portada que se muestra en el perfil.
      const canvas = document.createElement('canvas');
      const width = 1800;
      const height = 320;
      canvas.width = width;
      canvas.height = height;
      const baseScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const scale = baseScale * this.coverZoom;
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const x = (width - drawWidth) * (this.coverPositionX / 100);
      const y = (height - drawHeight) * (this.coverPositionY / 100);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo preparar el encuadre de portada.');
      context.drawImage(image, x, y, drawWidth, drawHeight);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(result => result ? resolve(result) : reject(new Error('No se pudo recortar la portada.')), file.type || 'image/jpeg', 0.92);
      });
      const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
      return new File([blob], `cover-adjusted.${extension}`, { type: blob.type });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  onAvatarSelected(event: Event): void {
    if (!this.isOwnProfile || !this.showEditProfile || this.saving) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.errorMessage = '';
    this.successMessage = '';

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.errorMessage = 'Selecciona una imagen JPG, PNG o WEBP.';
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.errorMessage = 'La fotografía no puede superar los 2 MB.';
      input.value = '';
      return;
    }

    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);

    this.selectedFile = file;
    this.previewUrl = URL.createObjectURL(file);
  }

  async uploadAvatar(): Promise<void> {
    if (!this.isOwnProfile || !this.selectedFile) {
      this.errorMessage = 'Primero selecciona una fotografía.';
      return;
    }

    this.uploadingAvatar = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const publicUrl = await this.avatarService.uploadAvatar(this.selectedFile);

      await this.profileService.updateAvatarUrl(publicUrl);

      this.avatarUrl = publicUrl;
      this.selectedFile = null;

      if (this.previewUrl) {
        URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = '';
      }

      this.successMessage = '¡Tu fotografía de perfil se ha actualizado!';
    } catch (error) {
      console.error('Error al subir la fotografía:', error);
      this.errorMessage = 'No hemos podido subir tu fotografía. Inténtalo de nuevo.';
    } finally {
      this.uploadingAvatar = false;
      this.changeDetector.detectChanges();
    }
  }

  // =====================================
  // MIS RESEÑAS
  // =====================================

  async loadMyReviews(): Promise<void> {
    if (!this.isOwnProfile) return;

    this.reviewsLoading = true;
    this.reviewsError = '';

    try {
      const reviews = await this.reviewsService.getMyReviews();

      this.myReviews = await Promise.all(
        reviews.map(async (review) => {
          let displayTitle =
            review.content_type === 'tv'
              ? 'Serie'
              : review.content_type === 'movie'
                ? 'Película'
                : review.content_type;
          let displayImage: string | null = null;

          try {
            if (review.content_source === 'tmdb') {
              const tmdbType: 'movie' | 'tv' = review.content_type === 'tv' ? 'tv' : 'movie';

              const content = await this.tmdb.getDetails(Number(review.content_id), tmdbType);
              displayTitle = content.title || content.name || displayTitle;
              const imagePath = content.backdrop_path || content.poster_path;
              displayImage = imagePath
                ? `https://image.tmdb.org/t/p/w780${imagePath}`
                : null;
            } else {
              const content = await this.communityCatalog.getById(review.content_id);
              const item = content as any;
              displayTitle = item?.title || displayTitle;
              displayImage =
                item?.backdrop_url ||
                item?.cover_url ||
                item?.poster_url ||
                item?.image_url ||
                (item?.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null) ||
                (item?.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null);
            }
          } catch (error) {
            console.warn('No se pudo recuperar el título de una reseña:', error);
          }

          return { ...review, displayTitle, displayImage };
        }),
      );
    } catch (error) {
      console.error('Error al cargar mis reseñas:', error);
      this.reviewsError = 'No hemos podido cargar tus reseñas. Inténtalo de nuevo.';
    } finally {
      this.reviewsLoading = false;
      this.changeDetector.detectChanges();
    }
  }

  openReviewedContent(review: ContentReview): void {
    if (review.content_source === 'tmdb') {
      void this.router.navigate(['/contenido', review.content_type, review.content_id]);
      return;
    }

    void this.router.navigate(['/ficha-comunidad', review.content_id]);
  }

  // =====================================
  // GUARDAR PERFIL
  // =====================================

  async saveProfile(): Promise<void> {
    if (!this.isOwnProfile || !this.showEditProfile || this.saving) return;

    const normalizedUsername = this.username.trim();
    const normalizedDisplayName = this.displayName.trim();
    const normalizedBio = this.bio.trim();
    const normalizedCategories = [...new Set(this.selectedCategories)];
    const normalizedInterests = this.categories
      .filter(category => normalizedCategories.includes(category.id))
      .map(category => category.name);

    if (!normalizedUsername) {
      this.errorMessage = 'El nombre de usuario es obligatorio.';
      return;
    }

    if (!normalizedDisplayName) {
      this.errorMessage = 'El nombre visible es obligatorio.';
      return;
    }

    if (this.websiteUrl.trim() && !/^https?:\/\//i.test(this.websiteUrl.trim())) {
      this.errorMessage = 'La página web debe comenzar por https:// o http://.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      // Primero subimos los archivos seleccionados. Las rutas de avatar y portada
      // son independientes dentro del bucket, por lo que no se sobrescriben.
      let nextAvatarUrl = this.avatarUrl || null;
      let nextCoverUrl = this.coverUrl || null;

      if (this.selectedFile) {
        this.uploadingAvatar = true;
        nextAvatarUrl = await this.avatarService.uploadAvatar(this.selectedFile);
      }

      if (this.selectedCoverFile) {
        this.uploadingCover = true;
        const adjustedCover = await this.createAdjustedCover(this.selectedCoverFile);
        nextCoverUrl = await this.avatarService.uploadCover(adjustedCover);
      }

      // Las preferencias usan la misma tabla/servicio que el onboarding.
      await this.preferencesService.saveMyPreferences(normalizedCategories);

      // Guardamos los datos visibles del perfil y sus etiquetas de intereses.
      await this.profileService.updateMyProfile({
        username: normalizedUsername,
        display_name: normalizedDisplayName,
        bio: normalizedBio || null,
        avatar_url: nextAvatarUrl,
        cover_url: nextCoverUrl,
        country: this.country.trim() || null,
        location: this.location.trim() || null,
        interests: normalizedInterests,
        website_url: this.websiteUrl.trim() || null,
        is_private: this.isPrivate,
        birthday_date: this.birthdayDate || null
      });

      this.selectedCategories = normalizedCategories;
      this.interestsText = normalizedInterests.join(', ');
      this.avatarUrl = nextAvatarUrl ?? '';
      this.coverUrl = nextCoverUrl ?? '';

      if (this.profile) {
        this.profile = {
          ...this.profile,
          username: normalizedUsername,
          display_name: normalizedDisplayName,
          bio: normalizedBio || null,
          avatar_url: nextAvatarUrl,
          cover_url: nextCoverUrl,
          country: this.country.trim() || null,
          location: this.location.trim() || null,
          interests: normalizedInterests,
          website_url: this.websiteUrl.trim() || null,
          is_private: this.isPrivate,
        birthday_date: this.birthdayDate || null
        };
      }

      this.selectedFile = null;
      this.selectedCoverFile = null;
      this.clearImagePreviews();
      this.showEditProfile = false;
      this.editSnapshot = null;
      this.successMessage = '¡Tu perfil se ha actualizado correctamente!';
    } catch (error) {
      console.error('Error al guardar el perfil:', error);
      this.errorMessage = 'No hemos podido guardar todos los cambios. Comprueba la conexión y los permisos de Storage e inténtalo de nuevo.';
    } finally {
      this.saving = false;
      this.uploadingAvatar = false;
      this.uploadingCover = false;
      this.changeDetector.detectChanges();
    }
  }

  goHome(): void {
    void this.router.navigate([this.isOwnProfile ? '/home' : '/explorar']);
  }
}
