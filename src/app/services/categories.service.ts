
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

@Injectable({
  providedIn: 'root'
})
export class CategoriesService {

  constructor(
    private supabaseService: SupabaseService
  ) {}

  /**
   * Obtiene todas las categorias activas
   * ordenadas por su posicion.
   */
  async getActiveCategories(): Promise<Category[]> {

    const { data, error } = await this.supabaseService.client
      .from('categories')
      .select('id, name, slug, description, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error al obtener categorias:', error);
      throw error;
    }

    return data ?? [];
  }
}
