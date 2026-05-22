import { auth } from './firebase';

export { fmt, fmtD } from '@zeroed/core';

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

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
