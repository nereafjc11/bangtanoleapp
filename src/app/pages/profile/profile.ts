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

  private routeSubscription?: Subscription;
  private loadRequest = 0;
  private socialRequest = 0;
  currentUserId: string | null = null;
  socialFollowStates: Record<string, boolean> = {};
  socialFollowLoadingIds = new Set<string>();
  profile: UserProfile | null = null;

  isOwnProfile = true;

  myReviews: Array<ContentReview & { displayTitle: string }> = [];
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
  uploadingCover = false;
  private editSnapshot: {
    username: string; displayName: string; bio: string; country: string;
    location: string; interestsText: string; websiteUrl: string; isPrivate: boolean;
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

  startEditProfile(): void {
    if (!this.isOwnProfile) return;
    this.editSnapshot = {
      username: this.username, displayName: this.displayName, bio: this.bio,
      country: this.country, location: this.location, interestsText: this.interestsText,
      websiteUrl: this.websiteUrl, isPrivate: this.isPrivate
    };
    this.selectedFile = null;
    this.selectedCoverFile = null;
    this.clearImagePreviews();
    this.showEditProfile = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEditProfile(): void {
    if (this.editSnapshot) Object.assign(this, this.editSnapshot);
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
    this.errorMessage = '';
  }

  onAvatarSelected(event: Event): void {
    if (!this.isOwnProfile) return;

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

          try {
            if (review.content_source === 'tmdb') {
              const tmdbType: 'movie' | 'tv' = review.content_type === 'tv' ? 'tv' : 'movie';

              const content = await this.tmdb.getDetails(Number(review.content_id), tmdbType);
              displayTitle = content.title || content.name || displayTitle;
            } else {
              const content = await this.communityCatalog.getById(review.content_id);
              displayTitle = content?.title || displayTitle;
            }
          } catch (error) {
            console.warn('No se pudo recuperar el título de una reseña:', error);
          }

          return { ...review, displayTitle };
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
    if (!this.isOwnProfile || !this.showEditProfile) return;

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      let nextAvatarUrl = this.avatarUrl;
      let nextCoverUrl = this.coverUrl;

      if (this.selectedFile) {
        this.uploadingAvatar = true;
        nextAvatarUrl = await this.avatarService.uploadAvatar(this.selectedFile);
        await this.profileService.updateAvatarUrl(nextAvatarUrl);
        this.uploadingAvatar = false;
      }

      if (this.selectedCoverFile) {
        this.uploadingCover = true;
        nextCoverUrl = await this.avatarService.uploadCover(this.selectedCoverFile);
        await this.profileService.updateCoverUrl(nextCoverUrl);
        this.uploadingCover = false;
      }

      await this.profileService.updateMyProfile({
        username: this.username.trim() || null,
        display_name: this.displayName.trim() || null,
        bio: this.bio.trim() || null,
        cover_url: nextCoverUrl || null,
        country: this.country.trim() || null,
        location: this.location.trim() || null,
        interests: this.interestsText.split(',').map(value => value.trim()).filter(Boolean),
        website_url: this.websiteUrl.trim() || null,
        is_private: this.isPrivate
      });

      this.avatarUrl = nextAvatarUrl;
      this.coverUrl = nextCoverUrl;
      if (this.profile) {
        this.profile = {
          ...this.profile,
          username: this.username.trim() || null,
          display_name: this.displayName.trim() || null,
          bio: this.bio.trim() || null,
          avatar_url: nextAvatarUrl || null,
          cover_url: nextCoverUrl || null,
          country: this.country.trim() || null,
          location: this.location.trim() || null,
          interests: this.interestsText.split(',').map(value => value.trim()).filter(Boolean),
          website_url: this.websiteUrl.trim() || null,
          is_private: this.isPrivate
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
      this.errorMessage = 'No hemos podido guardar todos los cambios. Comprueba la conexión e inténtalo de nuevo.';
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
