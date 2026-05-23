import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

import { apiFetch, fmtD } from '../lib/api';

type Tab = 'transactions' | 'trends' | 'recurring';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  account_id: string;
  category?: string;
}

interface TrendPoint {
  month: string;
  [key: string]: string | number;
}

interface TrendsData {
  data: TrendPoint[];
  categories: string[];
}

interface RecurringItem {
  description: string;
  category: string;
  avgAmount: number;
  annualEstimate: number;
  occurrences: number;
  months: number;
  lastDate: string;
}

function monthKey(date: string) {
  return new Date(date + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const CHART_COLORS = ['#7c3aed', '#a78bfa', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4'];

export default function Spending() {
  const [tab, setTab] = useState<Tab>('transactions');

  // Transactions tab
  const [txState, setTxState]       = useState<'loading' | 'error' | 'content'>('loading');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountMap, setAccountMap] = useState<Record<string, string>>({});
  const [filter, setFilter]         = useState<'all' | 'expenses' | 'payments'>('all');
  const [txError, setTxError]       = useState('');

  // Trends tab
  const [trendsState, setTrendsState] = useState<'idle' | 'loading' | 'content' | 'error'>('idle');
  const [trends, setTrends]           = useState<TrendsData | null>(null);

  // Recurring tab
  const [recurringState, setRecurringState] = useState<'idle' | 'loading' | 'content' | 'error'>('idle');
  const [recurring, setRecurring]           = useState<RecurringItem[]>([]);

  async function loadTransactions() {
    setTxState('loading');
    try {
      const [r1, r2] = await Promise.all([
        apiFetch('/api/transactions?limit=100'),
        apiFetch('/api/plaid/accounts'),
      ]);
      if (!r1.ok) throw new Error(`Server returned ${r1.status}`);
      const txData  = await r1.json();
      const accData = r2.ok ? await r2.json() : { accounts: [] };
      const map: Record<string, string> = {};
      (accData.accounts || []).forEach((a: { id: string; name: string }) => { map[a.id] = a.name; });
      setTransactions(txData.transactions || []);
      setAccountMap(map);
      setTxState('content');
    } catch (e) {
      setTxError(e instanceof Error ? e.message : 'Could not load transactions');
      setTxState('error');
    }
  }

  async function loadTrends() {
    setTrendsState('loading');
    try {
      const r = await apiFetch('/api/transactions/trends');
      if (!r.ok) throw new Error('Failed');
      setTrends(await r.json());
      setTrendsState('content');
    } catch { setTrendsState('error'); }
  }

  async function loadRecurring() {
    setRecurringState('loading');
    try {
      const r = await apiFetch('/api/transactions/recurring');
      if (!r.ok) throw new Error('Failed');
      const d = await r.json();
      setRecurring(d.recurring || []);
      setRecurringState('content');
    } catch { setRecurringState('error'); }
  }

  useEffect(() => { loadTransactions(); }, []);

  useEffect(() => {
    if (tab === 'trends'    && trendsState    === 'idle') loadTrends();
    if (tab === 'recurring' && recurringState === 'idle') loadRecurring();
  }, [tab]);

  const filtered = transactions.filter(t => {
    if (filter === 'expenses') return t.amount > 0;
    if (filter === 'payments') return t.amount < 0;
    return true;
  });

  const grouped: Record<string, Transaction[]> = {};
  filtered.forEach(t => {
    const k = monthKey(t.date);
    (grouped[k] = grouped[k] || []).push(t);
  });

  const annualRecurring = recurring.reduce((s, r) => s + r.annualEstimate, 0);

  return (
    <div className="page">
      <div className="top-bar">
        <h1>Spending</h1>
        <div className="sub">Transactions, trends, and subscriptions</div>
      </div>

      <div className="content">
        {/* Tab switcher */}
        <div className="pills" style={{ marginBottom: 16 }}>
          {(['transactions', 'trends', 'recurring'] as Tab[]).map(t => (
            <button key={t} className={`pill ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'transactions' ? 'Transactions' : t === 'trends' ? 'Trends' : 'Recurring'}
            </button>
          ))}
        </div>

        {/* ── TRANSACTIONS TAB ── */}
        {tab === 'transactions' && (
          <>
            {txState === 'loading' && <div className="loading-state"><div className="spinner" /><p>Loading transactions…</p></div>}
            {txState === 'error' && (
              <div className="error-state">
                <div className="error-icon">⚠️</div>
                <p>{txError}</p>
                <button className="btn btn-primary" onClick={loadTransactions}>Try Again</button>
              </div>
            )}
            {txState === 'content' && (
              <>
                <div className="pills" style={{ marginBottom: 12 }}>
                  {(['all', 'expenses', 'payments'] as const).map(f => (
                    <button key={f} className={`pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

                {filtered.length === 0 ? (
                  <div className="empty">
                    <div className="empty-icon">📋</div>
                    <p>No transactions</p>
                    <small>Transactions appear here after syncing in Settings.</small>
                  </div>
                ) : (
                  Object.entries(grouped).map(([month, txs]) => (
                    <div key={month}>
                      <div className="tx-month">{month}</div>
                      <div className="card" style={{ padding: '0 var(--pad)' }}>
                        {txs.map(tx => (
                          <div key={tx.id} className="tx-row">
                            <div className="tx-icon purchase">
                              {tx.amount < 0 ? '✅' : '🛍️'}
                            </div>
                            <div className="tx-body">
                              <div className="tx-desc">{tx.description}</div>
                              <div className="tx-card">
                                {accountMap[tx.account_id] || tx.category || ''}
                              </div>
                            </div>
                            <div className={`tx-amount ${tx.amount < 0 ? 'green' : 'red'}`}>
                              {tx.amount < 0 ? '+' : ''}{fmtD(Math.abs(tx.amount))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </>
        )}

        {/* ── TRENDS TAB ── */}
        {tab === 'trends' && (
          <>
            {trendsState === 'loading' && <div className="loading-state"><div className="spinner" /><p>Loading trends…</p></div>}
            {trendsState === 'error'   && <div className="error-state"><div className="error-icon">⚠️</div><p>Could not load trends</p><button className="btn btn-primary" onClick={loadTrends}>Try Again</button></div>}
            {trendsState === 'content' && trends && (
              trends.data.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">📊</div>
                  <p>Not enough data yet</p>
                  <small>Sync your accounts and come back after a few months of transactions.</small>
                </div>
              ) : (
                <>
                  <div className="card" style={{ marginBottom: 12 }}>
                    <div className="card-label" style={{ marginBottom: 12 }}>Monthly Spending by Category</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={trends.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false}
                          tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                          width={38}
                        />
                        <Tooltip
                          contentStyle={{ background: '#0d1424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, color: '#e2e8f0' }}
                          formatter={(v, name) => [`$${Number(v).toFixed(0)}`, String(name ?? '')]}
                          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        />
                        {trends.categories.map((cat, i) => (
                          <Bar
                            key={cat} dataKey={cat} stackId="a"
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                            radius={i === trends.categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Category legend / breakdown */}
                  <div className="section-title">Top Categories</div>
                  <div className="card" style={{ padding: '0 var(--pad)' }}>
                    {trends.categories.map((cat, i) => {
                      const total = trends.data.reduce((s, d) => s + (Number(d[cat]) || 0), 0);
                      return (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{cat}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtD(total / Math.max(1, trends.data.length))}/mo avg
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )
            )}
          </>
        )}

        {/* ── RECURRING TAB ── */}
        {tab === 'recurring' && (
          <>
            {recurringState === 'loading' && <div className="loading-state"><div className="spinner" /><p>Detecting subscriptions…</p></div>}
            {recurringState === 'error'   && <div className="error-state"><div className="error-icon">⚠️</div><p>Could not detect recurring charges</p><button className="btn btn-primary" onClick={loadRecurring}>Try Again</button></div>}
            {recurringState === 'content' && (
              recurring.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">🔄</div>
                  <p>No recurring charges found</p>
                  <small>Sync more transaction history to detect subscriptions and bills.</small>
                </div>
              ) : (
                <>
                  <div className="card bento-hero" style={{ marginBottom: 12 }}>
                    <div className="card-label">Estimated Annual Subscriptions</div>
                    <div className="hero-value" style={{ color: 'var(--red)' }}>{fmtD(annualRecurring)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                      {fmtD(annualRecurring / 12)}/mo across {recurring.length} recurring charge{recurring.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="section-title">Detected Recurring Charges</div>
                  <div className="card" style={{ padding: '0 var(--pad)' }}>
                    {recurring.map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.description}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                            {r.category} · {r.months} month{r.months !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtD(r.avgAmount)}/mo
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                            {fmtD(r.annualEstimate)}/yr
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
