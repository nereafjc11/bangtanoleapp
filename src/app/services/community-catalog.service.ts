import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface CommunityCatalogItem {
  id: string;
  created_by: string;
  category_slug: string;
  content_type: 'movie' | 'tv';
  title: string;
  original_title: string | null;
  release_year: number | null;
  overview: string | null;
  poster_url: string | null;
  country: string | null;
  genres: string[];
  tmdb_id: number | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class CommunityCatalogService {
  private readonly table = 'community_catalog_items';
  private readonly bucket = 'community-posters';

  constructor(private supabase: SupabaseService) {}

  async findMatches(title: string, type: 'movie' | 'tv') {
    const clean = title.trim();
    if (!clean) return [];

    const { data, error } = await this.supabase.client
      .from(this.table)
      .select('*')
      .eq('category_slug', 'peliculas-series')
      .eq('content_type', type)
      .ilike('title', `%${this.escapeLike(clean)}%`)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) throw error;
    return (data ?? []) as CommunityCatalogItem[];
  }

  async list(type: 'movie' | 'tv') {
    const { data, error } = await this.supabase.client
      .from(this.table)
      .select('*')
      .eq('category_slug', 'peliculas-series')
      .eq('content_type', type)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) throw error;
    return (data ?? []) as CommunityCatalogItem[];
  }

  async getById(id: string) {
    const { data, error } = await this.supabase.client
      .from(this.table)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as CommunityCatalogItem | null;
  }

  async create(input: {
    title: string;
    original_title?: string | null;
    content_type: 'movie' | 'tv';
    release_year?: number | null;
    overview?: string | null;
    country?: string | null;
    genres?: string[];
    tmdb_id?: number | null;
    poster?: File | null;
  }) {
    const { data: authData, error: authError } = await this.supabase.client.auth.getUser();
    if (authError || !authData.user) throw new Error('Inicia sesión para añadir una ficha.');

    const userId = authData.user.id;
    const title = input.title.trim();
    if (!title) throw new Error('Escribe el título de la película o serie.');

    // Revisión final en servidor antes de publicar.
    const { data: matches, error: matchError } = await this.supabase.client
      .from(this.table)
      .select('id,title,release_year')
      .eq('category_slug', 'peliculas-series')
      .eq('content_type', input.content_type)
      .ilike('title', title)
      .limit(5);

    if (matchError) throw matchError;
    const same = (matches ?? []).find((item: any) =>
      (item.title ?? '').trim().toLocaleLowerCase() === title.toLocaleLowerCase() &&
      (item.release_year ?? 0) === (input.release_year ?? 0)
    );
    if (same) {
      throw new Error('DUPLICATE:' + same.id);
    }

    let posterUrl: string | null = null;
    let uploadedPath: string | null = null;

    if (input.poster) {
      this.validatePoster(input.poster);
      const extension = input.poster.type === 'image/png' ? 'png'
        : input.poster.type === 'image/webp' ? 'webp' : 'jpg';
      uploadedPath = `${userId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await this.supabase.client.storage
        .from(this.bucket)
        .upload(uploadedPath, input.poster, {
          contentType: input.poster.type,
          upsert: false,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;
      posterUrl = this.supabase.client.storage.from(this.bucket).getPublicUrl(uploadedPath).data.publicUrl;
    }

    const { data, error } = await this.supabase.client
      .from(this.table)
      .insert({
        created_by: userId,
        category_slug: 'peliculas-series',
        content_type: input.content_type,
        title,
        original_title: input.original_title?.trim() || null,
        release_year: input.release_year ?? null,
        overview: input.overview?.trim() || null,
        poster_url: posterUrl,
        country: input.country?.trim() || null,
        genres: input.genres ?? [],
        tmdb_id: input.tmdb_id ?? null
      })
      .select('*')
      .single();

    if (error) {
      if (uploadedPath) {
        await this.supabase.client.storage.from(this.bucket).remove([uploadedPath]);
      }
      if ((error as any).code === '23505') {
        throw new Error('Ya existe una ficha con ese título y año.');
      }
      throw error;
    }

    return data as CommunityCatalogItem;
  }

  private validatePoster(file: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      throw new Error('El póster debe ser JPG, PNG o WEBP.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('El póster no puede superar los 5 MB.');
    }
  }

  private escapeLike(value: string) {
    return value.replace(/[\\%_]/g, '\\$&');
  }
}
