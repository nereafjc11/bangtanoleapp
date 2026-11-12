import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';
import { GlobalSearchService } from '../../services/global-search.service';

import {
  TmdbService,
  CatalogItem,
  CatalogSection,
  CountryFilter,
  VarietyFormat,
  PersonItem,
} from '../../services/tmdb.service';

@Component({
  selector: 'app-peliculas-series',
  templateUrl: './peliculas-series.html',
  styleUrl: './peliculas-series.css',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
})
export class PeliculasSeries implements OnInit, OnDestroy {
  private globalSearchSubscription?: Subscription;
  private routeQuerySubscription?: Subscription;
  private requestId = 0;

  query = '';
  searched = false;
  vista: 'grid' | 'list' = 'grid';

  section: CatalogSection = 'movie';

  selectedCountry: CountryFilter = 'all';
  selectedFormat: VarietyFormat = 'all';
  selectedYear: number | null = null;
  selectedPerson: PersonItem | null = null;

  results: CatalogItem[] = [];
  peopleResults: PersonItem[] = [];

  loading = false;
  loadingMore = false;
  searchingPeople = false;

  error = '';

  currentPage = 1;
  totalPages = 1;

  readonly currentYear = new Date().getFullYear();

  readonly years: number[] = Array.from(
    { length: this.currentYear - 1900 + 1 },
    (_, index) => this.currentYear - index,
  );

  constructor(
    private tmdbService: TmdbService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private globalSearchService: GlobalSearchService,
  ) {}

  ngOnInit(): void {
    this.globalSearchSubscription = this.globalSearchService.search$.subscribe((query) => {
      this.query = query;

      if (!query.trim()) {
        void this.clearSearch();
        return;
      }

      void this.searchAll(query.trim());
    });

    this.routeQuerySubscription = this.route.queryParams.subscribe((params) => {
      const routeQuery = typeof params['q'] === 'string' ? params['q'].trim() : '';
      const personId = Number(params['personId']);
      const personName = typeof params['personName'] === 'string' ? params['personName'] : '';

      if (routeQuery) {
        this.query = routeQuery;
        void this.searchAll(routeQuery);
        return;
      }

      if (Number.isFinite(personId) && personId > 0 && personName) {
        this.query = personName;
        void this.loadPersonFromRoute(personId, personName);
        return;
      }

      if (this.globalSearchService.currentQuery === null) {
        void this.loadCatalog();
      }
    });
  }

  ngOnDestroy(): void {
    this.globalSearchSubscription?.unsubscribe();
    this.routeQuerySubscription?.unsubscribe();
  }

  cambiarVista(vista: 'grid' | 'list'): void {
    this.vista = vista;
  }

  // =====================================
  // BÚSQUEDA GENERAL: TÍTULOS + PERSONAS
  // =====================================

  async searchAll(searchQuery: string): Promise<void> {
    const currentRequest = ++this.requestId;

    this.loading = true;
    this.loadingMore = false;
    this.searchingPeople = true;

    this.searched = true;
    this.error = '';

    this.results = [];
    this.peopleResults = [];

    this.currentPage = 1;
    this.totalPages = 1;

    this.cdr.markForCheck();

    const type = this.section === 'movie' ? 'movie' : 'tv';

    try {
      const [titleResult, peopleResult] = await Promise.allSettled([
        this.tmdbService.search(searchQuery, type),
        this.tmdbService.searchPeople(searchQuery),
      ]);

      if (currentRequest !== this.requestId) {
        return;
      }

      if (titleResult.status === 'fulfilled') {
        this.results = titleResult.value ?? [];
      }

      if (peopleResult.status === 'fulfilled') {
        this.peopleResults = peopleResult.value?.results ?? [];
      }

      if (titleResult.status === 'rejected' && peopleResult.status === 'rejected') {
        console.error('Error en la búsqueda general:', titleResult.reason, peopleResult.reason);

        this.error = 'No hemos podido realizar la búsqueda. Inténtalo de nuevo.';
      }
    } catch (error) {
      if (currentRequest !== this.requestId) {
        return;
      }

      console.error('Error en la búsqueda:', error);

      this.error = 'No hemos podido realizar la búsqueda. Inténtalo de nuevo.';
    } finally {
      if (currentRequest === this.requestId) {
        this.loading = false;
        this.searchingPeople = false;
        this.cdr.markForCheck();
      }
    }
  }

  // =====================================
  // CARGAR CATÁLOGO
  // =====================================

  async loadCatalog(): Promise<void> {
    const currentRequest = ++this.requestId;

    const section = this.section;
    const country = this.selectedCountry;
    const format = this.selectedFormat;
    const year = this.selectedYear;
    const personId = this.selectedPerson?.id ?? null;

    this.currentPage = 1;
    this.totalPages = 1;

    this.loading = true;
    this.loadingMore = false;
    this.searchingPeople = false;

    this.error = '';
    this.searched = false;

    this.results = [];
    this.peopleResults = [];

    this.cdr.markForCheck();

    try {
      const response = await this.tmdbService.discover(
        section,
        country,
        section === 'variety' ? format : 'all',
        1,
        year,
        personId,
      );

      if (currentRequest !== this.requestId) {
        return;
      }

      this.results = response?.results ?? [];
      this.currentPage = response?.page ?? 1;
      this.totalPages = response?.total_pages ?? 1;
    } catch (error) {
      if (currentRequest !== this.requestId) {
        return;
      }

      console.error('Error cargando el catálogo:', error);

      this.error = 'No hemos podido cargar el catálogo. Inténtalo de nuevo.';

      this.results = [];
    } finally {
      if (currentRequest === this.requestId) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  // =====================================
  // SCROLL INFINITO
  // =====================================

  async loadMore(): Promise<void> {
    if (this.loading || this.loadingMore || this.currentPage >= this.totalPages || this.searched) {
      return;
    }

    const currentRequest = this.requestId;
    const nextPage = this.currentPage + 1;

    this.loadingMore = true;
    this.cdr.markForCheck();

    try {
      const response = await this.tmdbService.discover(
        this.section,
        this.selectedCountry,
        this.section === 'variety' ? this.selectedFormat : 'all',
        nextPage,
        this.selectedYear,
        this.selectedPerson?.id ?? null,
      );

      if (currentRequest !== this.requestId) {
        return;
      }

      const existingIds = new Set(this.results.map((item) => item.id));

      const newItems = (response?.results ?? []).filter((item) => !existingIds.has(item.id));

      this.results = [...this.results, ...newItems];

      this.currentPage = response?.page ?? nextPage;
      this.totalPages = response?.total_pages ?? this.totalPages;
    } catch (error) {
      console.error('Error cargando más títulos:', error);
    } finally {
      if (currentRequest === this.requestId) {
        this.loadingMore = false;
        this.cdr.markForCheck();
      }
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const scrollPosition = window.innerHeight + window.scrollY;

    const pageHeight = document.documentElement.scrollHeight;

    if (pageHeight - scrollPosition < 700) {
      void this.loadMore();
    }
  }

  private async loadPersonFromRoute(personId: number, personName: string): Promise<void> {
    try {
      const response = await this.tmdbService.searchPeople(personName);
      const person = (response?.results ?? []).find((item) => item.id === personId);
      if (person) {
        this.selectedPerson = person;
        this.query = person.name;
        await this.loadCatalog();
      } else {
        this.error = 'No hemos podido localizar a esa persona en el catálogo.';
        this.cdr.markForCheck();
      }
    } catch (error) {
      console.error('Error al recuperar la persona:', error);
      this.error = 'No hemos podido cargar los trabajos de esta persona.';
      this.cdr.markForCheck();
    }
  }

  // =====================================
  // SELECCIONAR PERSONA
  // =====================================

  async selectPerson(person: PersonItem): Promise<void> {
    this.selectedPerson = person;
    this.query = person.name;

    await this.loadCatalog();
  }

  async clearPerson(): Promise<void> {
    this.selectedPerson = null;

    await this.loadCatalog();
  }

  // =====================================
  // CAMBIAR SECCIÓN
  // =====================================

  async changeSection(section: CatalogSection): Promise<void> {
    if (this.section === section) {
      return;
    }

    this.section = section;
    this.selectedPerson = null;

    if (this.query.trim()) {
      await this.searchAll(this.query.trim());
    } else {
      await this.loadCatalog();
    }
  }

  // =====================================
  // FILTROS
  // =====================================

  async changeCountry(country: CountryFilter): Promise<void> {
    this.selectedCountry = country;

    if (this.searched) {
      return;
    }

    await this.loadCatalog();
  }

  async changeFormat(format: VarietyFormat): Promise<void> {
    this.selectedFormat = format;

    if (this.searched) {
      return;
    }

    await this.loadCatalog();
  }

  async changeYear(year: number | string | null): Promise<void> {
    if (year === '' || year === null) {
      this.selectedYear = null;
    } else {
      const parsedYear = Number(year);

      this.selectedYear = Number.isInteger(parsedYear) ? parsedYear : null;
    }

    if (this.searched) {
      return;
    }

    await this.loadCatalog();
  }

  // =====================================
  // LIMPIAR BÚSQUEDA
  // =====================================

  async clearSearch(): Promise<void> {
    this.query = '';
    this.peopleResults = [];
    this.selectedPerson = null;
    this.searched = false;

    await this.loadCatalog();
  }

  // =====================================
  // FILTRAR RESULTADOS DE TÍTULOS
  // =====================================

  get filteredResults(): CatalogItem[] {
    let items = [...this.results];

    if (this.selectedCountry !== 'all') {
      if (this.selectedCountry === 'international') {
        items = items.filter(
          (item) =>
            !(item.origin_country ?? []).some((country) =>
              ['KR', 'CN', 'JP', 'TH'].includes(country),
            ),
        );
      } else {
        const countryCodes: Record<string, string> = {
          korea: 'KR',
          china: 'CN',
          japan: 'JP',
          thailand: 'TH',
        };

        const countryCode = countryCodes[this.selectedCountry];

        items = items.filter((item) => (item.origin_country ?? []).includes(countryCode));
      }
    }

    if (this.selectedYear !== null) {
      items = items.filter((item) => {
        const date = item.release_date || item.first_air_date;

        return date?.startsWith(String(this.selectedYear)) ?? false;
      });
    }

    return items;
  }

  // =====================================
  // DATOS DE LAS TARJETAS
  // =====================================

  getTitle(item: CatalogItem): string {
    return item.title || item.name || 'Sin título';
  }

  getYear(item: CatalogItem): string {
    const date = item.release_date || item.first_air_date;

    return date ? date.substring(0, 4) : 'Año desconocido';
  }

  getPoster(path: string | null): string {
    return this.tmdbService.getPoster(path);
  }

  handlePosterImageError(event: Event): void {
    const image = event.target as HTMLImageElement;

    image.style.display = 'none';

    const container = image.parentElement;

    if (container) {
      container.classList.add('image-error');

      if (!container.querySelector('.poster-placeholder')) {
        const placeholder = document.createElement('div');

        placeholder.className = 'poster-placeholder';

        placeholder.innerHTML = `
        <span class="placeholder-title"></span>
        <span class="placeholder-subtitle">Bangtan Olé</span>
      `;

        const title = placeholder.querySelector('.placeholder-title');

        if (title) {
          title.textContent = image.alt.replace('Póster de ', '');
        }

        container.appendChild(placeholder);
      }
    }
  }
  getPersonImage(path: string | null): string {
    return this.tmdbService.getProfile(path);
  }

  getPersonInitials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  handlePersonImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.style.display = 'none';

    const container = image.parentElement;

    if (container) {
      container.classList.add('image-error');
    }
  }

  // =====================================
  // ABRIR FICHA
  // =====================================

  openDetails(item: CatalogItem): void {
    const type = this.section === 'movie' ? 'movie' : 'tv';

    this.router.navigate(['/contenido', type, item.id]);
  }
}
