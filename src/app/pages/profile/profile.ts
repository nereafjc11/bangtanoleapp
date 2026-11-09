import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { ProfileService, UserProfile } from '../../services/profile.service';

import { SupabaseService } from '../../services/supabase.service';
import { AvatarService } from '../../services/avatar.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
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

  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    // Escucha los cambios de usuario en la URL.
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
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
        this.avatarUrl = this.profile.avatar_url ?? '';
      }
    } catch (error) {
      if (currentRequest !== this.loadRequest) return;

      console.error('Error al cargar el perfil:', error);

      this.errorMessage =
        'No hemos podido cargar este perfil. Puede que no esté disponible o que no tengas permiso para verlo.';
    } finally {
      if (currentRequest === this.loadRequest) {
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    }
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

  async saveProfile(): Promise<void> {
    if (!this.isOwnProfile) return;

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.profileService.updateMyProfile({
        username: this.username.trim() || null,
        display_name: this.displayName.trim() || null,
        bio: this.bio.trim() || null,
      });

      this.successMessage = '¡Tu perfil se ha actualizado correctamente!';
    } catch (error) {
      console.error('Error al guardar el perfil:', error);

      this.errorMessage = 'No hemos podido guardar los cambios. Inténtalo de nuevo.';
    } finally {
      this.saving = false;
      this.changeDetector.detectChanges();
    }
  }

  goHome(): void {
    void this.router.navigate([this.isOwnProfile ? '/home' : '/explorar']);
  }
}
