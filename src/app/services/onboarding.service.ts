
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class OnboardingService {

  constructor(private supabaseService: SupabaseService) {}

  async isOnboardingCompleted(): Promise<boolean> {
    const { data: { user }, error: userError } =
      await this.supabaseService.client.auth.getUser();

    if (userError || !user) {
      throw new Error('No hay ninguna usuaria autenticada.');
    }

    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error al consultar el estado inicial:', error);
      throw error;
    }

    return data.onboarding_completed;
  }

  async completeOnboarding(): Promise<void> {
    const { data: { user }, error: userError } =
      await this.supabaseService.client.auth.getUser();

    if (userError || !user) {
      throw new Error('No hay ninguna usuaria autenticada.');
    }

    const { error } = await this.supabaseService.client
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);

    if (error) {
      console.error('Error al completar la configuración:', error);
      throw error;
    }
  }
}
