import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign in failed');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">Zeroed</div>
      <div className="auth-tagline">Pay off debt faster.</div>

      <div className="auth-card">
        <div className="auth-title">Sign in</div>

        {error && (
          <div className="bg-red/10 border border-red/25 rounded-xl px-4 py-3 text-sm text-red mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="you@example.com"
              className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••"
              className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="auth-divider">or</div>

        <Button variant="outline" onClick={handleGoogle} type="button"
          className="w-full border-border text-foreground hover:bg-card/80">
          Continue with Google
        </Button>
      </div>

      <div className="auth-footer">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </div>
    </div>
  );
}
