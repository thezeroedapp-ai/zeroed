import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const sb = await getSupabase();
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const sb = await getSupabase();
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' },
    });
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">Zeroed</div>
      <div className="auth-tagline">Pay off debt faster.</div>

      <div className="auth-card">
        <div className="auth-title">Sign in</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button className="btn btn-outline btn-block" onClick={handleGoogle} type="button">
          Continue with Google
        </button>
      </div>

      <div className="auth-footer">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </div>
    </div>
  );
}
