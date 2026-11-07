
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';

import {
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

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule
  ],
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

  private authSubscription: { unsubscribe: () => void } | null = null;
  private searchSubscription?: Subscription;

  private searchInput = new Subject<string>();

  constructor(
    private supabaseService: SupabaseService,
    private categoriesService: CategoriesService,
    private preferencesService: UserPreferencesService,
    private globalSearchService: GlobalSearchService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {

    const { data } =
      this.supabaseService.client.auth.onAuthStateChange(
        (_event, session) => {
          void this.loadUserData(session?.user.id ?? null);
        }
      );

    this.authSubscription = data.subscription;

    this.searchSubscription = this.searchInput.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(query => {
      this.globalSearchService.search(query);
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
  }

  onGlobalSearchChange(): void {
    this.searchInput.next(this.globalQuery.trim());
  }

  clearGlobalSearch(): void {
    this.globalQuery = '';
    this.searchInput.next('');
  }

  async loadUserData(userId?: string | null): Promise<void> {

    this.loadingUser = true;
    this.cdr.markForCheck();

    try {
      let currentUserId = userId;

      if (currentUserId === undefined) {
        const { data, error } =
          await this.supabaseService.client.auth.getUser();

        if (error || !data.user) {
          this.resetUserData();
          return;
        }

        currentUserId = data.user.id;
      }

      if (!currentUserId) {
        this.resetUserData();
        return;
      }

      const [allCategories, selectedIds, profileResult] =
        await Promise.all([
          this.categoriesService.getActiveCategories(),
          this.preferencesService.getMyPreferences(currentUserId),
          this.supabaseService.client
            .from('profiles')
            .select('display_name, username, avatar_url')
            .eq('id', currentUserId)
            .maybeSingle()
        ]);

      this.myCategories = allCategories.filter(
        category => selectedIds.includes(Number(category.id))
      );

      if (profileResult.error) {
        console.error(
          'Error al cargar el perfil:',
          profileResult.error
        );
      }

      const profile = profileResult.data;

      this.profileName =
        profile?.display_name ||
        profile?.username ||
        'Mi cuenta';

      this.avatarUrl = profile?.avatar_url || null;

      this.userInitial =
        this.profileName.trim().charAt(0).toUpperCase() || 'A';

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

  cerrarMenu(): void {
    this.menuOpen = false;
  }

  alternarMenu(): void {
    this.menuOpen = !this.menuOpen;
  }
}
