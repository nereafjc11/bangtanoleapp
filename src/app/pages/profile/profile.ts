import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

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
export class Profile implements OnInit {
  private profileService = inject(ProfileService);
  private avatarService = inject(AvatarService);
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private changeDetector = inject(ChangeDetectorRef);

  profile: UserProfile | null = null;

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
    this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      const {
        data: { user },
        error,
      } = await this.supabase.client.auth.getUser();

      if (error || !user) {
        await this.router.navigate(['/auth/login']);
        return;
      }

      this.email = user.email ?? '';

      this.profile = await this.profileService.getMyProfile();

      const nombreRegistro = user.user_metadata?.['nombre'] ?? '';

      this.username = this.profile.username ?? '';

      this.displayName = this.profile.display_name || nombreRegistro;

      this.bio = this.profile.bio ?? '';

      this.avatarUrl = this.profile.avatar_url ?? '';

      if (!this.profile.display_name && nombreRegistro) {
        await this.profileService.updateMyProfile({
          username: this.username || null,
          display_name: nombreRegistro,
          bio: this.bio || null,
        });
      }
    } catch (error) {
      console.error('Error al cargar el perfil:', error);

      this.errorMessage = 'No hemos podido cargar tu perfil. Inténtalo de nuevo.';
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  /**
   * Selecciona una fotografía y prepara su vista previa.
   */
  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.errorMessage = '';
    this.successMessage = '';

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      this.errorMessage = 'Selecciona una imagen JPG, PNG o WEBP.';
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.errorMessage = 'La fotografía no puede superar los 2 MB.';
      input.value = '';
      return;
    }

    this.selectedFile = file;

    this.previewUrl = URL.createObjectURL(file);
  }

  /**
   * Sube la fotografía y guarda su URL en el perfil.
   */

  async uploadAvatar(): Promise<void> {
    if (!this.selectedFile) {
      this.errorMessage = 'Primero selecciona una fotografía.';
      return;
    }

    this.uploadingAvatar = true;
    this.errorMessage = '';
    this.successMessage = '';

    console.log('1. Iniciando subida de fotografía');

    try {
      console.log('2. Subiendo imagen a Storage');

      const publicUrl = await this.avatarService.uploadAvatar(this.selectedFile);

      console.log('3. Imagen subida:', publicUrl);

      console.log('4. Guardando URL en profiles');

      await this.profileService.updateAvatarUrl(publicUrl);

      console.log('5. URL guardada correctamente');

      this.avatarUrl = publicUrl;
      this.selectedFile = null;
      this.previewUrl = '';

      this.successMessage = '¡Tu fotografía de perfil se ha actualizado! 💜';
    } catch (error) {
      console.error('Error al subir la fotografía:', error);

      this.errorMessage = 'No hemos podido subir tu fotografía. Inténtalo de nuevo.';
    } finally {
      console.log('6. Finalizando subida');

      this.uploadingAvatar = false;

      this.changeDetector.detectChanges();
    }
  }

  /**
   * Guarda los datos personales.
   */
  async saveProfile(): Promise<void> {
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.profileService.updateMyProfile({
        username: this.username.trim() || null,
        display_name: this.displayName.trim() || null,
        bio: this.bio.trim() || null,
      });

      this.successMessage = '¡Tu perfil se ha actualizado correctamente! 💜';
    } catch (error) {
      console.error('Error al guardar el perfil:', error);

      this.errorMessage = 'No hemos podido guardar los cambios. Inténtalo de nuevo.';
    } finally {
      this.saving = false;
      this.changeDetector.detectChanges();
    }
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}
