
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

  async getMyProfile(): Promise<UserProfile> {
    const {
      data: { user },
      error: userError
    } = await this.supabaseService.client.auth.getUser();

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

  async updateMyProfile(
    profile: Pick<UserProfile, 'username' | 'display_name' | 'bio'>
  ): Promise<void> {
    const {
      data: { user },
      error: userError
    } = await this.supabaseService.client.auth.getUser();

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

  async updateAvatarUrl(avatarUrl: string): Promise<void> {
    const {
      data: { user },
      error: userError
    } = await this.supabaseService.client.auth.getUser();

    if (userError || !user) {
      throw new Error('No hay ninguna usuaria autenticada.');
    }

    const { error } = await this.supabaseService.client
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id);

    if (error) {
      console.error('Error al guardar la fotografía:', error);
      throw error;
    }
  }

  // =====================================
  // SEGUIR Y DEJAR DE SEGUIR
  // =====================================

  async followUser(userId: string): Promise<void> {
    const {
      data: { user },
      error: userError
    } = await this.supabaseService.client.auth.getUser();

    if (userError || !user) {
      throw new Error('Debes iniciar sesión para seguir usuarios.');
    }

    if (user.id === userId) {
      throw new Error('No puedes seguirte a ti misma.');
    }

    const { error } = await this.supabaseService.client
      .from('follows')
      .insert({
        follower_id: user.id,
        following_id: userId
      });

    if (error) {
      console.error('Error al seguir al usuario:', error);
      throw error;
    }
  }

  async unfollowUser(userId: string): Promise<void> {
    const {
      data: { user },
      error: userError
    } = await this.supabaseService.client.auth.getUser();

    if (userError || !user) {
      throw new Error('Debes iniciar sesión para dejar de seguir usuarios.');
    }

    const { error } = await this.supabaseService.client
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', userId);

    if (error) {
      console.error('Error al dejar de seguir:', error);
      throw error;
    }
  }

  async isFollowing(userId: string): Promise<boolean> {
    const {
      data: { user },
      error: userError
    } = await this.supabaseService.client.auth.getUser();

    if (userError || !user) {
      return false;
    }

    const { data, error } = await this.supabaseService.client
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error comprobando seguimiento:', error);
      throw error;
    }

    return !!data;
  }

  // =====================================
  // CONTADORES
  // =====================================

  async getFollowersCount(userId: string): Promise<number> {
    const { count, error } = await this.supabaseService.client
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);

    if (error) {
      console.error('Error contando seguidores:', error);
      throw error;
    }

    return count ?? 0;
  }

  async getFollowingCount(userId: string): Promise<number> {
    const { count, error } = await this.supabaseService.client
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);

    if (error) {
      console.error('Error contando seguidos:', error);
      throw error;
    }

    return count ?? 0;
  }

  // =====================================
  // LISTAS DE SEGUIDORES Y SEGUIDOS
  // =====================================

  async getFollowers(userId: string): Promise<UserProfile[]> {
    const { data: relations, error } = await this.supabaseService.client
      .from('follows')
      .select('follower_id, created_at')
      .eq('following_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo seguidores:', error);
      throw error;
    }

    const ids = (relations ?? []).map(item => item.follower_id);

    if (ids.length === 0) {
      return [];
    }

    const { data: profiles, error: profilesError } =
      await this.supabaseService.client
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, created_at, updated_at')
        .in('id', ids);

    if (profilesError) {
      console.error('Error obteniendo perfiles de seguidores:', profilesError);
      throw profilesError;
    }

    const profileMap = new Map(
      (profiles ?? []).map(profile => [profile.id, profile as UserProfile])
    );

    return ids
      .map(id => profileMap.get(id))
      .filter((profile): profile is UserProfile => !!profile);
  }

  async getFollowing(userId: string): Promise<UserProfile[]> {
    const { data: relations, error } = await this.supabaseService.client
      .from('follows')
      .select('following_id, created_at')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo seguidos:', error);
      throw error;
    }

    const ids = (relations ?? []).map(item => item.following_id);

    if (ids.length === 0) {
      return [];
    }

    const { data: profiles, error: profilesError } =
      await this.supabaseService.client
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, created_at, updated_at')
        .in('id', ids);

    if (profilesError) {
      console.error('Error obteniendo perfiles seguidos:', profilesError);
      throw profilesError;
    }

    const profileMap = new Map(
      (profiles ?? []).map(profile => [profile.id, profile as UserProfile])
    );

    return ids
      .map(id => profileMap.get(id))
      .filter((profile): profile is UserProfile => !!profile);
  }
}
