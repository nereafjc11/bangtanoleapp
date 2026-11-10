
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ContentReference } from './reviews.service';

export interface ContentFavorite {
  id: string;
  user_id: string;
  content_source: 'tmdb' | 'community';
  content_type: string;
  content_id: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly table = 'content_favorites';

  constructor(private supabase: SupabaseService) {}

  async addFavorite(
    content: ContentReference
  ): Promise<ContentFavorite> {
    const user = await this.getUser();

    const { data, error } = await this.supabase.client
      .from(this.table)
      .upsert(
        {
          user_id: user.id,
          content_source: content.source,
          content_type: content.type,
          content_id: String(content.id),
        },
        {
          onConflict:
            'user_id,content_source,content_type,content_id',
        }
      )
      .select('*')
      .single();

    if (error) throw error;

    return data as ContentFavorite;
  }

  async removeFavorite(
    content: ContentReference
  ): Promise<void> {
    const user = await this.getUser();

    const { error } = await this.supabase.client
      .from(this.table)
      .delete()
      .eq('user_id', user.id)
      .eq('content_source', content.source)
      .eq('content_type', content.type)
      .eq('content_id', String(content.id));

    if (error) throw error;
  }

  async isFavorite(
    content: ContentReference
  ): Promise<boolean> {
    const user = await this.getUser();

    const { data, error } = await this.supabase.client
      .from(this.table)
      .select('id')
      .eq('user_id', user.id)
      .eq('content_source', content.source)
      .eq('content_type', content.type)
      .eq('content_id', String(content.id))
      .maybeSingle();

    if (error) throw error;

    return !!data;
  }

  async getMyFavorites(): Promise<ContentFavorite[]> {
    const user = await this.getUser();

    const { data, error } = await this.supabase.client
      .from(this.table)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []) as ContentFavorite[];
  }

  private async getUser() {
    const { data, error } =
      await this.supabase.client.auth.getUser();

    if (error || !data.user) {
      throw new Error('Debes iniciar sesión para realizar esta acción.');
    }

    return data.user;
  }
}
