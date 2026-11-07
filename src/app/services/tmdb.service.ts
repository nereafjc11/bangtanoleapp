
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type CatalogSection =
  | 'movie'
  | 'tv'
  | 'anime'
  | 'variety';

export type CountryFilter =
  | 'all'
  | 'korea'
  | 'china'
  | 'japan'
  | 'thailand'
  | 'international';

export type VarietyFormat =
  | 'all'
  | 'reality'
  | 'talk'
  | 'documentary';

export interface CatalogItem {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  original_language: string;
  origin_country?: string[];
  genre_ids?: number[];
  popularity?: number;
}

export interface CatalogResponse {
  page: number;
  results: CatalogItem[];
  total_pages: number;
  total_results: number;
}

export interface PersonItem {
  id: number;
  name: string;
  known_for_department?: string;
  profile_path: string | null;
  known_for?: CatalogItem[];
  popularity?: number;
}

export interface PersonSearchResponse {
  page: number;
  results: PersonItem[];
  total_pages: number;
  total_results: number;
}

@Injectable({
  providedIn: 'root'
})
export class TmdbService {
  private readonly imageBaseUrl =
    'https://image.tmdb.org/t/p/';

  constructor(
    private supabaseService: SupabaseService
  ) {}

  // =====================================
  // BÚSQUEDA POR TÍTULO
  // =====================================

  async search(
    query: string,
    type: 'movie' | 'tv' = 'movie',
    page = 1
  ): Promise<CatalogItem[]> {
    const { data, error } =
      await this.supabaseService.client.functions.invoke(
        'super-task',
        {
          body: {
            action: 'search',
            query,
            type,
            page
          }
        }
      );

    if (error) {
      console.error('Error buscando en TMDB:', error);
      throw error;
    }

    return data?.results ?? [];
  }

  // =====================================
  // BÚSQUEDA DE PERSONAS
  // =====================================

  async searchPeople(
    query: string,
    page = 1
  ): Promise<PersonSearchResponse> {
    const { data, error } =
      await this.supabaseService.client.functions.invoke(
        'super-task',
        {
          body: {
            action: 'personSearch',
            query,
            page
          }
        }
      );

    if (error) {
      console.error(
        'Error buscando personas en TMDB:',
        error
      );
      throw error;
    }

    return data as PersonSearchResponse;
  }

  // =====================================
  // DESCUBRIR CATÁLOGO
  // =====================================

  async discover(
    section: CatalogSection = 'movie',
    country: CountryFilter = 'all',
    format: VarietyFormat = 'all',
    page = 1,
    year?: number | null,
    personId?: number | null
  ): Promise<CatalogResponse> {
    const { data, error } =
      await this.supabaseService.client.functions.invoke(
        'super-task',
        {
          body: {
            action: 'discover',
            section,
            country,
            format,
            page,
            year: year ?? null,
            personId: personId ?? null
          }
        }
      );

    if (error) {
      console.error(
        'Error cargando el catálogo:',
        error
      );
      throw error;
    }

    return data as CatalogResponse;
  }

  // =====================================
  // DETALLES DE PELÍCULA O SERIE
  // =====================================

  async getDetails(
    id: number,
    type: 'movie' | 'tv' = 'movie'
  ): Promise<any> {
    const { data, error } =
      await this.supabaseService.client.functions.invoke(
        'super-task',
        {
          body: {
            action: 'details',
            id,
            type
          }
        }
      );

    if (error) {
      console.error(
        'Error cargando la ficha:',
        error
      );
      throw error;
    }

    return data;
  }

  // =====================================
  // IMÁGENES
  // =====================================

  getPoster(
    path: string | null,
    size = 'w500'
  ): string {
    return path
      ? `${this.imageBaseUrl}${size}${path}`
      : 'assets/images/no-poster.png';
  }

  getBackdrop(
    path: string | null,
    size = 'w1280'
  ): string {
    return path
      ? `${this.imageBaseUrl}${size}${path}`
      : '';
  }

  getProfile(
    path: string | null,
    size = 'w185'
  ): string {
    return path
      ? `${this.imageBaseUrl}${size}${path}`
      : 'assets/images/no-avatar.png';
  }
}
