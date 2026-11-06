
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  nombre = '';
  email = '';
  password = '';
  confirmPassword = '';
  mensaje = '';
  cargando = false;

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

    this.cargando = true;

    try {
      const { data, error } =
        await this.supabaseService.client.auth.signUp({
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
      this.cargando = false;
    }
  }
}
