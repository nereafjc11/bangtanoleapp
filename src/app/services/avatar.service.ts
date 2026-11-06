
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AvatarService {

  private readonly bucket = 'avatars';

  constructor(
    private supabaseService: SupabaseService
  ) {}

  /**
   * Sube o sustituye la fotografía de la usuaria.
   */
  async uploadAvatar(file: File): Promise<string> {

    const supabase = this.supabaseService.client;

    const { data: { user }, error: userError } =
      await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('No hay ninguna usuaria autenticada.');
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error('El formato debe ser JPG, PNG o WEBP.');
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new Error('La fotografía no puede superar los 2 MB.');
    }

    const extension = file.type === 'image/jpeg'
      ? 'jpg'
      : file.type.split('/')[1];

    const filePath = `${user.id}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(this.bucket)
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      console.error('Error al subir la fotografía:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(this.bucket)
      .getPublicUrl(filePath);

    return `${data.publicUrl}?v=${Date.now()}`;
  }
  
}
