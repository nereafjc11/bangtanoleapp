
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  cover_url: string | null;
  country: string | null;
  location: string | null;
  interests: string[];
  website_url: string | null;
  birthday_date: string | null;
  is_private: boolean;
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
      .select('id, username, display_name, avatar_url, bio, cover_url, country, location, interests, website_url, birthday_date, is_private, created_at, updated_at')
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
      .select('id, username, display_name, avatar_url, bio, cover_url, country, location, interests, website_url, birthday_date, is_private, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error al recuperar el perfil público:', error);
      throw error;
    }

    return data as UserProfile;
  }

  async getPublicProfiles(userIds: string[]): Promise<UserProfile[]> {
    const uniqueIds = [...new Set(userIds)].filter(Boolean);

    if (!uniqueIds.length) {
      return [];
    }

    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, cover_url, country, location, interests, website_url, birthday_date, is_private, created_at, updated_at')
      .in('id', uniqueIds);

    if (error) {
      console.error('Error al recuperar los perfiles públicos:', error);
      throw error;
    }

    return (data ?? []) as UserProfile[];
  }

  async updateMyProfile(
    profile: Pick<UserProfile, 'username' | 'display_name' | 'bio'> & Partial<Pick<UserProfile, 'avatar_url' | 'cover_url' | 'country' | 'location' | 'interests' | 'website_url' | 'birthday_date' | 'is_private'>>
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
        bio: profile.bio,
        ...(profile.avatar_url !== undefined ? { avatar_url: profile.avatar_url } : {}),
        ...(profile.cover_url !== undefined ? { cover_url: profile.cover_url } : {}),
        ...(profile.country !== undefined ? { country: profile.country } : {}),
        ...(profile.location !== undefined ? { location: profile.location } : {}),
        ...(profile.interests !== undefined ? { interests: profile.interests } : {}),
        ...(profile.website_url !== undefined ? { website_url: profile.website_url } : {}),
        ...(profile.birthday_date !== undefined ? { birthday_date: profile.birthday_date } : {}),
        ...(profile.is_private !== undefined ? { is_private: profile.is_private } : {})
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error al actualizar el perfil:', error);
      throw error;
    }
  }

  async updateCoverUrl(coverUrl: string): Promise<void> {
    const { data: { user }, error: userError } =
      await this.supabaseService.client.auth.getUser();

    if (userError || !user) {
      throw new Error('No hay ninguna usuaria autenticada.');
    }

    const { error } = await this.supabaseService.client
      .from('profiles')
      .update({ cover_url: coverUrl })
      .eq('id', user.id);

    if (error) {
      console.error('Error al guardar la portada:', error);
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

  async getListsCount(userId: string): Promise<number> {
    const { count, error } = await this.supabaseService.client
      .from('user_lists')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_public', true);
    if (error) throw error;
    return count ?? 0;
  }

  async getFavoritesCount(userId: string): Promise<number> {
    const { count, error } = await this.supabaseService.client
      .from('content_favorites')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) throw error;
    return count ?? 0;
  }

  async getReviewsCount(userId: string): Promise<number> {
    const { count, error } = await this.supabaseService.client
      .from('content_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) throw error;
    return count ?? 0;
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

  /**
   * Devuelve las personas a las que este perfil sigue y que también le siguen.
   */
  async getMutualFriends(userId: string): Promise<UserProfile[]> {
    const [followers, following] = await Promise.all([
      this.getFollowers(userId),
      this.getFollowing(userId)
    ]);

    const followerIds = new Set(followers.map(person => person.id));
    return following.filter(person => followerIds.has(person.id));
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
        .select('id, username, display_name, avatar_url, bio, cover_url, country, location, interests, website_url, birthday_date, is_private, created_at, updated_at')
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
        .select('id, username, display_name, avatar_url, bio, cover_url, country, location, interests, website_url, birthday_date, is_private, created_at, updated_at')
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
