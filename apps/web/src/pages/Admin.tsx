import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface Health {
  status: string;
  checks: { database: string; plaid: string; claude: string; firebase: string };
  timestamp: string;
}

interface AdminUser {
  uid: string;
  id: string;
  name: string;
  email: string;
  is_pro: boolean;
  is_admin: boolean;
  created_at: string;
  ai_uses_this_month: number;
}

export default function Admin() {
  const [health, setHealth] = useState<Health | null>(null);
  const [users, setUsers]   = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch('/api/admin/health').then(r => r.json()),
      apiFetch('/api/admin/users').then(r => r.json()),
    ])
      .then(([h, u]) => {
        setHealth(h as Health);
        setUsers(u as AdminUser[]);
        setLoading(false);
      })
      .catch(err => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, []);

  const togglePro = async (uid: string) => {
    const res = await apiFetch(`/api/admin/users/${uid}/pro`, { method: 'PATCH' });
    if (res.ok) {
      const updated = await res.json() as { uid: string; is_pro: boolean };
      setUsers(prev => prev.map(u => u.uid === updated.uid ? { ...u, is_pro: updated.is_pro } : u));
    }
  };

  const deleteUser = async (uid: string, name: string) => {
    if (!confirm(`Delete ${name}'s account and all their data? This cannot be undone.`)) return;
    const res = await apiFetch(`/api/admin/users/${uid}`, { method: 'DELETE' });
    if (res.ok) setUsers(prev => prev.filter(u => u.uid !== uid));
  };

  const statusClass = (val: string) => {
    if (val === 'ok' || val === 'configured' || val === 'runtime') return 'health-ok';
    if (val === 'error' || val === 'missing') return 'health-error';
    return '';
  };

  if (loading) return <div className="page"><div className="loading-state"><div className="spinner" /></div></div>;
  if (error)   return <div className="page"><div className="error-state"><p>Failed to load admin data</p><small>{error}</small></div></div>;

  return (
    <div className="page">
      <div className="top-bar">
        <h1>Admin</h1>
        <div className="sub">{users.length} user{users.length !== 1 ? 's' : ''} total</div>
      </div>

      <div className="content">

        <div className="section-title">System Health</div>
        <div className="admin-health">
          {health && Object.entries(health.checks).map(([key, val]) => (
            <div key={key} className="card admin-health-item">
              <div className="card-label">{key}</div>
              <div className={`admin-health-status ${statusClass(val)}`}>{val}</div>
            </div>
          ))}
        </div>

        <div className="section-title" style={{ marginTop: 20 }}>Users</div>
        {users.length === 0 ? (
          <div className="empty"><div className="empty-icon">👥</div><p>No users yet</p></div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name / Email</th>
                    <th>Plan</th>
                    <th>AI / mo</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.uid}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-sm)' }}>{u.email}</div>
                        {u.is_admin && <span className="badge badge-yellow" style={{ marginTop: 4 }}>Admin</span>}
                      </td>
                      <td>
                        <span className={`badge ${u.is_pro ? 'badge-blue' : 'badge-gray'}`}>
                          {u.is_pro ? 'Pro' : 'Free'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{u.ai_uses_this_month}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-sm btn-outline" onClick={() => togglePro(u.uid)}>
                            {u.is_pro ? 'Remove Pro' : 'Make Pro'}
                          </button>
                          {!u.is_admin && (
                            <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u.uid, u.name)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
