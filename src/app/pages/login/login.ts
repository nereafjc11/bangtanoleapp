
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { OnboardingService } from '../../services/onboarding.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private supabase = inject(SupabaseService);
  private onboardingService = inject(OnboardingService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
showLoginPassword = false;
showRegisterPassword = false;
showConfirmPassword = false;
  mode: 'login' | 'register' = 'login';

  nombre = '';
  email = '';
  password = '';
  confirmPassword = '';

  errorMessage = '';
  mensaje = '';
  loading = false;

  ngOnInit() {
    this.route.data.subscribe(data => {
      this.mode = data['mode'] === 'register' ? 'register' : 'login';

      this.errorMessage = '';
      this.mensaje = '';
      this.password = '';
      this.confirmPassword = '';
    });
  }

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

      const completed =
        await this.onboardingService.isOnboardingCompleted();

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

  async registrarse() {
    this.mensaje = '';

    if (
      !this.nombre.trim() ||
      !this.email.trim() ||
      !this.password ||
      !this.confirmPassword
    ) {
      this.mensaje = 'Completa todos los campos 💜';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.mensaje = 'Las contraseñas no coinciden.';
      return;
    }

    if (this.password.length < 6) {
      this.mensaje = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    this.loading = true;

    try {
      const { data, error } =
        await this.supabase.client.auth.signUp({
          email: this.email.trim().toLowerCase(),
          password: this.password,
          options: {
            data: {
              nombre: this.nombre.trim(),
            },
          },
        });

      if (error) {
        this.mensaje = error.message;
        return;
      }

      if (data.session) {
        this.mensaje = '¡Cuenta creada correctamente! 💜';
        await this.router.navigate(['/preferences']);
      } else {
        this.mensaje =
          '¡Cuenta creada! Revisa tu correo y confirma tu dirección. Después inicia sesión para elegir tus preferencias. 💜';
      }

    } catch (error) {
      console.error('Error al registrarse:', error);
      this.mensaje = 'No se pudo crear la cuenta. Inténtalo de nuevo.';

    } finally {
      this.loading = false;
    }
  }
}
