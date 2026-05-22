import { useEffect, useState } from 'react';

import { apiFetch, fmtD } from '../lib/api';

interface Account {
  id: string;
  name: string;
  balance_current: number;
  apr: number | null;
  minimum_payment: number | null;
  credit_limit: number | null;
  payment_due_date: string | null;
  institution_name: string;
}

interface EditState {
  apr: string;
  minimum: string;
  saving: boolean;
}

export default function Accounts() {
  const [state, setState] = useState<'loading' | 'error' | 'content'>('loading');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError]       = useState('');
  const [editing, setEditing]   = useState<Record<string, EditState>>({});

  async function load() {
    setState('loading');
    try {
      const r = await apiFetch('/api/plaid/accounts');
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const d = await r.json();
      setAccounts(d.accounts || []);
      setState('content');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load accounts');
      setState('error');
    }
  }

  useEffect(() => { load(); }, []);

  function startEdit(acc: Account) {
    setEditing(prev => ({
      ...prev,
      [acc.id]: { apr: acc.apr?.toString() ?? '', minimum: acc.minimum_payment?.toString() ?? '', saving: false },
    }));
  }

  function cancelEdit(id: string) {
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function saveEdit(id: string) {
    const e = editing[id];
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], saving: true } }));
    try {
      const r = await apiFetch(`/api/plaid/accounts/${id}/credit-details`, {
        method: 'PUT',
        body: JSON.stringify({ apr: parseFloat(e.apr), minimum_payment: parseFloat(e.minimum) }),
      });
      if (!r.ok) throw new Error('Save failed');
      cancelEdit(id);
      load();
    } catch {
      setEditing(prev => ({ ...prev, [id]: { ...prev[id], saving: false } }));
    }
  }

  const grouped = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    const key = a.institution_name || 'Unknown Bank';
    (acc[key] = acc[key] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="top-bar">
        <h1>Accounts</h1>
        <div className="sub">Your connected credit cards</div>
      </div>

      <div className="content">
        {state === 'loading' && <div className="loading-state"><div className="spinner" /><p>Loading accounts…</p></div>}
        {state === 'error' && (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <p>Could not load accounts</p>
            <small>{error}</small>
            <button className="btn btn-primary" onClick={load}>Try Again</button>
          </div>
        )}
        {state === 'content' && (
          accounts.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">💳</div>
              <p>No accounts connected</p>
              <small>Connect your bank in Settings to get started.</small>
            </div>
          ) : (
            Object.entries(grouped).map(([bank, accs]) => (
              <div key={bank} className="bank-group">
                <div className="bank-header">
                  <div className="bank-name">{bank}</div>
                  <div className="bank-count">{accs.length} card{accs.length !== 1 ? 's' : ''}</div>
                </div>
                {accs.map(acc => (
                  <div key={acc.id}>
                    <div className="account-card" style={{ marginBottom: 0, border: 'none', boxShadow: 'none', padding: '10px 0' }}>
                      <div className="acct-header">
                        <div className="acct-name">{acc.name}</div>
                        <div className="acct-balance" style={{ color: 'var(--red)' }}>{fmtD(acc.balance_current)}</div>
                      </div>
                      <div className="acct-meta">
                        {acc.apr != null ? (
                          <span><strong>{acc.apr}%</strong> APR</span>
                        ) : (
                          <span style={{ color: 'var(--yellow)' }}>⚠️ APR missing</span>
                        )}
                        {acc.minimum_payment != null ? (
                          <span><strong>{fmtD(acc.minimum_payment)}</strong> min</span>
                        ) : (
                          <span style={{ color: 'var(--yellow)' }}>⚠️ Min missing</span>
                        )}
                        {acc.credit_limit && <span><strong>{fmtD(acc.credit_limit)}</strong> limit</span>}
                        {acc.payment_due_date && (
                          <span>Due <strong>{new Date(acc.payment_due_date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong></span>
                        )}
                      </div>

                      {editing[acc.id] ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-sm)' }}>APR %</label>
                            <input
                              className="form-group input"
                              style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 14, width: '100%' }}
                              type="number" step="0.01" value={editing[acc.id].apr}
                              onChange={e => setEditing(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], apr: e.target.value } }))}
                              placeholder="e.g. 24.99"
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-sm)' }}>Min Payment $</label>
                            <input
                              style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 14, width: '100%' }}
                              type="number" step="0.01" value={editing[acc.id].minimum}
                              onChange={e => setEditing(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], minimum: e.target.value } }))}
                              placeholder="e.g. 35.00"
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => saveEdit(acc.id)} disabled={editing[acc.id].saving}>
                              {editing[acc.id].saving ? '…' : 'Save'}
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={() => cancelEdit(acc.id)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button className="btn btn-outline btn-sm" onClick={() => startEdit(acc)}>Edit APR / Min</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )
        )}
      </div>

    </div>
  );
}
