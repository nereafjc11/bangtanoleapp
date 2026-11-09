import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';
import {
  Router,
  RouterOutlet,
  RouterLink,
  RouterLinkActive
} from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SupabaseService } from '../../services/supabase.service';
import { CategoriesService } from '../../services/categories.service';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { GlobalSearchService } from '../../services/global-search.service';
import { TmdbService, CatalogItem, PersonItem } from '../../services/tmdb.service';

interface PublicUserResult {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout implements OnInit, OnDestroy {
  menuOpen = false;
  loadingUser = true;
  myCategories: any[] = [];
  profileName = 'Mi cuenta';
  avatarUrl: string | null = null;
  userInitial = 'A';

  globalQuery = '';
  searchOpen = false;
  searchLoading = false;
  searchSubmitted = false;
  movieResults: CatalogItem[] = [];
  tvResults: CatalogItem[] = [];
  peopleResults: PersonItem[] = [];
  userResults: PublicUserResult[] = [];
  private searchRequest = 0;
  private authSubscription: { unsubscribe: () => void } | null = null;
  private searchSubscription?: Subscription;
  private searchInput = new Subject<string>();

  constructor(
    private supabaseService: SupabaseService,
    private categoriesService: CategoriesService,
    private preferencesService: UserPreferencesService,
    private globalSearchService: GlobalSearchService,
    public tmdbService: TmdbService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const { data } = this.supabaseService.client.auth.onAuthStateChange(
      (_event, session) => { void this.loadUserData(session?.user.id ?? null); }
    );
    this.authSubscription = data.subscription;

    this.searchSubscription = this.searchInput.pipe(
      debounceTime(350), distinctUntilChanged()
    ).subscribe(query => { void this.runGlobalSearch(query); });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
  }

  onGlobalSearchChange(): void {
    const query = this.globalQuery.trim();
    this.searchOpen = query.length >= 2;
    this.searchSubmitted = false;
    if (query.length < 2) {
      this.searchRequest++;
      this.clearResults();
      this.searchLoading = false;
      this.globalSearchService.search('');
      return;
    }
    this.searchLoading = true;
    this.searchInput.next(query);
  }

  onSearchFocus(): void {
    if (this.globalQuery.trim().length >= 2) this.searchOpen = true;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.global-search')) this.searchOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.searchOpen = false; }

  private async runGlobalSearch(query: string): Promise<void> {
    if (query.length < 2) return;
    const request = ++this.searchRequest;
    this.globalSearchService.search(query);
    const [movies, series, people, users] = await Promise.allSettled([
      this.tmdbService.search(query, 'movie'),
      this.tmdbService.search(query, 'tv'),
      this.tmdbService.searchPeople(query),
      this.supabaseService.client.from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.%${this.escapeSearch(query)}%,display_name.ilike.%${this.escapeSearch(query)}%`)
        .limit(5)
    ]);
    if (request !== this.searchRequest) return;
    this.movieResults = movies.status === 'fulfilled' ? (movies.value ?? []).slice(0, 4) : [];
    this.tvResults = series.status === 'fulfilled' ? (series.value ?? []).slice(0, 4) : [];
    this.peopleResults = people.status === 'fulfilled' ? (people.value?.results ?? []).slice(0, 4) : [];
    this.userResults = users.status === 'fulfilled' && !users.value.error
      ? ((users.value.data ?? []) as PublicUserResult[]).slice(0, 5) : [];
    this.searchLoading = false;
    this.cdr.markForCheck();
  }

  private escapeSearch(value: string): string {
    return value.replace(/[,%()]/g, ' ').trim();
  }

  get hasSearchResults(): boolean {
    return !!(this.movieResults.length || this.tvResults.length || this.peopleResults.length || this.userResults.length);
  }

  private clearResults(): void {
    this.movieResults = [];
    this.tvResults = [];
    this.peopleResults = [];
    this.userResults = [];
  }

  clearGlobalSearch(): void {
    this.globalQuery = '';
    this.searchRequest++;
    this.searchOpen = false;
    this.searchLoading = false;
    this.clearResults();
    this.globalSearchService.search('');
  }

  openContent(item: CatalogItem, type: 'movie' | 'tv'): void {
    this.searchOpen = false;
    void this.router.navigate(['/contenido', type, item.id]);
  }

  openPerson(person: PersonItem): void {
    this.searchOpen = false;
    void this.router.navigate(['/explorar'], {
      queryParams: { personId: person.id, personName: person.name }
    });
  }

  openUser(user: PublicUserResult): void {
    this.searchOpen = false;
    void this.router.navigate(['/profile', user.id]);
  }

  viewAllResults(): void {
    const query = this.globalQuery.trim();
    if (!query) return;
    this.searchOpen = false;
    this.globalSearchService.search(query);
    void this.router.navigate(['/explorar'], { queryParams: { q: query } });
  }

  async loadUserData(userId?: string | null): Promise<void> {
    this.loadingUser = true;
    this.cdr.markForCheck();
    try {
      let currentUserId = userId;
      if (currentUserId === undefined) {
        const { data, error } = await this.supabaseService.client.auth.getUser();
        if (error || !data.user) { this.resetUserData(); return; }
        currentUserId = data.user.id;
      }
      if (!currentUserId) { this.resetUserData(); return; }
      const [allCategories, selectedIds, profileResult] = await Promise.all([
        this.categoriesService.getActiveCategories(),
        this.preferencesService.getMyPreferences(currentUserId),
        this.supabaseService.client.from('profiles')
          .select('display_name, username, avatar_url').eq('id', currentUserId).maybeSingle()
      ]);
      this.myCategories = allCategories.filter(category => selectedIds.includes(Number(category.id)));
      if (profileResult.error) console.error('Error al cargar el perfil:', profileResult.error);
      const profile = profileResult.data;
      this.profileName = profile?.display_name || profile?.username || 'Mi cuenta';
      this.avatarUrl = profile?.avatar_url || null;
      this.userInitial = this.profileName.trim().charAt(0).toUpperCase() || 'A';
    } catch (error) {
      console.error('Error al cargar los datos del usuario:', error);
      this.myCategories = [];
    } finally {
      this.loadingUser = false;
      this.cdr.markForCheck();
    }
  }

  private resetUserData(): void {
    this.myCategories = [];
    this.profileName = 'Mi cuenta';
    this.avatarUrl = null;
    this.userInitial = 'A';
    this.loadingUser = false;
    this.cdr.markForCheck();
  }

  cerrarMenu(): void { this.menuOpen = false; }
  alternarMenu(): void { this.menuOpen = !this.menuOpen; }
}
