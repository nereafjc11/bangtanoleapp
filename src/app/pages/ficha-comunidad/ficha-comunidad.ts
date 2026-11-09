import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommunityCatalogItem, CommunityCatalogService } from '../../services/community-catalog.service';
import { TmdbService } from '../../services/tmdb.service';

@Component({
  selector: 'app-ficha-comunidad',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ficha-comunidad.html',
  styleUrl: './ficha-comunidad.css'
})
export class FichaComunidad implements OnInit {
  item: CommunityCatalogItem | null = null;
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private community: CommunityCatalogService,
    public tmdb: TmdbService

  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'No se ha indicado qué ficha quieres ver.';
      this.loading = false;
      return;
    }
    try {
      this.item = await this.community.getById(id);
      if (!this.item) this.error = 'No hemos encontrado esa ficha comunitaria.';
    } catch {
      this.error = 'No se ha podido cargar la ficha. Inténtalo de nuevo.';
    } finally {
      this.loading = false;
    }
  }

  back() { void this.router.navigate(['/peliculas-series']); }
}
