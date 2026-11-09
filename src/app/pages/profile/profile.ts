
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  ProfileService,
  UserProfile
} from '../../services/profile.service';

import { SupabaseService } from '../../services/supabase.service';
import { AvatarService } from '../../services/avatar.service';

type SocialListType = 'followers' | 'following';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit, OnDestroy {

  private profileService = inject(ProfileService);
  private avatarService = inject(AvatarService);
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

  email = '';
  username = '';
  displayName = '';
  bio = '';

  avatarUrl = '';
  selectedFile: File | null = null;
  previewUrl = '';

  loading = false;
  saving = false;
  uploadingAvatar = false;
  followLoading = false;

  followersCount = 0;
  followingCount = 0;
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

    return this.socialUsers.filter(person => {
      const name = (person.display_name ?? '').toLocaleLowerCase();
      const username = (person.username ?? '').toLocaleLowerCase();
      return name.includes(query) || username.includes(query);
    });
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const requestedId = params.get('id');
      void this.loadProfile(requestedId);
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();

    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
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
    this.avatarUrl = '';

    this.followersCount = 0;
    this.followingCount = 0;
    this.isFollowingUser = false;

    this.socialListType = null;
    this.socialUsers = [];
    this.socialListError = '';
    this.socialFollowStates = {};

    this.selectedFile = null;

    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = '';
    }

    try {
      const {
        data: { user },
        error
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
        this.avatarUrl = this.profile.avatar_url ?? '';

        if (!this.profile.display_name && registrationName) {
          await this.profileService.updateMyProfile({
            username: this.username || null,
            display_name: registrationName,
            bio: this.bio || null
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
        this.avatarUrl = this.profile.avatar_url ?? '';
      }

      if (currentRequest !== this.loadRequest) return;

      const [followers, following] = await Promise.all([
        this.profileService.getFollowersCount(this.profile.id),
        this.profileService.getFollowingCount(this.profile.id)
      ]);

      if (currentRequest !== this.loadRequest) return;

      this.followersCount = followers;
      this.followingCount = following;

      if (!this.isOwnProfile) {
        this.isFollowingUser = await this.profileService.isFollowing(
          this.profile.id
        );
      }

    } catch (error) {
      if (currentRequest !== this.loadRequest) return;

      console.error('Error al cargar el perfil:', error);
      this.errorMessage =
        'No hemos podido cargar este perfil. Inténtalo de nuevo.';

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
    const loadPromise = type === 'followers'
      ? this.profileService.getFollowers(profileId)
      : this.profileService.getFollowing(profileId);

    const timeoutPromise = new Promise<UserProfile[]>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error('La consulta está tardando demasiado. Comprueba tu conexión e inténtalo de nuevo.')
        );
      }, 15000);
    });

    const users = await Promise.race([
      loadPromise,
      timeoutPromise
    ]);

    if (requestId !== this.socialRequest) return;

    this.socialUsers = users;

    const states = await Promise.all(
      users
        .filter(person => person.id !== this.currentUserId)
        .map(async person => ({
          id: person.id,
          following: await this.profileService.isFollowing(person.id)
        }))
    );

    if (requestId !== this.socialRequest) return;

    this.socialFollowStates = {};
    for (const state of states) {
      this.socialFollowStates[state.id] = state.following;
    }

  } catch (error) {
    if (requestId !== this.socialRequest) return;

    console.error('Error cargando la lista social:', error);

    this.socialListError = error instanceof Error
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
    if (
      person.id === this.currentUserId ||
      this.socialFollowLoadingIds.has(person.id)
    ) {
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
      this.errorMessage =
        'No hemos podido actualizar el seguimiento. Inténtalo de nuevo.';

    } finally {
      this.followLoading = false;
      this.changeDetector.detectChanges();
    }
  }

  // =====================================
  // FOTOGRAFÍA DE PERFIL
  // =====================================

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

    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }

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
      const publicUrl = await this.avatarService.uploadAvatar(
        this.selectedFile
      );

      await this.profileService.updateAvatarUrl(publicUrl);

      this.avatarUrl = publicUrl;
      this.selectedFile = null;

      if (this.previewUrl) {
        URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = '';
      }

      this.successMessage =
        '¡Tu fotografía de perfil se ha actualizado!';

    } catch (error) {
      console.error('Error al subir la fotografía:', error);
      this.errorMessage =
        'No hemos podido subir tu fotografía. Inténtalo de nuevo.';

    } finally {
      this.uploadingAvatar = false;
      this.changeDetector.detectChanges();
    }
  }

  // =====================================
  // GUARDAR PERFIL
  // =====================================

  async saveProfile(): Promise<void> {
    if (!this.isOwnProfile) return;

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.profileService.updateMyProfile({
        username: this.username.trim() || null,
        display_name: this.displayName.trim() || null,
        bio: this.bio.trim() || null
      });

      this.successMessage =
        '¡Tu perfil se ha actualizado correctamente!';

    } catch (error) {
      console.error('Error al guardar el perfil:', error);
      this.errorMessage =
        'No hemos podido guardar los cambios. Inténtalo de nuevo.';

    } finally {
      this.saving = false;
      this.changeDetector.detectChanges();
    }
  }

  goHome(): void {
    void this.router.navigate([
      this.isOwnProfile ? '/home' : '/explorar'
    ]);
  }
}
