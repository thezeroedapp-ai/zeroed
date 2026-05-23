import { useEffect, useState } from 'react';

import { apiFetch, fmtD } from '../lib/api';

interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
  spent: number;
  remaining: number;
  pct: number;
}

const PRESET_CATEGORIES = [
  'Food and Drink', 'Groceries', 'Restaurants', 'Travel', 'Shops',
  'Recreation', 'Entertainment', 'Healthcare', 'Gas Stations',
  'Personal Care', 'Service', 'Bank Fees', 'Other',
];

function progressColor(pct: number): string {
  if (pct >= 100) return 'linear-gradient(90deg, #f43f5e, #fb7185)';
  if (pct >= 80)  return 'linear-gradient(90deg, #f59e0b, #fcd34d)';
  return 'linear-gradient(90deg, #10b981, #34d399)';
}

export default function Budget() {
  const [state, setState]     = useState<'loading' | 'error' | 'content'>('loading');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [error, setError]     = useState('');
  const [form, setForm]       = useState({ category: 'Food and Drink', limit: '' });
  const [saving, setSaving]   = useState(false);

  async function load() {
    setState('loading');
    try {
      const r = await apiFetch('/api/budgets');
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const d = await r.json();
      setBudgets(d.budgets || []);
      setState('content');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load budgets');
      setState('error');
    }
  }

  useEffect(() => { load(); }, []);

  async function addBudget() {
    if (!form.limit) return;
    setSaving(true);
    try {
      await apiFetch('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({ category: form.category, monthly_limit: parseFloat(form.limit) }),
      });
      setForm({ category: 'Food and Drink', limit: '' });
      load();
    } finally { setSaving(false); }
  }

  async function deleteBudget(id: string) {
    if (!confirm('Remove this budget?')) return;
    await apiFetch(`/api/budgets/${id}`, { method: 'DELETE' });
    load();
  }

  const totalBudgeted = budgets.reduce((s, b) => s + b.monthly_limit, 0);
  const totalSpent    = budgets.reduce((s, b) => s + b.spent, 0);
  const overallPct    = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <div className="top-bar">
        <h1>Budget</h1>
        <div className="sub">{month}</div>
      </div>

      <div className="content">
        {state === 'loading' && <div className="loading-state"><div className="spinner" /><p>Loading budgets…</p></div>}
        {state === 'error' && (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <p>Could not load budgets</p>
            <small>{error}</small>
            <button className="btn btn-primary" onClick={load}>Try Again</button>
          </div>
        )}
        {state === 'content' && (
          <>
            {/* Summary strip */}
            {budgets.length > 0 && (
              <>
                <div className="bento" style={{ marginBottom: 16 }}>
                  <div className="card bento-stat" style={{ textAlign: 'center' }}>
                    <div className="card-label">Total Budgeted</div>
                    <div className="stat-value">{fmtD(totalBudgeted)}</div>
                    <div className="stat-sub">per month</div>
                  </div>
                  <div className="card bento-stat" style={{ textAlign: 'center' }}>
                    <div className="card-label">Spent This Month</div>
                    <div className={`stat-value ${totalSpent > totalBudgeted ? 'red' : 'green'}`}>{fmtD(totalSpent)}</div>
                    <div className="stat-sub">{overallPct}% used</div>
                  </div>
                </div>

                <div className="section-title">Your Budgets</div>
                {budgets.map(b => (
                  <div key={b.id} className="card" style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{b.category}</div>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteBudget(b.id)}>Remove</button>
                    </div>

                    <div className="progress-bar" style={{ marginBottom: 8 }}>
                      <div style={{
                        height: '100%', borderRadius: 99,
                        width: `${Math.min(100, b.pct)}%`,
                        background: progressColor(b.pct),
                        transition: 'width 0.4s ease',
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: b.pct >= 100 ? 'var(--red)' : 'var(--text-2)' }}>
                        {fmtD(b.spent)} spent
                        {b.pct >= 100 && ' — over budget'}
                      </span>
                      <span style={{ color: 'var(--text-2)' }}>
                        {b.pct < 100 ? `${fmtD(b.remaining)} left` : ''} of {fmtD(b.monthly_limit)}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Add budget form */}
            <div className="section-title">{budgets.length === 0 ? 'Set Your First Budget' : 'Add Budget'}</div>
            {budgets.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
                Set monthly spending limits per category. We'll track your actual spending from connected accounts automatically.
              </div>
            )}
            <div className="card">
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Monthly Limit ($)</label>
                <input
                  type="number" min="1" step="1" placeholder="e.g. 500"
                  value={form.limit} onChange={e => setForm(p => ({ ...p, limit: e.target.value }))}
                />
              </div>
              <button className="btn btn-primary btn-block" onClick={addBudget} disabled={saving || !form.limit}>
                {saving ? '…' : 'Add Budget'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
