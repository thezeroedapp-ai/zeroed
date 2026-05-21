import { useEffect, useState } from 'react';

import { apiFetch, fmt, fmtD } from '../lib/api';

interface Goal {
  id: number;
  goal_type: 'debt_free_date' | 'account_payoff' | 'balance_target';
  account_id?: number;
  account_name?: string;
  target_date?: string;
  target_amount?: number;
  label?: string;
  onTrack?: boolean;
  requiredExtra?: number;
  projectedDate?: string;
  progress?: number;
  milestones?: { label: string; date: string; done: boolean; next: boolean }[];
}

interface Account { id: number; name: string; balance_current: number; }

export default function Goals() {
  const [state, setState] = useState<'loading' | 'error' | 'content'>('loading');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'debt_free_date', accountId: '', targetDate: '', targetAmount: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setState('loading');
    try {
      const [r1, r2] = await Promise.all([apiFetch('/api/goals'), apiFetch('/api/plaid/accounts')]);
      if (!r1.ok) throw new Error('Could not load goals');
      const d1 = await r1.json();
      const d2 = r2.ok ? await r2.json() : { accounts: [] };
      setGoals(d1.goals || []);
      setAccounts(d2.accounts || []);
      setState('content');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load goals');
      setState('error');
    }
  }

  useEffect(() => { load(); }, []);

  async function addGoal() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { goal_type: form.type };
      if (form.type !== 'debt_free_date' && form.accountId) body.account_id = parseInt(form.accountId);
      if (form.targetDate) body.target_date = form.targetDate;
      if (form.targetAmount) body.target_amount = parseFloat(form.targetAmount);
      await apiFetch('/api/goals', { method: 'POST', body: JSON.stringify(body) });
      setShowForm(false);
      setForm({ type: 'debt_free_date', accountId: '', targetDate: '', targetAmount: '' });
      load();
    } finally { setSaving(false); }
  }

  async function deleteGoal(id: number) {
    if (!confirm('Delete this goal?')) return;
    await apiFetch(`/api/goals/${id}`, { method: 'DELETE' });
    load();
  }

  function goalLabel(g: Goal) {
    if (g.label) return g.label;
    if (g.goal_type === 'debt_free_date') return 'Debt-Free Date';
    if (g.account_name) return `Pay off ${g.account_name}`;
    return 'Goal';
  }

  return (
    <div className="page">
      <div className="top-bar">
        <h1>Goals</h1>
        <div className="sub">Track your debt milestones</div>
      </div>

      <div className="content">
        {state === 'loading' && <div className="loading-state"><div className="spinner" /><p>Loading goals…</p></div>}
        {state === 'error' && (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <p>Could not load goals</p>
            <small>{error}</small>
            <button className="btn btn-primary" onClick={load}>Try Again</button>
          </div>
        )}
        {state === 'content' && (
          <>
            {goals.length === 0 && !showForm && (
              <div className="empty">
                <div className="empty-icon">🎯</div>
                <p>No goals yet</p>
                <small>Add a goal to track your progress toward debt freedom.</small>
              </div>
            )}

            {goals.map(g => (
              <div key={g.id} className={`goal-card ${g.onTrack ? 'on-track' : 'off-track'}`}>
                <div className="goal-header">
                  <div>
                    <div className="goal-type">{g.goal_type.replace(/_/g, ' ')}</div>
                    <div className="goal-label">{goalLabel(g)}</div>
                    {g.target_date && (
                      <div className="goal-meta">Target: {new Date(g.target_date + 'T12:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                    )}
                    {g.target_amount && <div className="goal-meta">Target: {fmtD(g.target_amount)}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span className={`goal-status-badge ${g.onTrack ? 'on-track' : 'off-track'}`}>
                      {g.onTrack ? '✅ On track' : '⚠️ Off track'}
                    </span>
                    <button className="btn btn-danger" onClick={() => deleteGoal(g.id)}>Delete</button>
                  </div>
                </div>

                {g.progress != null && (
                  <div className="progress-wrap">
                    <div className="progress-bar">
                      <div className="progress-fill blue" style={{ width: `${Math.min(g.progress, 100)}%` }} />
                    </div>
                    <div className="progress-labels">
                      <span>{g.progress.toFixed(0)}% complete</span>
                      {g.projectedDate && <span>Projected: {g.projectedDate}</span>}
                    </div>
                  </div>
                )}

                {g.requiredExtra != null && g.requiredExtra > 0 && (
                  <div className="goal-action">
                    Needs <strong>+{fmt(g.requiredExtra)}/mo</strong> extra to stay on track.
                  </div>
                )}

                {g.milestones && g.milestones.length > 0 && (
                  <div className="milestone-list" style={{ marginTop: 12 }}>
                    {g.milestones.map((m, i) => (
                      <div key={i} className="milestone-row">
                        <div className={`milestone-dot ${m.done ? 'done' : m.next ? 'next' : ''}`}>
                          {m.done ? '✓' : m.next ? '→' : '○'}
                        </div>
                        <div className="milestone-body">
                          <div className="milestone-title">{m.label}</div>
                        </div>
                        <div className="milestone-right">{m.date}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {showForm && (
              <div className="card" style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>New Goal</div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="debt_free_date">Debt-Free Date</option>
                    <option value="account_payoff">Pay Off Card</option>
                    <option value="balance_target">Balance Target</option>
                  </select>
                </div>
                {form.type !== 'debt_free_date' && (
                  <div className="form-group">
                    <label>Card</label>
                    <select value={form.accountId} onChange={e => setForm(p => ({ ...p, accountId: e.target.value }))}>
                      <option value="">Select card…</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Target Date</label>
                  <input type="date" value={form.targetDate} onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))} />
                </div>
                {form.type === 'balance_target' && (
                  <div className="form-group">
                    <label>Target Balance ($)</label>
                    <input type="number" value={form.targetAmount} onChange={e => setForm(p => ({ ...p, targetAmount: e.target.value }))} placeholder="0.00" />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={addGoal} disabled={saving}>{saving ? '…' : 'Add Goal'}</button>
                  <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </div>
            )}

            {!showForm && (
              <button className="btn btn-primary btn-block mt-12" onClick={() => setShowForm(true)}>+ Add Goal</button>
            )}
          </>
        )}
      </div>

    </div>
  );
}
