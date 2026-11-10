
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ContentReference } from './reviews.service';

export interface UserList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserListItem {
  id: string;
  list_id: string;
  content_source: 'tmdb' | 'community';
  content_type: string;
  content_id: string;
  added_at: string;
}

export interface CreateListInput {
  name: string;
  description?: string | null;
  isPublic?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ListsService {
  private readonly listsTable = 'user_lists';
  private readonly itemsTable = 'user_list_items';

  constructor(private supabase: SupabaseService) {}

  async createList(input: CreateListInput): Promise<UserList> {
    const user = await this.getUser();
    const name = input.name.trim();

    if (!name) {
      throw new Error('Escribe un nombre para la lista.');
    }

    const { data, error } = await this.supabase.client
      .from(this.listsTable)
      .insert({
        user_id: user.id,
        name,
        description: input.description?.trim() || null,
        is_public: input.isPublic ?? false,
      })
      .select('*')
      .single();

    if (error) throw error;

    return data as UserList;
  }

  async getMyLists(): Promise<UserList[]> {
    const user = await this.getUser();

    const { data, error } = await this.supabase.client
      .from(this.listsTable)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []) as UserList[];
  }

  async getPublicLists(): Promise<UserList[]> {
    const { data, error } = await this.supabase.client
      .from(this.listsTable)
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []) as UserList[];
  }

  async getListById(id: string): Promise<UserList | null> {
    const { data, error } = await this.supabase.client
      .from(this.listsTable)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    return data as UserList | null;
  }

  async updateList(
    id: string,
    changes: Partial<CreateListInput>
  ): Promise<UserList> {
    const user = await this.getUser();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (changes.name !== undefined) {
      const name = changes.name.trim();

      if (!name) {
        throw new Error('El nombre de la lista no puede estar vacío.');
      }

      updates['name'] = name;
    }

    if (changes.description !== undefined) {
      updates['description'] = changes.description?.trim() || null;
    }

    if (changes.isPublic !== undefined) {
      updates['is_public'] = changes.isPublic;
    }

    const { data, error } = await this.supabase.client
      .from(this.listsTable)
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) throw error;

    return data as UserList;
  }

  async deleteList(id: string): Promise<void> {
    const user = await this.getUser();

    const { error } = await this.supabase.client
      .from(this.listsTable)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  }

  async addItem(
    listId: string,
    content: ContentReference
  ): Promise<UserListItem> {
    const user = await this.getUser();

    // Comprobar que la lista pertenece al usuario.
    const { data: list, error: listError } =
      await this.supabase.client
        .from(this.listsTable)
        .select('id')
        .eq('id', listId)
        .eq('user_id', user.id)
        .single();

    if (listError || !list) {
      throw new Error('No se ha encontrado tu lista.');
    }

    const { data, error } = await this.supabase.client
      .from(this.itemsTable)
      .upsert(
        {
          list_id: listId,
          content_source: content.source,
          content_type: content.type,
          content_id: String(content.id),
        },
        {
          onConflict:
            'list_id,content_source,content_type,content_id',
        }
      )
      .select('*')
      .single();

    if (error) throw error;

    return data as UserListItem;
  }

  async removeItem(
    listId: string,
    content: ContentReference
  ): Promise<void> {
    const user = await this.getUser();

    const { data: list, error: listError } =
      await this.supabase.client
        .from(this.listsTable)
        .select('id')
        .eq('id', listId)
        .eq('user_id', user.id)
        .single();

    if (listError || !list) {
      throw new Error('No se ha encontrado tu lista.');
    }

    const { error } = await this.supabase.client
      .from(this.itemsTable)
      .delete()
      .eq('list_id', listId)
      .eq('content_source', content.source)
      .eq('content_type', content.type)
      .eq('content_id', String(content.id));

    if (error) throw error;
  }

  async getListItems(listId: string): Promise<UserListItem[]> {
    const { data, error } = await this.supabase.client
      .from(this.itemsTable)
      .select('*')
      .eq('list_id', listId)
      .order('added_at', { ascending: false });

    if (error) throw error;

    return (data ?? []) as UserListItem[];
  }

  private async getUser() {
    const { data, error } =
      await this.supabase.client.auth.getUser();

    if (error || !data.user) {
      throw new Error('Debes iniciar sesión para realizar esta acción.');
    }

    return data.user;
  }
}
