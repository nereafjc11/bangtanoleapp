import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CommunityCategory } from '../models/community-catalog.model';

export interface CommunityCatalogItem {
  id: string; created_by: string; category_slug: string;
  content_type: CommunityCategory | string; title: string;
  original_title: string | null; release_year: number | null;
  overview: string | null; poster_url: string | null;
  country: string | null; genres: string[]; tmdb_id: number | null;
  details: Record<string, string | number | null>; created_at: string;
}
export interface CreateCommunityItemInput {
  category: CommunityCategory; title: string; original_title?: string | null;
  release_year?: number | null; overview?: string | null; country?: string | null;
  genres?: string[]; tmdb_id?: number | null; poster?: File | null;
  details?: Record<string, string | number | null>;
}

@Injectable({providedIn:'root'})
export class CommunityCatalogService {
  private readonly table = 'community_catalog_items';
  private readonly bucket = 'community-posters';
  constructor(private supabase: SupabaseService) {}

  private categorySlug(category: CommunityCategory): string {
    const slugs: Record<CommunityCategory,string> = {
      movie:'peliculas-series', tv:'peliculas-series', book:'libros',
      music:'musica', skincare:'skincare', fashion:'moda-estilo',
      travel:'viajes', other:'otros'
    };
    return slugs[category];
  }

  async findMatches(title: string, category: CommunityCategory) {
    const clean = title.trim();
    if (!clean) return [];
    const {data,error} = await this.supabase.client.from(this.table).select('*')
      .eq('category_slug',this.categorySlug(category)).eq('content_type',category)
      .ilike('title',`%${this.escapeLike(clean)}%`)
      .order('created_at',{ascending:false}).limit(12);
    if (error) throw error;
    return (data ?? []) as CommunityCatalogItem[];
  }

  async list(category: CommunityCategory) {
    const {data,error} = await this.supabase.client.from(this.table).select('*')
      .eq('category_slug',this.categorySlug(category)).eq('content_type',category)
      .order('created_at',{ascending:false}).limit(60);
    if (error) throw error;
    return (data ?? []) as CommunityCatalogItem[];
  }

  async getById(id: string) {
    const {data,error} = await this.supabase.client.from(this.table).select('*').eq('id',id).maybeSingle();
    if (error) throw error;
    return data as CommunityCatalogItem | null;
  }

  async create(input: CreateCommunityItemInput) {
    const {data:authData,error:authError} = await this.supabase.client.auth.getUser();
    if (authError || !authData.user) throw new Error('Inicia sesión para añadir una ficha.');
    const userId = authData.user.id;
    const title = input.title.trim();
    if (!title) throw new Error('Escribe un título antes de continuar.');
    const slug = this.categorySlug(input.category);

    const {data:matches,error:matchError} = await this.supabase.client.from(this.table)
      .select('id,title,release_year').eq('category_slug',slug).eq('content_type',input.category)
      .ilike('title',title).limit(5);
    if (matchError) throw matchError;
    const duplicate = (matches ?? []).find((row:any) =>
      row.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase() &&
      (row.release_year ?? 0) === (input.release_year ?? 0));
    if (duplicate) throw new Error('DUPLICATE:'+duplicate.id);

    let posterUrl: string | null = null;
    let uploadedPath: string | null = null;
    if (input.poster) {
      this.validatePoster(input.poster);
      const ext = input.poster.type === 'image/png' ? 'png' : input.poster.type === 'image/webp' ? 'webp' : 'jpg';
      uploadedPath = `${userId}/${crypto.randomUUID()}.${ext}`;
      const {error:uploadError} = await this.supabase.client.storage.from(this.bucket)
        .upload(uploadedPath,input.poster,{contentType:input.poster.type,upsert:false,cacheControl:'3600'});
      if (uploadError) throw uploadError;
      posterUrl = this.supabase.client.storage.from(this.bucket).getPublicUrl(uploadedPath).data.publicUrl;
    }

    const {data,error} = await this.supabase.client.from(this.table).insert({
      created_by:userId, category_slug:slug, content_type:input.category, title,
      original_title:input.original_title?.trim() || null,
      release_year:input.release_year ?? null, overview:input.overview?.trim() || null,
      poster_url:posterUrl, country:input.country?.trim() || null,
      genres:input.genres ?? [], tmdb_id:input.tmdb_id ?? null, details:input.details ?? {}
    }).select('*').single();

    if (error) {
      if (uploadedPath) await this.supabase.client.storage.from(this.bucket).remove([uploadedPath]);
      if ((error as any).code === '23505') throw new Error('Ya existe una ficha con ese título y año.');
      throw error;
    }
    return data as CommunityCatalogItem;
  }

  private validatePoster(file: File) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('La imagen debe ser JPG, PNG o WEBP.');
    if (file.size > 5*1024*1024) throw new Error('La imagen no puede superar los 5 MB.');
  }
  private escapeLike(value:string) { return value.replace(/[\\%_]/g,'\\$&'); }
}
