
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
    this.mensaje = 'Las contraseñas no coinciden';
    return;
  }

  if (this.password.length < 6) {
    this.mensaje = 'La contraseña debe tener al menos 6 caracteres';
    return;
  }

  this.cargando = true;
  this.mensaje = '';

  try {
    const { data, error } =
      await this.supabaseService.client.auth.signUp({
        email: this.email.trim().toLowerCase(),
        password: this.password,
        options: {
          data: {
            nombre: this.nombre.trim()
          }
        }
      });

    if (error) {
      this.mensaje = error.message;
      return;
    }

    if (data.session) {
      this.mensaje = '¡Bienvenida a Bangtanole! 💜';
      this.cargando = false;
      await this.router.navigate(['/home']);
      return;
    }

    this.mensaje =
      '¡Cuenta creada! Revisa tu correo para confirmar tu cuenta. 💜';

  } catch (error) {
    console.error(error);
    this.mensaje = 'No se pudo completar el registro. Inténtalo de nuevo.';
  } finally {
    this.cargando = false;
  }
}

}
