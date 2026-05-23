import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { apiFetch, fmt, fmtD } from '../lib/api';
import SubNav from '../components/SubNav';

type AccountTab = 'accounts' | 'budget' | 'rewards';

// ─── Accounts tab types ───────────────────────────────────────────────────────

interface Account {
  id: string; name: string; type: string; subtype?: string;
  balance_current: number; balance_available: number | null;
  apr: number | null; minimum_payment: number | null; credit_limit: number | null;
  payment_due_date: string | null; institution_name: string;
}
interface EditState { apr: string; minimum: string; saving: boolean; }

const ASSET_TYPES     = ['depository', 'investment', 'brokerage'];
const LIABILITY_TYPES = ['credit', 'loan', 'mortgage'];
const GROUP_ORDER     = ['Credit Cards', 'Cash & Savings', 'Investments', 'Loans', 'Other'];

function accountGroup(type: string): string {
  if (type === 'credit')                             return 'Credit Cards';
  if (type === 'depository')                         return 'Cash & Savings';
  if (type === 'investment' || type === 'brokerage') return 'Investments';
  if (type === 'loan' || type === 'mortgage')        return 'Loans';
  return 'Other';
}

// ─── Budget tab types ─────────────────────────────────────────────────────────

interface Budget { id: string; category: string; monthly_limit: number; spent: number; remaining: number; pct: number; }

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

// ─── Rewards tab types ────────────────────────────────────────────────────────

interface Category { id: string; icon: string; label: string; }
interface Recommendation {
  rank: number; accountName: string; effectiveRate: number; multiplier: number;
  programName: string; rewardType: string; notes: string; penalized: boolean; earnedDollars: number | null;
}
interface RewardResult { recommendations: Recommendation[]; unmatchedAccounts: string[]; profilesLastUpdated?: string; }

function rankClass(rank: number) { return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : ''; }
function rankLabel(rank: number) { return rank === 1 ? '🥇 Best' : rank === 2 ? '🥈 2nd' : rank === 3 ? '🥉 3rd' : `#${rank}`; }

// ─── Component ────────────────────────────────────────────────────────────────

const ACCOUNT_TABS = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'budget',   label: 'Budget' },
  { id: 'rewards',  label: 'Rewards' },
];

export default function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') || 'accounts') as AccountTab;

  function setTab(t: AccountTab) {
    t === 'accounts' ? setSearchParams({}) : setSearchParams({ tab: t });
  }

  // ── Accounts tab state ──
  const [acctState, setAcctState]   = useState<'loading' | 'error' | 'content'>('loading');
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [acctError, setAcctError]   = useState('');
  const [editing, setEditing]       = useState<Record<string, EditState>>({});

  // ── Budget tab state ──
  const [budgetState, setBudgetState] = useState<'idle' | 'loading' | 'error' | 'content'>('idle');
  const [budgets, setBudgets]         = useState<Budget[]>([]);
  const [budgetError, setBudgetError] = useState('');
  const [budgetForm, setBudgetForm]   = useState({ category: 'Food and Drink', limit: '' });
  const [budgetSaving, setBudgetSaving] = useState(false);

  // ── Rewards tab state ──
  const [rewardsState, setRewardsState] = useState<'idle' | 'loading' | 'error' | 'content'>('idle');
  const [categories, setCategories]     = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [rewardAmount, setRewardAmount] = useState('');
  const [rewardResults, setRewardResults] = useState<RewardResult | null>(null);
  const [updatedNote, setUpdatedNote]   = useState('');
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadAccounts(); }, []);

  useEffect(() => {
    if (tab === 'budget'  && budgetState  === 'idle') loadBudgets();
    if (tab === 'rewards' && rewardsState === 'idle') loadRewardsCategories();
  }, [tab]);

  useEffect(() => {
    if (tab !== 'rewards' || !activeCategory) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchRewards, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, rewardAmount, tab]);

  // ── Accounts tab ──

  async function loadAccounts() {
    setAcctState('loading');
    try {
      const r = await apiFetch('/api/plaid/accounts');
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const d = await r.json();
      setAccounts(d.accounts || []);
      setAcctState('content');
    } catch (e) {
      setAcctError(e instanceof Error ? e.message : 'Could not load accounts');
      setAcctState('error');
    }
  }

  function startEdit(acc: Account) {
    setEditing(prev => ({ ...prev, [acc.id]: { apr: acc.apr?.toString() ?? '', minimum: acc.minimum_payment?.toString() ?? '', saving: false } }));
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
      loadAccounts();
    } catch {
      setEditing(prev => ({ ...prev, [id]: { ...prev[id], saving: false } }));
    }
  }

  const totalAssets = accounts.filter(a => ASSET_TYPES.includes(a.type)).reduce((s, a) => s + (a.balance_current || 0), 0);
  const totalDebt   = accounts.filter(a => LIABILITY_TYPES.includes(a.type)).reduce((s, a) => s + (a.balance_current || 0), 0);
  const netWorth    = totalAssets - totalDebt;

  const byInstitution = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    const key = a.institution_name || 'Unknown Bank';
    (acc[key] = acc[key] || []).push(a);
    return acc;
  }, {});

  // ── Budget tab ──

  async function loadBudgets() {
    setBudgetState('loading');
    try {
      const r = await apiFetch('/api/budgets');
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const d = await r.json();
      setBudgets(d.budgets || []);
      setBudgetState('content');
    } catch (e) {
      setBudgetError(e instanceof Error ? e.message : 'Could not load budgets');
      setBudgetState('error');
    }
  }

  async function addBudget() {
    if (!budgetForm.limit) return;
    setBudgetSaving(true);
    try {
      await apiFetch('/api/budgets', { method: 'POST', body: JSON.stringify({ category: budgetForm.category, monthly_limit: parseFloat(budgetForm.limit) }) });
      setBudgetForm({ category: 'Food and Drink', limit: '' });
      loadBudgets();
    } finally { setBudgetSaving(false); }
  }

  async function deleteBudget(id: string) {
    if (!confirm('Remove this budget?')) return;
    await apiFetch(`/api/budgets/${id}`, { method: 'DELETE' });
    loadBudgets();
  }

  const totalBudgeted = budgets.reduce((s, b) => s + b.monthly_limit, 0);
  const totalSpent    = budgets.reduce((s, b) => s + b.spent, 0);
  const overallPct    = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const month         = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // ── Rewards tab ──

  async function loadRewardsCategories() {
    setRewardsState('loading');
    try {
      const r = await apiFetch('/api/rewards/categories');
      if (!r.ok) throw new Error('Failed to load categories');
      const d = await r.json();
      setCategories(d.categories || []);
      setUpdatedNote(`Profiles last updated: ${d.profilesLastUpdated} · Valuations via The Points Guy`);
      setActiveCategory('dining');
      setRewardsState('content');
    } catch { setRewardsState('error'); }
  }

  async function fetchRewards() {
    if (!activeCategory) return;
    const url = `/api/rewards?category=${activeCategory}${rewardAmount ? '&amount=' + encodeURIComponent(rewardAmount) : ''}`;
    try {
      const r = await apiFetch(url);
      if (!r.ok) throw new Error('Failed');
      setRewardResults(await r.json());
    } catch { setRewardResults(null); }
  }

  return (
    <div className="page">
      <div className="top-bar">
        <h1>Accounts</h1>
        <div className="sub">Balances, budgets, and rewards</div>
      </div>

      <div className="content">
        <SubNav tabs={ACCOUNT_TABS} active={tab} onChange={t => setTab(t as AccountTab)} />

        {/* ── ACCOUNTS TAB ── */}
        {tab === 'accounts' && (
          <>
            {acctState === 'loading' && <div className="loading-state"><div className="spinner" /><p>Loading accounts…</p></div>}
            {acctState === 'error' && (
              <div className="error-state">
                <div className="error-icon">⚠️</div>
                <p>Could not load accounts</p><small>{acctError}</small>
                <button className="btn btn-primary" onClick={loadAccounts}>Try Again</button>
              </div>
            )}
            {acctState === 'content' && (
              accounts.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">💳</div>
                  <p>No accounts connected</p>
                  <small>Connect your bank in Settings to get started.</small>
                </div>
              ) : (
                <>
                  <div className="bento" style={{ marginBottom: 16 }}>
                    <div className="card bento-stat" style={{ textAlign: 'center' }}>
                      <div className="card-label">Total Assets</div>
                      <div className="stat-value green">{fmt(totalAssets)}</div>
                    </div>
                    <div className="card bento-stat" style={{ textAlign: 'center' }}>
                      <div className="card-label">Total Liabilities</div>
                      <div className="stat-value red">{fmt(totalDebt)}</div>
                    </div>
                    <div className="card" style={{ gridColumn: 'span 2', textAlign: 'center', padding: '14px 16px' }}>
                      <div className="card-label">Net Worth</div>
                      <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: netWorth >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {netWorth < 0 ? '-' : ''}{fmt(Math.abs(netWorth))}
                      </div>
                    </div>
                  </div>

                  {Object.entries(byInstitution).map(([bank, accs]) => {
                    const sorted = [...accs].sort((a, b) =>
                      GROUP_ORDER.indexOf(accountGroup(a.type)) - GROUP_ORDER.indexOf(accountGroup(b.type))
                    );
                    return (
                      <div key={bank} className="bank-group">
                        <div className="bank-header">
                          <div className="bank-name">{bank}</div>
                          <div className="bank-count">{accs.length} account{accs.length !== 1 ? 's' : ''}</div>
                        </div>
                        {sorted.map(acc => {
                          const isCredit = acc.type === 'credit';
                          const isAsset  = ASSET_TYPES.includes(acc.type);
                          const group    = accountGroup(acc.type);
                          return (
                            <div key={acc.id}>
                              <div className="account-card" style={{ marginBottom: 0, border: 'none', boxShadow: 'none', padding: '10px 0' }}>
                                <div className="acct-header">
                                  <div>
                                    <div className="acct-name">{acc.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                                      {group}{acc.subtype ? ` · ${acc.subtype}` : ''}
                                    </div>
                                  </div>
                                  <div className="acct-balance" style={{ color: isCredit ? 'var(--red)' : 'var(--green)' }}>
                                    {fmtD(acc.balance_current)}
                                  </div>
                                </div>
                                {isCredit && (
                                  <div className="acct-meta">
                                    {acc.apr != null ? <span><strong>{acc.apr}%</strong> APR</span> : <span style={{ color: 'var(--yellow)' }}>⚠️ APR missing</span>}
                                    {acc.minimum_payment != null ? <span><strong>{fmtD(acc.minimum_payment)}</strong> min</span> : <span style={{ color: 'var(--yellow)' }}>⚠️ Min missing</span>}
                                    {acc.credit_limit && <span><strong>{fmtD(acc.credit_limit)}</strong> limit</span>}
                                    {acc.payment_due_date && <span>Due <strong>{new Date(acc.payment_due_date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong></span>}
                                  </div>
                                )}
                                {isAsset && acc.balance_available != null && (
                                  <div className="acct-meta"><span><strong>{fmtD(acc.balance_available)}</strong> available</span></div>
                                )}
                                {isCredit && (
                                  editing[acc.id] ? (
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
                                      <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: 11, color: 'var(--text-sm)' }}>APR %</label>
                                        <input style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 14, width: '100%' }}
                                          type="number" step="0.01" value={editing[acc.id].apr} placeholder="e.g. 24.99"
                                          onChange={e => setEditing(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], apr: e.target.value } }))} />
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: 11, color: 'var(--text-sm)' }}>Min Payment $</label>
                                        <input style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 14, width: '100%' }}
                                          type="number" step="0.01" value={editing[acc.id].minimum} placeholder="e.g. 35.00"
                                          onChange={e => setEditing(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], minimum: e.target.value } }))} />
                                      </div>
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-primary btn-sm" onClick={() => saveEdit(acc.id)} disabled={editing[acc.id].saving}>
                                          {editing[acc.id].saving ? '…' : 'Save'}
                                        </button>
                                        <button className="btn btn-outline btn-sm" onClick={() => cancelEdit(acc.id)}>Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => startEdit(acc)}>
                                      Edit APR / Min
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              )
            )}
          </>
        )}

        {/* ── BUDGET TAB ── */}
        {tab === 'budget' && (
          <>
            {budgetState === 'loading' && <div className="loading-state"><div className="spinner" /><p>Loading budgets…</p></div>}
            {budgetState === 'error' && (
              <div className="error-state">
                <div className="error-icon">⚠️</div>
                <p>Could not load budgets</p><small>{budgetError}</small>
                <button className="btn btn-primary" onClick={loadBudgets}>Try Again</button>
              </div>
            )}
            {budgetState === 'content' && (
              <>
                {budgets.length > 0 && (
                  <>
                    <div className="bento" style={{ marginBottom: 16 }}>
                      <div className="card bento-stat" style={{ textAlign: 'center' }}>
                        <div className="card-label">Total Budgeted</div>
                        <div className="stat-value">{fmtD(totalBudgeted)}</div>
                        <div className="stat-sub">per month</div>
                      </div>
                      <div className="card bento-stat" style={{ textAlign: 'center' }}>
                        <div className="card-label">Spent — {month}</div>
                        <div className={`stat-value ${totalSpent > totalBudgeted ? 'red' : 'green'}`}>{fmtD(totalSpent)}</div>
                        <div className="stat-sub">{overallPct}% used</div>
                      </div>
                    </div>

                    <div className="section-title">Your Budgets</div>
                    {budgets.map(b => (
                      <div key={b.id} className="card" style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{b.category}</div>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteBudget(b.id)}>Remove</button>
                        </div>
                        <div className="progress-bar" style={{ marginBottom: 8 }}>
                          <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(100, b.pct)}%`, background: progressColor(b.pct), transition: 'width 0.4s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: b.pct >= 100 ? 'var(--red)' : 'var(--text-2)' }}>
                            {fmtD(b.spent)} spent{b.pct >= 100 && ' — over budget'}
                          </span>
                          <span style={{ color: 'var(--text-2)' }}>
                            {b.pct < 100 ? `${fmtD(b.remaining)} left of ` : 'of '}{fmtD(b.monthly_limit)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <div className="section-title">{budgets.length === 0 ? 'Set Your First Budget' : 'Add Budget'}</div>
                {budgets.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
                    Set monthly spending limits per category. We'll track your actual spending automatically.
                  </div>
                )}
                <div className="card">
                  <div className="form-group">
                    <label>Category</label>
                    <select value={budgetForm.category} onChange={e => setBudgetForm(p => ({ ...p, category: e.target.value }))}>
                      {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Monthly Limit ($)</label>
                    <input type="number" min="1" step="1" placeholder="e.g. 500"
                      value={budgetForm.limit} onChange={e => setBudgetForm(p => ({ ...p, limit: e.target.value }))} />
                  </div>
                  <button className="btn btn-primary btn-block" onClick={addBudget} disabled={budgetSaving || !budgetForm.limit}>
                    {budgetSaving ? '…' : 'Add Budget'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── REWARDS TAB ── */}
        {tab === 'rewards' && (
          <>
            {rewardsState === 'loading' && <div className="loading-state"><div className="spinner" /><p>Loading reward profiles…</p></div>}
            {rewardsState === 'error' && (
              <div className="error-state">
                <div className="error-icon">⚠️</div>
                <p>Could not load reward profiles</p>
                <button className="btn btn-primary" onClick={loadRewardsCategories}>Try Again</button>
              </div>
            )}
            {rewardsState === 'content' && (
              <>
                <div className="section-title">Spend Category</div>
                <div className="category-grid">
                  {categories.map(c => (
                    <button key={c.id} className={`cat-btn ${activeCategory === c.id ? 'active' : ''}`} onClick={() => setActiveCategory(c.id)}>
                      <span className="icon">{c.icon}</span>
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Amount</label>
                  <input
                    style={{ flex: 1, padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 15, fontFamily: 'inherit' }}
                    type="number" min="1" step="1" placeholder="$ optional" value={rewardAmount}
                    onChange={e => setRewardAmount(e.target.value)}
                  />
                </div>

                {rewardResults && (
                  rewardResults.recommendations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', fontSize: 14, color: 'var(--text-sm)', lineHeight: 1.6 }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>🃏</div>
                      <div>No connected cards matched a reward profile.</div>
                    </div>
                  ) : (
                    <>
                      {rewardResults.recommendations.map(r => (
                        <div key={r.rank} className={`rec-card ${r.rank === 1 ? 'rank-1' : ''}`}>
                          <div className={`rec-rank ${rankClass(r.rank)}`}>{rankLabel(r.rank)}</div>
                          <div className="rec-name">{r.accountName}</div>
                          {r.penalized && <div className="debt-badge">⚠️ Active balance — ranked lower</div>}
                          <div className="rec-rate">{r.effectiveRate}%<span> effective back</span></div>
                          <div className="rec-detail">
                            {r.rewardType === 'cashback'
                              ? `${r.effectiveRate}% cash back`
                              : `${r.multiplier}x ${r.programName} (${r.effectiveRate}% value)`}
                          </div>
                          {r.earnedDollars != null && !r.penalized && <div className="rec-earn">Earn ${r.earnedDollars.toFixed(2)} on this purchase</div>}
                          {r.earnedDollars != null && r.penalized && <div className="rec-earn" style={{ color: 'var(--yellow)' }}>~${(r.earnedDollars / 0.5).toFixed(2)} if not carrying a balance</div>}
                          <div className="rec-notes">{r.notes}</div>
                        </div>
                      ))}
                      {rewardResults.unmatchedAccounts.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-sm)', textAlign: 'center', padding: '8px 0' }}>
                          Cards not in reward database: {rewardResults.unmatchedAccounts.join(', ')}
                        </div>
                      )}
                    </>
                  )
                )}

                <div style={{ fontSize: 11, color: 'var(--text-sm)', textAlign: 'center', marginTop: 12, paddingBottom: 4 }}>
                  {updatedNote}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
