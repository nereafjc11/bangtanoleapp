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
import { ProfileService } from '../../services/profile.service';
import { TmdbService, CatalogItem, PersonItem } from '../../services/tmdb.service';

interface NotificationItem {
  id: string;
  actor_id: string;
  type: string;
  is_read: boolean;
  created_at: string;
  actorName: string;
  actorUsername: string | null;
  actorAvatar: string | null;
}

interface PublicUserResult {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  isFollowing: boolean;
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
  currentUserId: string | null = null;
  searchFollowLoading = new Set<string>();
  notifications: NotificationItem[] = [];
  unreadNotificationCount = 0;
  notificationsLoading = false;
  notificationsError = '';
  notificationsOpen = false;
  notificationsPinned = false;
  private notificationsRequest = 0;
  private searchRequest = 0;
  private authSubscription: { unsubscribe: () => void } | null = null;
  private searchSubscription?: Subscription;
  private searchInput = new Subject<string>();

  constructor(
    private supabaseService: SupabaseService,
    private categoriesService: CategoriesService,
    private preferencesService: UserPreferencesService,
    private globalSearchService: GlobalSearchService,
    private profileService: ProfileService,
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

  if (!target?.closest('.global-search')) {
    this.searchOpen = false;
  }

  if (!target?.closest('.notification-wrapper')) {
    this.notificationsOpen = false;
    this.notificationsPinned = false;
  }

  this.cdr.markForCheck();
}

  @HostListener('document:keydown.escape')
onEscape(): void {
  this.searchOpen = false;
  this.notificationsOpen = false;
  this.notificationsPinned = false;
  this.cdr.markForCheck();
}

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
      ? ((users.value.data ?? []) as Omit<PublicUserResult, 'isFollowing'>[])
          .slice(0, 5)
          .map(user => ({ ...user, isFollowing: false }))
      : [];

    if (this.userResults.length > 0 && this.currentUserId) {
      const followStates = await Promise.all(
        this.userResults
          .filter(user => user.id !== this.currentUserId)
          .map(async user => ({
            id: user.id,
            following: await this.profileService.isFollowing(user.id)
          }))
      );

      if (request !== this.searchRequest) return;

      for (const state of followStates) {
        const user = this.userResults.find(item => item.id === state.id);
        if (user) user.isFollowing = state.following;
      }
    }

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

  async toggleSearchFollow(user: PublicUserResult): Promise<void> {
    if (!this.currentUserId || user.id === this.currentUserId || this.searchFollowLoading.has(user.id)) {
      return;
    }

    this.searchFollowLoading.add(user.id);
    this.cdr.markForCheck();

    try {
      if (user.isFollowing) {
        await this.profileService.unfollowUser(user.id);
        user.isFollowing = false;
      } else {
        await this.profileService.followUser(user.id);
        user.isFollowing = true;
      }
    } catch (error) {
      console.error('Error al actualizar el seguimiento desde el buscador:', error);
    } finally {
      this.searchFollowLoading.delete(user.id);
      this.cdr.markForCheck();
    }
  }


async toggleNotifications(): Promise<void> {
  if (this.notificationsPinned) {
    // Segundo clic: cerrar el panel
    this.notificationsPinned = false;
    this.notificationsOpen = false;
    this.cdr.markForCheck();
    return;
  }

  // Primer clic: dejar el panel fijado
  this.notificationsPinned = true;
  this.notificationsOpen = true;

  await this.loadNotifications();
  this.cdr.markForCheck();
}

async onNotificationsMouseEnter(): Promise<void> {
  // Solo activar el hover en dispositivos con ratón
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return;
  }

  if (this.notificationsPinned) return;

  this.notificationsOpen = true;
  await this.loadNotifications();
  this.cdr.markForCheck();
}

onNotificationsMouseLeave(): void {
  // Si se abrió mediante clic, debe permanecer abierto
  if (this.notificationsPinned) return;

  this.notificationsOpen = false;
  this.cdr.markForCheck();
}


  async loadNotifications(): Promise<void> {
    const userId = this.currentUserId;
    if (!userId) {
      this.notifications = [];
      this.unreadNotificationCount = 0;
      return;
    }

    const request = ++this.notificationsRequest;
    this.notificationsLoading = true;
    this.notificationsError = '';
    this.cdr.markForCheck();

    try {
      const [listResult, countResult] = await Promise.all([
        this.supabaseService.client
          .from('notifications')
          .select('id, actor_id, type, is_read, created_at')
          .eq('recipient_id', userId)
          .order('created_at', { ascending: false })
          .limit(40),
        this.supabaseService.client
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', userId)
          .eq('is_read', false)
      ]);

      if (request !== this.notificationsRequest) return;
      if (listResult.error) throw listResult.error;
      if (countResult.error) throw countResult.error;

      const rows = listResult.data ?? [];
      const actorIds = [...new Set(rows.map(item => item.actor_id))];

      let profiles: any[] = [];
      if (actorIds.length) {
        const profileResult = await this.supabaseService.client
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', actorIds);

        if (profileResult.error) throw profileResult.error;
        profiles = profileResult.data ?? [];
      }

      if (request !== this.notificationsRequest) return;

      const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
      this.notifications = rows.map(item => {
        const actor = profileMap.get(item.actor_id);
        return {
          id: item.id,
          actor_id: item.actor_id,
          type: item.type,
          is_read: item.is_read,
          created_at: item.created_at,
          actorName: actor?.display_name || actor?.username || 'Una persona de ARMY',
          actorUsername: actor?.username || null,
          actorAvatar: actor?.avatar_url || null
        };
      });

      this.unreadNotificationCount = countResult.count ?? 0;
    } catch (error) {
      console.error('Error al cargar las notificaciones:', error);
      this.notificationsError = 'No hemos podido cargar tus notificaciones.';
    } finally {
      if (request === this.notificationsRequest) {
        this.notificationsLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  async markAllNotificationsAsRead(): Promise<void> {
    if (!this.currentUserId || this.unreadNotificationCount === 0) return;

    const { error } = await this.supabaseService.client
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', this.currentUserId)
      .eq('is_read', false);

    if (error) {
      console.error('Error al marcar notificaciones como leídas:', error);
      this.notificationsError = 'No hemos podido marcar las notificaciones como leídas.';
      return;
    }

    this.notifications = this.notifications.map(item => ({ ...item, is_read: true }));
    this.unreadNotificationCount = 0;
    this.cdr.markForCheck();
  }

  async openNotification(notification: NotificationItem): Promise<void> {
    if (!notification.is_read) {
      const { error } = await this.supabaseService.client
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id)
        .eq('recipient_id', this.currentUserId);

      if (!error) {
        notification.is_read = true;
        this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
      } else {
        console.error('Error al marcar la notificación:', error);
      }
    }

    this.notificationsOpen = false;
    void this.router.navigate(['/profile', notification.actor_id]);
    this.cdr.markForCheck();
  }

  formatNotificationDate(value: string): string {
    const date = new Date(value);
    const difference = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(difference / 60000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days} d`;

    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
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
      this.currentUserId = currentUserId;
      void this.loadNotifications();
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
    this.currentUserId = null;
    this.notifications = [];
    this.unreadNotificationCount = 0;
    this.notificationsOpen = false;
    this.myCategories = [];
    this.profileName = 'Mi cuenta';
    this.avatarUrl = null;
    this.userInitial = 'A';
    this.loadingUser = false;
    this.cdr.markForCheck();
  }

  getCategoryIcon(category: any): string {
    const value = `${category?.slug ?? ''} ${category?.name ?? ''}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (value.includes('serie') || value.includes('pelicula') || value.includes('cine') || value.includes('film')) {
      return 'film';
    }

    if (value.includes('skincare') || value.includes('belleza') || value.includes('beauty')) {
      return 'star';
    }

    if (value.includes('musica') || value.includes('music')) {
      return 'music';
    }

    if (value.includes('libro') || value.includes('lectura') || value.includes('book')) {
      return 'book-open';
    }

    if (value.includes('moda') || value.includes('estilo') || value.includes('fashion') || value.includes('ropa')) {
      return 'shopping-bag';
    }

    if (value.includes('otro') || value.includes('other') || value.includes('misc')) {
      return 'grid';
    }

    if (value.includes('viaje') || value.includes('travel') || value.includes('turismo') || value.includes('aventura')) {
      return 'map';
    }

    return 'compass';
  }

  cerrarMenu(): void { this.menuOpen = false; }
  alternarMenu(): void { this.menuOpen = !this.menuOpen; }
}
