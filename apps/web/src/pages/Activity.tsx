import { useEffect, useState } from 'react';

import { apiFetch, fmtD } from '../lib/api';

interface Transaction {
  id: number;
  description: string;
  amount: number;
  transaction_type: 'purchase' | 'payment' | 'interest' | 'fee';
  date: string;
  account_name: string;
  category?: string;
}

const TYPE_ICONS: Record<string, string> = {
  purchase: '🛍️', payment: '✅', interest: '💸', fee: '⚡',
};

function monthKey(date: string) {
  return new Date(date + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function Activity() {
  const [state, setState] = useState<'loading' | 'error' | 'content'>('loading');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [error, setError] = useState('');

  async function load() {
    setState('loading');
    try {
      const r = await apiFetch('/api/transactions');
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const d = await r.json();
      setTransactions(d.transactions || []);
      setState('content');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load activity');
      setState('error');
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.transaction_type === filter);

  const grouped: Record<string, Transaction[]> = {};
  filtered.forEach(t => {
    const k = monthKey(t.date);
    (grouped[k] = grouped[k] || []).push(t);
  });

  return (
    <div className="page">
      <div className="top-bar">
        <h1>Activity</h1>
        <div className="sub">Recent transactions</div>
      </div>

      <div className="content">
        {state === 'loading' && <div className="loading-state"><div className="spinner" /><p>Loading transactions…</p></div>}
        {state === 'error' && (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <p>Could not load activity</p>
            <small>{error}</small>
            <button className="btn btn-primary" onClick={load}>Try Again</button>
          </div>
        )}
        {state === 'content' && (
          <>
            <div className="pills">
              {['all', 'purchase', 'payment', 'interest', 'fee'].map(f => (
                <button key={f} className={`pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📋</div>
                <p>No transactions</p>
                <small>Transactions will appear here after syncing your accounts.</small>
              </div>
            ) : (
              Object.entries(grouped).map(([month, txs]) => (
                <div key={month}>
                  <div className="tx-month">{month}</div>
                  <div className="card" style={{ padding: '0 var(--pad)' }}>
                    {txs.map(tx => (
                      <div key={tx.id} className="tx-row">
                        <div className={`tx-icon ${tx.transaction_type}`}>
                          {TYPE_ICONS[tx.transaction_type] || '💳'}
                        </div>
                        <div className="tx-body">
                          <div className="tx-desc">{tx.description}</div>
                          <div className="tx-card">{tx.account_name}</div>
                        </div>
                        <div className={`tx-amount ${tx.transaction_type === 'payment' ? 'green' : tx.amount > 0 ? 'red' : ''}`}>
                          {tx.transaction_type === 'payment' ? '-' : ''}{fmtD(Math.abs(tx.amount))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

    </div>
  );
}
