import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {

  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
  'https://faxywaqbojmqojkwxhns.supabase.co',
  'sb_publishable_UWD0iIbdmTbTU4BEqA6fqQ_7G_Iwq9A'
);
  }

  get client(): SupabaseClient {
    return this.supabase;
  }
}

