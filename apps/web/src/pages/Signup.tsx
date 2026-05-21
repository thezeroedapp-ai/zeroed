import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const sb = await getSupabase();
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { name, full_name: name } },
      });
      if (error) throw error;
      if (data.session) {
        navigate('/');
      } else {
        setInfo('Check your email to confirm your account, then sign in.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
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
        <div className="auth-title">Create account</div>

        {error && <div className="auth-error">{error}</div>}
        {info && <div style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{info}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button className="btn btn-outline btn-block" onClick={handleGoogle} type="button">
          Continue with Google
        </button>
      </div>

      <div className="auth-footer">
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </div>
  );
}
