import { useEffect, useState } from 'react';

import { apiFetch, fmtD } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const SINKING_CATEGORIES = ['car', 'home', 'medical', 'travel', 'education', 'holiday', 'tax', 'other'];

interface SinkingFund { id: string; category: string; monthly_amount: number; label?: string; }
interface PlaidItem { item_id: string; institution_name: string; last_synced?: string; error_status?: string | null; }

export default function Settings() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [income, setIncome] = useState('');
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [sinkingFunds, setSinkingFunds] = useState<SinkingFund[]>([]);
  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([]);
  const [sfForm, setSfForm] = useState({ category: 'car', amount: '', label: '' });
  const [sfSaving, setSfSaving] = useState(false);
  const [appVersion] = useState('4.4');
  const [plaidLoading, setPlaidLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  function loadPlaidScript(): Promise<void> {
    return new Promise(resolve => {
      if ((window as any).Plaid) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
      s.onload = () => resolve();
      document.head.appendChild(s);
    });
  }

  async function connectBank() {
    setPlaidLoading(true);
    try {
      await loadPlaidScript();
      const r = await apiFetch('/api/plaid/create-link-token', { method: 'POST' });
      const { link_token } = await r.json();
      (window as any).Plaid.create({
        token: link_token,
        onSuccess: async (publicToken: string, metadata: any) => {
          await apiFetch('/api/plaid/exchange-token', {
            method: 'POST',
            body: JSON.stringify({ public_token: publicToken, institution_name: metadata.institution?.name }),
          });
          await apiFetch('/api/plaid/sync', { method: 'POST' });
          loadSettings();
        },
        onExit: () => {},
      }).open();
    } finally {
      setPlaidLoading(false);
    }
  }

  async function reconnectItem(itemId: string) {
    setPlaidLoading(true);
    try {
      await loadPlaidScript();
      const r = await apiFetch('/api/plaid/create-link-token/update', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId }),
      });
      const { link_token } = await r.json();
      (window as any).Plaid.create({
        token: link_token,
        onSuccess: async () => {
          await apiFetch('/api/plaid/sync', { method: 'POST' });
          loadSettings();
        },
        onExit: () => {},
      }).open();
    } finally {
      setPlaidLoading(false);
    }
  }

  async function disconnectItem(itemId: string) {
    if (!confirm('Disconnect this bank? All accounts and transactions from this bank will be removed.')) return;
    await apiFetch(`/api/plaid/items/${itemId}`, { method: 'DELETE' });
    loadSettings();
  }

  async function syncNow() {
    setSyncing(true);
    try {
      await apiFetch('/api/plaid/sync', { method: 'POST' });
      loadSettings();
    } finally {
      setSyncing(false);
    }
  }

  async function loadSettings() {
    try {
      const [r1, r2, r3] = await Promise.all([
        apiFetch('/api/sinking-funds/income'),
        apiFetch('/api/sinking-funds'),
        apiFetch('/api/plaid/items'),
      ]);
      if (r1.ok) { const d = await r1.json(); setIncome(d.monthly_income?.toString() || ''); }
      if (r2.ok) { const d = await r2.json(); setSinkingFunds(d.funds || []); }
      if (r3.ok) { const d = await r3.json(); setPlaidItems(d.items || []); }
    } catch { /* ignore */ }
  }

  useEffect(() => { loadSettings(); }, []);

  async function saveIncome() {
    setIncomeLoading(true);
    try {
      await apiFetch('/api/sinking-funds/income', {
        method: 'PUT',
        body: JSON.stringify({ monthly_income: parseFloat(income) }),
      });
    } finally { setIncomeLoading(false); }
  }

  async function addFund() {
    if (!sfForm.amount) return;
    setSfSaving(true);
    try {
      await apiFetch('/api/sinking-funds', {
        method: 'POST',
        body: JSON.stringify({ category: sfForm.category, monthly_amount: parseFloat(sfForm.amount), label: sfForm.label || null }),
      });
      setSfForm({ category: 'car', amount: '', label: '' });
      loadSettings();
    } finally { setSfSaving(false); }
  }

  async function deleteFund(id: string) {
    if (!confirm('Delete this sinking fund?')) return;
    await apiFetch(`/api/sinking-funds/${id}`, { method: 'DELETE' });
    loadSettings();
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="page">
      <div className="top-bar">
        <h1>Settings</h1>
        <div className="sub">App version {appVersion}</div>
      </div>

      <div className="content">

        {/* Monthly Income */}
        <div className="section-title">Monthly Income</div>
        <div className="card">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              style={{ flex: 1, padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 15, fontFamily: 'inherit' }}
              type="number" min="0" step="100" placeholder="$ after tax"
              value={income} onChange={e => setIncome(e.target.value)}
            />
            <button className="btn btn-primary btn-sm" onClick={saveIncome} disabled={incomeLoading}>
              {incomeLoading ? '…' : 'Save'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-sm)', marginTop: 8 }}>
            Monthly take-home pay. Used to calculate surplus for your payoff plan.
          </div>
        </div>

        {/* Sinking Funds */}
        <div className="section-title">Sinking Funds</div>
        <div style={{ fontSize: 12, color: 'var(--text-sm)', marginBottom: 10, lineHeight: 1.5 }}>
          Reserve amounts for known future expenses so they don't derail your payoff plan.
        </div>

        {sinkingFunds.length > 0 && (
          <div className="card" style={{ marginBottom: 10, padding: '0 var(--pad)' }}>
            {sinkingFunds.map(f => (
              <div key={f.id} className="toggle-row">
                <div>
                  <div className="toggle-label">{f.label || f.category.charAt(0).toUpperCase() + f.category.slice(1)}</div>
                  <div className="toggle-sub">{fmtD(f.monthly_amount)}/mo</div>
                </div>
                <button className="btn btn-danger" onClick={() => deleteFund(f.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div className="form-group">
            <label>Category</label>
            <select value={sfForm.category} onChange={e => setSfForm(p => ({ ...p, category: e.target.value }))}>
              {SINKING_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Label (optional)</label>
            <input type="text" placeholder="e.g. Car registration" value={sfForm.label}
              onChange={e => setSfForm(p => ({ ...p, label: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Monthly Amount ($)</label>
            <input type="number" min="1" step="1" placeholder="0"
              value={sfForm.amount} onChange={e => setSfForm(p => ({ ...p, amount: e.target.value }))} />
          </div>
          <button className="btn btn-primary btn-block" onClick={addFund} disabled={sfSaving || !sfForm.amount}>
            {sfSaving ? '…' : 'Add Sinking Fund'}
          </button>
        </div>

        {/* Connected Banks */}
        <div className="section-title">Connected Banks</div>

        {plaidItems.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-sm)', fontSize: 14, marginBottom: 10 }}>
            No banks connected yet.
          </div>
        ) : (
          plaidItems.map(item => (
            <div key={item.item_id} className="card" style={{ marginBottom: 10 }}>
              {item.error_status === 'ITEM_LOGIN_REQUIRED' && (
                <div style={{
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 8, padding: '8px 12px', marginBottom: 10,
                  fontSize: 13, color: '#f87171',
                }}>
                  Bank connection expired — please reconnect to resume syncing.
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{item.institution_name}</div>
                  {item.last_synced && (
                    <div style={{ fontSize: 12, color: 'var(--text-sm)', marginTop: 2 }}>
                      Synced {new Date(item.last_synced).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {item.error_status === 'ITEM_LOGIN_REQUIRED' ? (
                    <button className="btn btn-primary btn-sm" onClick={() => reconnectItem(item.item_id)} disabled={plaidLoading}>
                      Reconnect
                    </button>
                  ) : null}
                  <button className="btn btn-danger btn-sm" onClick={() => disconnectItem(item.item_id)}>
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-block" onClick={connectBank} disabled={plaidLoading} style={{ flex: 1 }}>
            {plaidLoading ? '…' : '+ Connect Bank'}
          </button>
          {plaidItems.length > 0 && (
            <button className="btn btn-sm" onClick={syncNow} disabled={syncing} style={{ whiteSpace: 'nowrap' }}>
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          )}
        </div>

        {/* Account */}
        <div className="section-title">Account</div>
        <div className="card">
          <button className="btn btn-danger btn-block" onClick={handleSignOut}>Sign Out</button>
        </div>

      </div>

    </div>
  );
}
