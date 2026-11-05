import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private supabase = inject(SupabaseService);

  email = '';
  password = '';

  errorMessage = '';
  loading = false;

  private router = inject(Router);

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

      console.log('¡Sesión iniciada correctamente! 💜');
      await this.router.navigate(['/home']);

    } catch (error) {
      this.errorMessage = 'No se pudo conectar. Inténtalo de nuevo.';
      console.error(error);
    } finally {
      this.loading = false;
    }
  }
}
