import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';

export interface DbProfile {
  id: number;
  name: string;
  email: string;
  is_pro: boolean;
  is_admin: boolean;
  monthly_income: number | null;
  monthly_expenses: number | null;
  strategy: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  // undefined = still loading, null = not signed in / fetch failed
  profile: DbProfile | null | undefined;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: undefined,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DbProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;

    getSupabase().then((sb) => {
      sb.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      });

      const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setLoading(false);
      });
      sub = listener.subscription;
    });

    return () => { sub?.unsubscribe(); };
  }, []);

  // Fetch DB profile (includes is_admin, is_pro) whenever session changes
  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    setProfile(undefined);
    apiFetch('/api/user')
      .then(r => r.ok ? r.json() : null)
      .then(data => setProfile(data as DbProfile | null))
      .catch(() => setProfile(null));
  }, [session]);

  const signOut = async () => {
    const sb = await getSupabase();
    await sb.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
