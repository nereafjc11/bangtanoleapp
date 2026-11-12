
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommunityCatalogService, CommunityCatalogItem } from '../../services/community-catalog.service';
import { CommunityCategory } from '../../models/community-catalog.model';

interface CatalogItem {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  image?: string;
  tags: string[];
}

interface CatalogConfig {
  title: string;
  description: string;
  searchPlaceholder: string;
  filters: string[];
}

@Component({
  selector: 'app-catalogo-dinamico',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './catalogo-dinamico.html',
  styleUrl: './catalogo-dinamico.css'
})
export class CatalogoDinamico implements OnInit {

  categoriaActual = 'libros';
  busqueda = '';
  filtroActual = 'Todos';
  vista: 'grid' | 'list' = 'grid';

  categorias = [
    { id: 'series-peliculas', nombre: 'Series y películas', icono: '🎬' },
    { id: 'skincare-y-belleza', nombre: 'Skincare y belleza', icono: '✨' },
    { id: 'musica', nombre: 'Música', icono: '🎧' },
    { id: 'libros', nombre: 'Libros', icono: '📚' },
    { id: 'moda-y-estilo', nombre: 'Moda y estilo', icono: '👜' },
    { id: 'otros', nombre: 'Otros', icono: '✳️' },
    { id: 'viajes', nombre: 'Viajes', icono: '🗺️' }
  ];

  configuraciones: Record<string, CatalogConfig> = {
    libros: {
      title: 'Libros',
      description: 'Descubre libros, autores e historias para añadir a tu colección.',
      searchPlaceholder: 'Buscar libros o autores...',
      filters: ['Todos', 'Novela', 'Romance', 'Fantasía', 'Misterio', 'Ciencia ficción', 'Ensayo', 'Poesía']
    },
    musica: {
      title: 'Música',
      description: 'Explora artistas, álbumes y canciones.',
      searchPlaceholder: 'Buscar artistas, álbumes o canciones...',
      filters: ['Todos', 'Artistas', 'Álbumes', 'Canciones', 'K-pop', 'Pop', 'Rock', 'Otros']
    },
    'skincare-y-belleza': {
      title: 'Skincare y belleza',
      description: 'Descubre productos, marcas y recomendaciones de belleza.',
      searchPlaceholder: 'Buscar productos o marcas...',
      filters: ['Todos', 'Limpiadores', 'Hidratantes', 'Protectores solares', 'Sérums', 'Maquillaje', 'Labios', 'Ojos', 'Rostro']
    },
    'moda-y-estilo': {
      title: 'Moda y estilo',
      description: 'Guarda prendas, accesorios, marcas e inspiración de estilo.',
      searchPlaceholder: 'Buscar prendas, accesorios o marcas...',
      filters: ['Todos', 'Ropa', 'Calzado', 'Bolsos', 'Accesorios', 'Marcas', 'Otros']
    },
    otros: {
      title: 'Otros',
      description: 'Añade y descubre contenido que no encaje en las demás categorías.',
      searchPlaceholder: 'Buscar contenido...',
      filters: ['Todos', 'Lugares', 'Productos', 'Experiencias', 'Coleccionables', 'Otros']
    },
    viajes: {
      title: 'Viajes',
      description: 'Descubre países, ciudades, lugares y experiencias para recordar.',
      searchPlaceholder: 'Buscar países, ciudades o lugares...',
      filters: ['Todos', 'Países', 'Ciudades', 'Lugares', 'Alojamientos', 'Restaurantes', 'Experiencias']
    }
  };

  elementos: import('../../services/community-catalog.service').CommunityCatalogItem[] = [];
  loading = false;
  error = '';
  private loadRequest = 0;

  get iconoCategoria(): string {
    return this.categorias.find(
      categoria => categoria.id === this.categoriaActual
    )?.icono || '✨';
  }

  private normalizarCategoria(slug: string): string {
    const valor = slug.toLowerCase().trim();

    const equivalencias: Record<string, string> = {
      'skincare': 'skincare-y-belleza',
      'belleza': 'skincare-y-belleza',
      'skincare-belleza': 'skincare-y-belleza',
      'skincare-y-belleza': 'skincare-y-belleza',
      'moda': 'moda-y-estilo',
      'moda-estilo': 'moda-y-estilo',
      'moda-y-estilo': 'moda-y-estilo',
      'series-y-peliculas': 'series-peliculas',
      'peliculas-series': 'series-peliculas',
      'series-peliculas': 'series-peliculas'
    };

    return equivalencias[valor] || valor;
  }

  constructor(private route: ActivatedRoute, private router: Router, private community: CommunityCatalogService) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('categoria')?.toLowerCase() || 'libros';
      const categoria = this.normalizarCategoria(slug);

      // Películas y series tienen su catálogo TMDB propio.
      if (categoria === 'series-peliculas') {
        void this.router.navigate(['/peliculas-series']);
        return;
      }

      this.categoriaActual = this.configuraciones[categoria] ? categoria : 'otros';
      this.busqueda = '';
      this.filtroActual = 'Todos';
      void this.cargarElementos();
    });
  }

  get configuracion(): CatalogConfig {
    return this.configuraciones[this.categoriaActual];
  }

  private async cargarElementos(): Promise<void> {
    const categoryMap: Record<string, CommunityCategory> = {
      libros: 'book',
      musica: 'music',
      'skincare-y-belleza': 'skincare',
      'moda-y-estilo': 'fashion',
      otros: 'other',
      viajes: 'travel'
    };
    const category = categoryMap[this.categoriaActual];
    if (!category) {
      this.elementos = [];
      return;
    }

    const request = ++this.loadRequest;
    this.loading = true;
    this.error = '';
    this.elementos = [];
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('CATALOG_TIMEOUT')), 15000)
      );
      const items = await Promise.race([this.community.list(category), timeout]);
      if (request !== this.loadRequest) return;
      this.elementos = items ?? [];
    } catch (error) {
      if (request !== this.loadRequest) return;
      console.error('Error cargando el catálogo comunitario:', error);
      this.error = error instanceof Error && error.message === 'CATALOG_TIMEOUT'
        ? 'La conexión está tardando demasiado. Comprueba tu conexión e inténtalo de nuevo.'
        : 'No hemos podido cargar este catálogo. Revisa la conexión con Supabase e inténtalo de nuevo.';
      this.elementos = [];
    } finally {
      if (request === this.loadRequest) this.loading = false;
    }
  }

  private normalizeFilter(value: unknown): string {
    return String(value ?? '').toLocaleLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/s$/, '').trim();
  }

  get elementosFiltrados(): CommunityCatalogItem[] {
    const query = this.busqueda.trim().toLocaleLowerCase();
    return this.elementos.filter(item => {
      const details = Object.values(item.details ?? {}).join(' ');
      const tags = (item.genres ?? []).join(' ');
      const text = [
        item.title, item.original_title ?? '', item.overview ?? '',
        item.country ?? '', tags, details
      ].join(' ').toLocaleLowerCase();
      const category = this.categoriaActual === 'skincare-y-belleza'
        ? String(item.details?.['productType'] ?? '')
        : this.categoriaActual === 'moda-y-estilo'
          ? String(item.details?.['itemType'] ?? '')
          : this.categoriaActual === 'libros'
            ? String(item.details?.['author'] ?? '')
            : this.categoriaActual === 'musica'
              ? String(item.details?.['artist'] ?? '')
              : this.categoriaActual === 'viajes'
                ? String(item.details?.['placeType'] ?? '')
                : String(item.details?.['itemType'] ?? '');

      const matchesSearch = !query || text.includes(query);
      const selectedFilter = this.normalizeFilter(this.filtroActual);
      const matchesFilter = this.filtroActual === 'Todos' ||
        this.normalizeFilter(tags).includes(selectedFilter) ||
        this.normalizeFilter(category).includes(selectedFilter);
      return matchesSearch && matchesFilter;
    });
  }

  getTitle(item: CommunityCatalogItem): string {
    return item.title;
  }

  getSubtitle(item: CommunityCatalogItem): string {
    const details = item.details ?? {};
    const preferred = this.categoriaActual === 'skincare-y-belleza' || this.categoriaActual === 'moda-y-estilo'
      ? details['brand']
      : this.categoriaActual === 'libros' ? details['author']
      : this.categoriaActual === 'musica' ? details['artist']
      : this.categoriaActual === 'viajes' ? (details['city'] || details['destination'] || item.country)
      : (item.country || item.original_title);
    return preferred == null || String(preferred).trim() === ''
      ? (item.release_year ? String(item.release_year) : this.configuracion.title)
      : String(preferred);
  }

  getCardCategory(item: CommunityCatalogItem): string {
    const details = item.details ?? {};
    const value = this.categoriaActual === 'skincare-y-belleza' ? details['productType']
      : this.categoriaActual === 'moda-y-estilo' ? details['itemType']
      : this.categoriaActual === 'viajes' ? details['placeType']
      : this.categoriaActual === 'musica' ? details['releaseKind']
      : this.categoriaActual === 'libros' ? (item.genres?.[0] || 'Libro')
      : (details['itemType'] || item.genres?.[0]);
    return value == null || String(value).trim() === '' ? this.configuracion.title : String(value);
  }

  openDetails(item: CommunityCatalogItem): void {
    void this.router.navigate(['/ficha-comunidad', item.id]);
  }

  reintentar(): void {
    void this.cargarElementos();
  }

  cambiarFiltro(filtro: string): void {
    this.filtroActual = filtro;
  }

  cambiarVista(vista: 'grid' | 'list'): void {
    this.vista = vista;
  }

  trackById(_index: number, item: CommunityCatalogItem): string {
    return item.id;
  }
}
