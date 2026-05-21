// Shared Supabase Auth helper — loaded on every page via <script src="/auth.js">
// Provides: requireAuth(), getSession(), apiFetch(), signOut()

let _supabase = null;

async function getSupabase() {
  if (_supabase) return _supabase;
  const { supabaseUrl, supabaseAnonKey } = await fetch('/api/config').then(r => r.json());
  _supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);
  return _supabase;
}

async function getSession() {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = '/login.html';
    return null;
  }
  return session;
}

async function signOut() {
  const sb = await getSupabase();
  await sb.auth.signOut();
  window.location.href = '/login.html';
}

async function apiFetch(url, options = {}) {
  const session = await getSession();
  const token   = session?.access_token;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    window.location.href = '/login.html';
    return null;
  }
  return res;
}
