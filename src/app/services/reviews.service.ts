import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type ContentSource = 'tmdb' | 'community';

export interface ContentReference {
  source: ContentSource;
  type: string;
  id: string | number;
}

export interface ContentReview {
  id: string;
  user_id: string;
  content_source: ContentSource;
  content_type: string;
  content_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveReviewInput extends ContentReference {
  rating: number;
  reviewText?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly table = 'content_reviews';

  constructor(private supabase: SupabaseService) {}

  async saveReview(input: SaveReviewInput): Promise<ContentReview> {
    this.validateRating(input.rating);

    const user = await this.getUser();

    const { data, error } = await this.supabase.client
      .from(this.table)
      .upsert(
        {
          user_id: user.id,
          content_source: input.source,
          content_type: input.type,
          content_id: String(input.id),
          rating: input.rating,
          review_text: input.reviewText?.trim() || null,
          updated_at: new Date().toISOString()
        },
        {
          onConflict:
            'user_id,content_source,content_type,content_id'
        }
      )
      .select('*')
      .single();

    if (error) throw error;

    return data as ContentReview;
  }

  async getReviews(
    content: ContentReference
  ): Promise<ContentReview[]> {
    const { data, error } = await this.supabase.client
      .from(this.table)
      .select('*')
      .eq('content_source', content.source)
      .eq('content_type', content.type)
      .eq('content_id', String(content.id))
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []) as ContentReview[];
  }

  async getMyReview(
    content: ContentReference
  ): Promise<ContentReview | null> {
    const user = await this.getUser();

    const { data, error } = await this.supabase.client
      .from(this.table)
      .select('*')
      .eq('user_id', user.id)
      .eq('content_source', content.source)
      .eq('content_type', content.type)
      .eq('content_id', String(content.id))
      .maybeSingle();

    if (error) throw error;

    return data as ContentReview | null;
  }

  async getMyReviews(): Promise<ContentReview[]> {
    const user = await this.getUser();

    const { data, error } = await this.supabase.client
      .from(this.table)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []) as ContentReview[];
  }

  async deleteReview(id: string): Promise<void> {
    const user = await this.getUser();

    const { error } = await this.supabase.client
      .from(this.table)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  }

  private validateRating(rating: number): void {
    if (
      !Number.isFinite(rating) ||
      rating < 1 ||
      rating > 5 ||
      rating * 2 !== Math.trunc(rating * 2)
    ) {
      throw new Error(
        'La puntuación debe estar entre 1 y 5 estrellas, permitiendo medias estrellas.'
      );
    }
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
