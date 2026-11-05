
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {

  private supabase = inject(SupabaseService);
  private router = inject(Router);

  email = '';

async ngOnInit() {
  const { data } = await this.supabase.client.auth.getSession();

  if (!data.session) {
    await this.router.navigate(['/auth/login']);
    return;
  }

  this.email = data.session.user.email ?? '';
}

  async cerrarSesion() {
    const { error } = await this.supabase.client.auth.signOut();

    if (error) {
      console.error('Error al cerrar sesión:', error.message);
      return;
    }

    await this.router.navigate(['/auth/login']);
  }
}
