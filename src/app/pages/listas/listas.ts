import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ListsService, UserList, UserListItem } from '../../services/lists.service';
import { TmdbService } from '../../services/tmdb.service';
import { CommunityCatalogService } from '../../services/community-catalog.service';

interface ListContentView {
  id: string;
  source: 'tmdb' | 'community';
  type: string;
  contentId: string;
  title: string;
  year: string;
  poster: string;
}

@Component({
  selector: 'app-listas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listas.html',
  styleUrl: './listas.css',
})
export class Listas implements OnInit {
  lists: UserList[] = [];
  selectedList: UserList | null = null;
  selectedItems: ListContentView[] = [];
  loading = true;
  itemsLoading = false;
  saving = false;
  error = '';
  showCreateForm = false;
  newName = '';
  newDescription = '';
  newIsPublic = false;
  deletingListId: string | null = null;
  removingItemId: string | null = null;

  // Estado del modal personalizado para eliminar listas.
  showDeleteConfirm = false;
  pendingDeleteList: UserList | null = null;

  constructor(
    private listsService: ListsService,
    public tmdb: TmdbService,
    private community: CommunityCatalogService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadLists();
  }

  async loadLists(): Promise<void> {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();
    try {
      this.lists = await this.listsService.getMyLists();
      if (this.selectedList) {
        this.selectedList = this.lists.find((list) => list.id === this.selectedList?.id) ?? null;
        if (this.selectedList) await this.openList(this.selectedList);
        else this.selectedItems = [];
      }
    } catch (error) {
      console.error('Error cargando listas:', error);
      this.error = error instanceof Error ? error.message : 'No se pudieron cargar tus listas.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async createList(): Promise<void> {
    if (!this.newName.trim() || this.saving) return;
    this.saving = true;
    this.error = '';
    this.cdr.markForCheck();
    try {
      const created = await this.listsService.createList({
        name: this.newName,
        description: this.newDescription,
        isPublic: this.newIsPublic,
      });
      this.lists = [created, ...this.lists];
      this.newName = '';
      this.newDescription = '';
      this.newIsPublic = false;
      this.showCreateForm = false;
      await this.openList(created);
    } catch (error) {
      console.error('Error creando lista:', error);
      this.error = error instanceof Error ? error.message : 'No se pudo crear la lista.';
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  async openList(list: UserList): Promise<void> {
    this.selectedList = list;
    this.itemsLoading = true;
    this.error = '';
    this.cdr.markForCheck();
    try {
      const items = await this.listsService.getListItems(list.id);
      const resolved = await Promise.all(items.map((item) => this.resolveItem(item)));
      this.selectedItems = resolved.filter((item): item is ListContentView => item !== null);
    } catch (error) {
      console.error('Error cargando el contenido de la lista:', error);
      this.error =
        error instanceof Error ? error.message : 'No se pudo cargar el contenido de esta lista.';
      this.selectedItems = [];
    } finally {
      this.itemsLoading = false;
      this.cdr.markForCheck();
    }
  }

  private async resolveItem(item: UserListItem): Promise<ListContentView | null> {
    if (item.content_source === 'community') {
      const content = await this.community.getById(item.content_id).catch(() => null);
      if (!content) return null;
      return {
        id: item.id,
        source: 'community',
        type: item.content_type,
        contentId: item.content_id,
        title: content.title,
        year: content.release_year ? String(content.release_year) : '',
        poster: content.poster_url || '',
      };
    }

    try {
      const details = await this.tmdb.getDetails(
        Number(item.content_id),
        item.content_type === 'tv' ? 'tv' : 'movie',
      );
      return {
        id: item.id,
        source: 'tmdb',
        type: item.content_type,
        contentId: item.content_id,
        title: details?.title || details?.name || 'Contenido sin título',
        year: (details?.release_date || details?.first_air_date || '').slice(0, 4),
        poster: this.tmdb.getPoster(details?.poster_path || null, 'w342'),
      };
    } catch (error) {
      console.error('No se pudo recuperar un elemento de TMDB:', item.content_id, error);
      return null;
    }
  }

  openItem(item: ListContentView): void {
    if (item.source === 'tmdb') {
      void this.router.navigate(['/contenido', item.type, item.contentId]);
    } else {
      void this.router.navigate(['/ficha-comunidad', item.contentId]);
    }
  }

  async removeItem(item: ListContentView): Promise<void> {
    if (!this.selectedList) return;
    this.removingItemId = item.id;
    this.cdr.markForCheck();
    try {
      await this.listsService.removeItem(this.selectedList.id, {
        source: item.source,
        type: item.type,
        id: item.contentId,
      });
      this.selectedItems = this.selectedItems.filter((current) => current.id !== item.id);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo quitar el contenido.';
    } finally {
      this.removingItemId = null;
      this.cdr.markForCheck();
    }
  }

  // Abre el modal propio de Bangtan Olé; ya no usa window.confirm().
  deleteList(list: UserList): void {
    if (this.deletingListId) return;
    this.pendingDeleteList = list;
    this.showDeleteConfirm = true;
    this.cdr.markForCheck();
  }

  closeDeleteConfirm(): void {
    if (this.deletingListId) return;
    this.showDeleteConfirm = false;
    this.pendingDeleteList = null;
    this.cdr.markForCheck();
  }

  async confirmDeleteList(): Promise<void> {
    const list = this.pendingDeleteList;
    if (!list || this.deletingListId) return;

    this.deletingListId = list.id;
    this.error = '';
    this.cdr.markForCheck();
    try {
      await this.listsService.deleteList(list.id);
      this.lists = this.lists.filter((item) => item.id !== list.id);
      if (this.selectedList?.id === list.id) {
        this.selectedList = null;
        this.selectedItems = [];
      }
      this.showDeleteConfirm = false;
      this.pendingDeleteList = null;
    } catch (error) {
      console.error('Error eliminando lista:', error);
      this.error = error instanceof Error ? error.message : 'No se pudo eliminar la lista.';
    } finally {
      this.deletingListId = null;
      this.cdr.markForCheck();
    }
  }

  backToLists(): void {
    this.selectedList = null;
    this.selectedItems = [];
    this.error = '';
  }
}

