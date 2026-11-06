
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { OnboardingService } from '../../services/onboarding.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private supabase = inject(SupabaseService);
  private onboardingService = inject(OnboardingService);
  private router = inject(Router);

  email = '';
  password = '';
  errorMessage = '';
  loading = false;

  async login() {
    this.errorMessage = '';

    if (!this.email.trim() || !this.password) {
      this.errorMessage = 'Introduce tu correo y contraseña 💜';
      return;
    }

    this.loading = true;

    try {
      const { error } = await this.supabase.client.auth.signInWithPassword({
        email: this.email.trim().toLowerCase(),
        password: this.password,
      });

      if (error) {
        this.errorMessage = 'Correo o contraseña incorrectos.';
        return;
      }

      // Comprobar si la usuaria ya terminó su configuración inicial
      const completed = await this.onboardingService.isOnboardingCompleted();

      if (completed) {
        await this.router.navigate(['/home']);
      } else {
        await this.router.navigate(['/preferences']);
      }

    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      this.errorMessage = 'No se pudo iniciar sesión. Inténtalo de nuevo.';

    } finally {
      this.loading = false;
    }
  }
}
