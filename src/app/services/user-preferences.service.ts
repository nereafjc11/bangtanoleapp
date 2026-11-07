
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {

  constructor(
    private supabaseService: SupabaseService
  ) {}

  private async getCurrentUserId(): Promise<string> {
    const { data, error } =
      await this.supabaseService.client.auth.getUser();

    if (error || !data.user) {
      throw new Error('No hay ninguna usuaria autenticada.');
    }

    return data.user.id;
  }


async getMyPreferences(userId?: string): Promise<number[]> {
  console.log('1. [PREFERENCIAS] Iniciando consulta');

  const currentUserId = userId ?? await this.getCurrentUserId();

  console.log('2. [PREFERENCIAS] ID del usuario:', currentUserId);

  const { data, error } = await this.supabaseService.client
    .from('user_preferences')
    .select('category_id')
    .eq('user_id', currentUserId);

  console.log('3. [PREFERENCIAS] Datos recibidos:', data);
  console.log('4. [PREFERENCIAS] Error:', error);

  if (error) {
    console.error('Error al recuperar preferencias:', error);
    throw error;
  }

  const categoryIds = (data ?? []).map(
    item => Number(item.category_id)
  );

  console.log('5. [PREFERENCIAS] IDs de categorías:', categoryIds);

  return categoryIds;
}


  async saveMyPreferences(categoryIds: number[]): Promise<void> {
    const userId = await this.getCurrentUserId();

    const uniqueCategoryIds = [...new Set(categoryIds)];

    const { error: deleteError } = await this.supabaseService.client
      .from('user_preferences')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error al eliminar preferencias anteriores:', deleteError);
      throw deleteError;
    }

    if (uniqueCategoryIds.length === 0) {
      return;
    }

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
