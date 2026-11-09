
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {

  constructor(
    private supabaseService: SupabaseService
  ) {}

  /**
   * Recupera el perfil de la usuaria autenticada.
   */
  async getMyProfile(): Promise<UserProfile> {

    const { data: { user }, error: userError } =
      await this.supabaseService.client.auth.getUser();

    if (userError || !user) {
      throw new Error('No hay ninguna usuaria autenticada.');
    }

    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error al recuperar el perfil:', error);
      throw error;
    }

    return data as UserProfile;
  }

  /** Recupera un perfil público por su identificador. */
  async getPublicProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error al recuperar el perfil público:', error);
      throw error;
    }
    return data as UserProfile;
  }

  /**
   * Actualiza los datos personales de la usuaria.
   */
  async updateMyProfile(
    profile: Pick<UserProfile, 'username' | 'display_name' | 'bio'>
  ): Promise<void> {

    const { data: { user }, error: userError } =
      await this.supabaseService.client.auth.getUser();

    if (userError || !user) {
      throw new Error('No hay ninguna usuaria autenticada.');
    }

    const { error } = await this.supabaseService.client
      .from('profiles')
      .update({
        username: profile.username,
        display_name: profile.display_name,
        bio: profile.bio
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error al actualizar el perfil:', error);
      throw error;
    }
  }

  /**
   * Guarda la dirección de la fotografía en el perfil.
   */
  async updateAvatarUrl(avatarUrl: string): Promise<void> {

    const { data: { user }, error: userError } =
      await this.supabaseService.client.auth.getUser();

    if (userError || !user) {
      throw new Error('No hay ninguna usuaria autenticada.');
    }

    const { error } = await this.supabaseService.client
      .from('profiles')
      .update({
        avatar_url: avatarUrl
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error al guardar la fotografía:', error);
      throw error;
    }
  }

}
