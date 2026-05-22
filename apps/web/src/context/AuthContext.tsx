import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { apiFetch } from '../lib/api';

export interface DbProfile {
  uid: string;
  name: string;
  email: string;
  is_pro: boolean;
  is_admin: boolean;
  monthly_income: number | null;
  monthly_expenses: number | null;
  strategy: string | null;
}

interface AuthContextType {
  user: User | null;
  // undefined = still loading profile, null = not signed in / fetch failed
  profile: DbProfile | null | undefined;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user:    null,
  profile: undefined,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<DbProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Fetch DB profile (includes is_admin, is_pro) whenever Firebase user changes
  useEffect(() => {
    if (!user) { setProfile(null); return; }
    setProfile(undefined);
    apiFetch('/api/user')
      .then(r => r.ok ? r.json() : null)
      .then(data => setProfile(data as DbProfile | null))
      .catch(() => setProfile(null));
  }, [user]);

  const signOut = () => fbSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
