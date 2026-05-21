import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export async function getSupabase(): Promise<SupabaseClient> {
  if (_client) return _client;
  const res = await fetch('/api/config');
  const { supabaseUrl, supabaseAnonKey } = await res.json();
  _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}
