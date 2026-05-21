import { getSupabase } from './supabase';

export { fmt, fmtD } from '@zeroed/core';

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  });

  return res;
}
