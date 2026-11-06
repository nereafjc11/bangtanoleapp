
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {

  constructor(
    private supabaseService: SupabaseService
  ) {}

  /**
   * Obtiene el ID de la usuaria autenticada.
   */
  private async getCurrentUserId(): Promise<string> {

    const { data, error } =
      await this.supabaseService.client.auth.getUser();

    if (error || !data.user) {
      throw new Error('No hay ninguna usuaria autenticada.');
    }

    return data.user.id;
  }

  /**
   * Recupera las categorias seleccionadas
   * por la usuaria actual.
   */
  async getMyPreferences(): Promise<number[]> {

    const userId = await this.getCurrentUserId();

    const { data, error } = await this.supabaseService.client
      .from('user_preferences')
      .select('category_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error al recuperar preferencias:', error);
      throw error;
    }

    return (data ?? []).map(item => item.category_id);
  }

  /**
   * Guarda las categorias seleccionadas.
   * Sustituye las preferencias anteriores.
   */
  async saveMyPreferences(categoryIds: number[]): Promise<void> {

    const userId = await this.getCurrentUserId();

    // Eliminar posibles duplicados.
    const uniqueCategoryIds = [...new Set(categoryIds)];

    // Eliminar las preferencias anteriores.
    const { error: deleteError } = await this.supabaseService.client
      .from('user_preferences')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error al eliminar preferencias anteriores:', deleteError);
      throw deleteError;
    }

    // Si no hay categorias seleccionadas,
    // la usuaria se queda sin preferencias.
    if (uniqueCategoryIds.length === 0) {
      return;
    }

    // Guardar las nuevas preferencias.
    const preferences = uniqueCategoryIds.map(categoryId => ({
      user_id: userId,
      category_id: categoryId
    }));

    const { error: insertError } = await this.supabaseService.client
      .from('user_preferences')
      .insert(preferences);

    if (insertError) {
      console.error('Error al guardar preferencias:', insertError);
      throw insertError;
    }
  }
}
