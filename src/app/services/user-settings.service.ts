
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface UserSettings {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  notifications?: boolean;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {

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
   * Recupera los ajustes personales.
   */
  async getMySettings(): Promise<UserSettings> {

    const userId = await this.getCurrentUserId();

    const { data, error } = await this.supabaseService.client
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error al recuperar ajustes:', error);
      throw error;
    }

    return data?.settings ?? {};
  }

  /**
   * Guarda o actualiza los ajustes personales.
   */
  async saveMySettings(settings: UserSettings): Promise<void> {

    const userId = await this.getCurrentUserId();

    const { error } = await this.supabaseService.client
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          settings,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'user_id'
        }
      );

    if (error) {
      console.error('Error al guardar ajustes:', error);
      throw error;
    }
  }
}
