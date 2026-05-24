import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch, fmt, fmtD } from '../lib/api';
import SubNav from '../components/SubNav';
import AvatarCircle from '@/components/ui/avatar-circle';

type AccountTab = 'accounts' | 'budget' | 'rewards';

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

interface Budget { id: string; category: string; monthly_limit: number; spent: number; remaining: number; pct: number; }
const PRESET_CATEGORIES = ['Food and Drink', 'Groceries', 'Restaurants', 'Travel', 'Shops', 'Recreation', 'Entertainment', 'Healthcare', 'Gas Stations', 'Personal Care', 'Service', 'Bank Fees', 'Other'];

interface Category { id: string; icon: string; label: string; }
interface Recommendation { rank: number; accountName: string; effectiveRate: number; multiplier: number; programName: string; rewardType: string; notes: string; penalized: boolean; earnedDollars: number | null; }
interface RewardResult { recommendations: Recommendation[]; unmatchedAccounts: string[]; profilesLastUpdated?: string; }

function rankLabel(rank: number) { return rank === 1 ? 'Best' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `#${rank}`; }

const ACCOUNT_TABS = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'budget',   label: 'Budget'   },
  { id: 'rewards',  label: 'Rewards'  },
];

export default function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') || 'accounts') as AccountTab;
  function setTab(t: AccountTab) { if (t === 'accounts') setSearchParams({}); else setSearchParams({ tab: t }); }

  const [acctState, setAcctState] = useState<'loading' | 'error' | 'content'>('loading');
  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [acctError, setAcctError] = useState('');
  const [editing, setEditing]     = useState<Record<string, EditState>>({});

  const [confirmBudgetId, setConfirmBudgetId] = useState<string | null>(null);

  const [budgetState, setBudgetState]   = useState<'idle' | 'loading' | 'error' | 'content'>('idle');
  const [budgets, setBudgets]           = useState<Budget[]>([]);
  const [budgetError, setBudgetError]   = useState('');
  const [budgetForm, setBudgetForm]     = useState({ category: 'Food and Drink', limit: '' });
  const [budgetSaving, setBudgetSaving] = useState(false);

  const [rewardsState, setRewardsState]     = useState<'idle' | 'loading' | 'error' | 'content'>('idle');
  const [categories, setCategories]         = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [rewardAmount, setRewardAmount]     = useState('');
  const [rewardResults, setRewardResults]   = useState<RewardResult | null>(null);
  const [updatedNote, setUpdatedNote]       = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  async function loadAccounts() {
    setAcctState('loading');
    try {
      const r = await apiFetch('/api/plaid/accounts');
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const d = await r.json();
      setAccounts(d.accounts || []);
      setAcctState('content');
    } catch (e) { setAcctError(e instanceof Error ? e.message : 'Could not load accounts'); setAcctState('error'); }
  }

  function startEdit(acc: Account) { setEditing(p => ({ ...p, [acc.id]: { apr: acc.apr?.toString() ?? '', minimum: acc.minimum_payment?.toString() ?? '', saving: false } })); }
  function cancelEdit(id: string)  { setEditing(p => { const n = { ...p }; delete n[id]; return n; }); }
  async function saveEdit(id: string) {
    const e = editing[id];
    const apr = parseFloat(e.apr);
    const minimum = parseFloat(e.minimum);
    if (isNaN(apr) || apr < 0 || isNaN(minimum) || minimum < 0) return;
    setEditing(p => ({ ...p, [id]: { ...p[id], saving: true } }));
    try {
      const r = await apiFetch(`/api/plaid/accounts/${id}/credit-details`, { method: 'PUT', body: JSON.stringify({ apr, minimum_payment: minimum }) });
      if (!r.ok) throw new Error('Save failed');
      cancelEdit(id); loadAccounts();
    } catch { setEditing(p => ({ ...p, [id]: { ...p[id], saving: false } })); }
  }

  const totalAssets = accounts.filter(a => ASSET_TYPES.includes(a.type)).reduce((s, a) => s + (a.balance_current || 0), 0);
  const totalDebt   = accounts.filter(a => LIABILITY_TYPES.includes(a.type)).reduce((s, a) => s + (a.balance_current || 0), 0);
  const netWorth    = totalAssets - totalDebt;
  const byInstitution = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    const key = a.institution_name || 'Unknown Bank'; (acc[key] = acc[key] || []).push(a); return acc;
  }, {});

  async function loadBudgets() {
    setBudgetState('loading');
    try {
      const r = await apiFetch('/api/budgets');
      if (!r.ok) throw new Error(`${r.status}`);
      const d = await r.json();
      setBudgets(d.budgets || []); setBudgetState('content');
    } catch (e) { setBudgetError(e instanceof Error ? e.message : 'Could not load'); setBudgetState('error'); }
  }
  async function addBudget() {
    if (!budgetForm.limit) return;
    setBudgetSaving(true);
    try { await apiFetch('/api/budgets', { method: 'POST', body: JSON.stringify({ category: budgetForm.category, monthly_limit: parseFloat(budgetForm.limit) }) }); setBudgetForm({ category: 'Food and Drink', limit: '' }); loadBudgets(); }
    finally { setBudgetSaving(false); }
  }
  async function deleteBudget(id: string) { await apiFetch(`/api/budgets/${id}`, { method: 'DELETE' }); setConfirmBudgetId(null); loadBudgets(); }

  const totalBudgeted = budgets.reduce((s, b) => s + b.monthly_limit, 0);
  const totalSpent    = budgets.reduce((s, b) => s + b.spent, 0);
  const overallPct    = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const month         = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  async function loadRewardsCategories() {
    setRewardsState('loading');
    try {
      const r = await apiFetch('/api/rewards/categories');
      if (!r.ok) throw new Error('Failed');
      const d = await r.json();
      setCategories(d.categories || []); setUpdatedNote(`Updated: ${d.profilesLastUpdated} · via The Points Guy`);
      setActiveCategory('dining'); setRewardsState('content');
    } catch { setRewardsState('error'); }
  }
  async function fetchRewards() {
    if (!activeCategory) return;
    const url = `/api/rewards?category=${activeCategory}${rewardAmount ? '&amount=' + encodeURIComponent(rewardAmount) : ''}`;
    try { const r = await apiFetch(url); if (!r.ok) throw new Error('Failed'); setRewardResults(await r.json()); }
    catch { setRewardResults(null); }
  }

  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-10 px-5 lg:px-10 py-5 top-bar border-b border-border">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Balances, budgets, and rewards</p>
        </div>
      </div>

      <div className="px-6 lg:px-10 pb-[calc(var(--nav-h)+24px)] md:pb-10 pt-8 max-w-3xl mx-auto">
        <SubNav tabs={ACCOUNT_TABS} active={tab} onChange={t => setTab(t as AccountTab)} />

        {/* ── ACCOUNTS TAB ── */}
        {tab === 'accounts' && (
          <>
            {acctState === 'loading' && <div className="flex flex-col items-center py-16 gap-3"><div className="spinner" /><p className="text-sm text-muted-foreground">Loading accounts…</p></div>}
            {acctState === 'error' && (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center"><AlertTriangle size={22} className="text-amber" /></div>
                <p className="font-semibold">Could not load accounts</p>
                <p className="text-sm text-muted-foreground">{acctError}</p>
                <Button onClick={loadAccounts} className="bg-primary hover:bg-primary/90">Try Again</Button>
              </div>
            )}
            {acctState === 'content' && (
              accounts.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center"><CreditCard size={22} className="text-muted-foreground" /></div>
                  <p className="font-semibold">No accounts connected</p>
                  <p className="text-sm text-muted-foreground">Connect your bank in Settings to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Net worth strip */}
                  <div className="grid grid-cols-3 gap-3 mb-1">
                    {[
                      { label: 'Assets',      value: fmt(totalAssets), color: 'text-foreground', accent: '#10b981' },
                      { label: 'Liabilities', value: fmt(totalDebt),   color: 'text-red',        accent: '#ef4444' },
                      { label: 'Net Worth',   value: (netWorth < 0 ? '−' : '') + fmt(Math.abs(netWorth)), color: netWorth >= 0 ? 'text-foreground' : 'text-red', accent: '#7c3aed' },
                    ].map(({ label, value, color, accent }) => (
                      <Card key={label} className="bg-card border-border" style={{ borderLeft: `3px solid ${accent}` }}>
                        <CardContent className="p-4">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                          <p className={cn('text-2xl font-extrabold tabular mt-1 leading-tight', color)}>{value}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Accounts by institution */}
                  {Object.entries(byInstitution).map(([bank, accs]) => {
                    const sorted = [...accs].sort((a, b) => GROUP_ORDER.indexOf(accountGroup(a.type)) - GROUP_ORDER.indexOf(accountGroup(b.type)));
                    return (
                      <Card key={bank} className="bg-card border-border">
                        <CardHeader className="pt-5 pb-4 px-6 border-b border-border">
                          <div className="flex items-center gap-3">
                            <AvatarCircle name={bank} size={34} />
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base font-bold text-foreground">{bank}</CardTitle>
                              <p className="text-xs text-muted-foreground">{accs.length} account{accs.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="px-6 pb-5 space-y-0">
                          {sorted.map((acc, idx) => {
                            const isCredit = acc.type === 'credit';
                            const isAsset  = ASSET_TYPES.includes(acc.type);
                            const group    = accountGroup(acc.type);
                            return (
                              <div key={acc.id} className={cn('py-5 flex items-start gap-3', idx < sorted.length - 1 && 'border-b border-border')}>
                                <AvatarCircle name={acc.name} size={36} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{acc.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {acc.subtype ? acc.subtype.charAt(0).toUpperCase() + acc.subtype.slice(1) : group}
                                  </p>
                                  {isCredit && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {acc.apr != null
                                        ? <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded-md', acc.apr >= 20 ? 'bg-amber-dim text-amber' : 'bg-surface-2 text-muted-foreground')}>{acc.apr}% APR</span>
                                        : <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-amber-dim text-amber">APR missing</span>}
                                      {acc.minimum_payment != null && <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-surface-2 text-muted-foreground">{fmtD(acc.minimum_payment)} min</span>}
                                      {acc.credit_limit && <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-surface-2 text-muted-foreground">{fmtD(acc.credit_limit)} limit</span>}
                                      {acc.payment_due_date && (() => {
                                        const d = new Date(acc.payment_due_date + 'T12:00');
                                        const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
                                        return <span className={cn('text-[11px] px-1.5 py-0.5 rounded-md font-medium', daysLeft <= 7 ? 'bg-red-dim text-red' : 'bg-surface-2 text-muted-foreground')}>Due {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>;
                                      })()}
                                    </div>
                                  )}
                                  {isAsset && acc.balance_available != null && (
                                    <p className="text-xs text-muted-foreground mt-1">{fmtD(acc.balance_available)} available</p>
                                  )}
                                  {isCredit && (
                                    editing[acc.id] ? (
                                      <div className="mt-3 flex flex-wrap gap-2 items-end">
                                        <div className="flex-1 min-w-[100px] space-y-1">
                                          <Label className="text-[10px] text-muted-foreground">APR %</Label>
                                          <Input type="number" step="0.01" placeholder="e.g. 24.99" value={editing[acc.id].apr}
                                            onChange={e => setEditing(p => ({ ...p, [acc.id]: { ...p[acc.id], apr: e.target.value } }))}
                                            className="h-8 text-sm bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
                                        </div>
                                        <div className="flex-1 min-w-[100px] space-y-1">
                                          <Label className="text-[10px] text-muted-foreground">Min Payment $</Label>
                                          <Input type="number" step="0.01" placeholder="e.g. 35.00" value={editing[acc.id].minimum}
                                            onChange={e => setEditing(p => ({ ...p, [acc.id]: { ...p[acc.id], minimum: e.target.value } }))}
                                            className="h-8 text-sm bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
                                        </div>
                                        <div className="flex gap-2">
                                          <Button size="sm" onClick={() => saveEdit(acc.id)} disabled={editing[acc.id].saving} className="h-8 bg-primary hover:bg-primary/90">
                                            {editing[acc.id].saving ? '…' : 'Save'}
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={() => cancelEdit(acc.id)} className="h-8 border-border text-muted-foreground">Cancel</Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button onClick={() => startEdit(acc)} className="mt-2 text-[11px] text-muted-foreground hover:text-violet-light transition-colors font-medium">
                                        Edit APR / Min →
                                      </button>
                                    )
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={cn('text-base font-bold tabular', isCredit ? 'text-red' : 'text-foreground')}>
                                    {fmtD(acc.balance_current)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}

        {/* ── BUDGET TAB ── */}
        {tab === 'budget' && (
          <>
            {budgetState === 'loading' && <div className="flex flex-col items-center py-16 gap-3"><div className="spinner" /><p className="text-sm text-muted-foreground">Loading budgets…</p></div>}
            {budgetState === 'error' && (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center"><AlertTriangle size={22} className="text-amber" /></div>
                <p className="font-semibold">Could not load budgets</p>
                <p className="text-sm text-muted-foreground">{budgetError}</p>
                <Button onClick={loadBudgets} className="bg-primary hover:bg-primary/90">Try Again</Button>
              </div>
            )}
            {budgetState === 'content' && (
              <div className="space-y-4">
                {budgets.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Total Budgeted', value: fmtD(totalBudgeted), sub: 'per month',         color: 'text-foreground' },
                        { label: `Spent — ${month.split(' ')[0]}`, value: fmtD(totalSpent), sub: `${overallPct}% used`, color: totalSpent > totalBudgeted ? 'text-red' : 'text-green' },
                      ].map(({ label, value, sub, color }) => (
                        <Card key={label} className="bg-card border-border text-center">
                          <CardContent className="p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                            <p className={cn('text-xl font-extrabold tabular mt-1', color)}>{value}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="space-y-2">
                      {budgets.map(b => (
                        <Card key={b.id} className="bg-card border-border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-foreground">{b.category}</p>
                              {confirmBudgetId === b.id ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-muted-foreground">Remove?</span>
                                  <Button variant="outline" size="sm" onClick={() => deleteBudget(b.id)} className="h-7 text-xs border-red/30 text-red hover:bg-red-dim">Yes</Button>
                                  <Button variant="outline" size="sm" onClick={() => setConfirmBudgetId(null)} className="h-7 text-xs border-border text-muted-foreground">No</Button>
                                </div>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => setConfirmBudgetId(b.id)} className="h-7 text-xs border-red/30 text-red hover:bg-red-dim">Remove</Button>
                              )}
                            </div>
                            <Progress value={Math.min(100, b.pct)} className={cn('h-1.5', b.pct >= 100 ? '[&>div]:bg-red' : b.pct >= 80 ? '[&>div]:bg-amber' : '[&>div]:bg-green')} />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                              <span className={b.pct >= 100 ? 'text-red' : ''}>{fmtD(b.spent)} spent{b.pct >= 100 && ' — over budget'}</span>
                              <span>{b.pct < 100 ? `${fmtD(b.remaining)} left of ` : 'of '}{fmtD(b.monthly_limit)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}

                <Card className="bg-card border-border">
                  <CardHeader className="pt-4 pb-2 px-4">
                    <CardTitle className="text-sm font-semibold">{budgets.length === 0 ? 'Set Your First Budget' : 'Add Budget'}</CardTitle>
                    {budgets.length === 0 && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Set monthly spending limits per category. We'll track your actual spending automatically.</p>}
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Category</Label>
                      <Select value={budgetForm.category} onValueChange={v => setBudgetForm(p => ({ ...p, category: v }))}>
                        <SelectTrigger className="bg-input border-border text-foreground"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          {PRESET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Monthly Limit ($)</Label>
                      <Input type="number" min="1" step="1" placeholder="e.g. 500" value={budgetForm.limit}
                        onChange={e => setBudgetForm(p => ({ ...p, limit: e.target.value }))}
                        className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
                    </div>
                    <Button onClick={addBudget} disabled={budgetSaving || !budgetForm.limit} className="w-full bg-primary hover:bg-primary/90">
                      {budgetSaving ? '…' : 'Add Budget'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {/* ── REWARDS TAB ── */}
        {tab === 'rewards' && (
          <>
            {rewardsState === 'loading' && <div className="flex flex-col items-center py-16 gap-3"><div className="spinner" /><p className="text-sm text-muted-foreground">Loading reward profiles…</p></div>}
            {rewardsState === 'error' && (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center"><AlertTriangle size={22} className="text-amber" /></div>
                <p className="font-semibold">Could not load reward profiles</p>
                <Button onClick={loadRewardsCategories} className="bg-primary hover:bg-primary/90">Try Again</Button>
              </div>
            )}
            {rewardsState === 'content' && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Spend Category</p>
                  <div className="grid grid-cols-4 gap-2">
                    {categories.map(c => (
                      <button key={c.id} onClick={() => setActiveCategory(c.id)}
                        className={cn('flex flex-col items-center gap-1 p-2.5 rounded-xl border text-[10px] font-medium cursor-pointer font-[inherit] transition-all',
                          activeCategory === c.id ? 'border-[var(--primary)]/50 bg-violet-dim/30 text-violet-light' : 'border-border bg-card text-muted-foreground hover:text-foreground')}>
                        <span className="text-xl">{c.icon}</span>
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Label className="text-sm font-semibold shrink-0">Amount</Label>
                  <Input type="number" min="1" step="1" placeholder="$ optional" value={rewardAmount}
                    onChange={e => setRewardAmount(e.target.value)}
                    className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
                </div>

                {rewardResults && (
                  rewardResults.recommendations.length === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-3 text-center">
                      <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center"><CreditCard size={22} className="text-muted-foreground" /></div>
                      <p className="text-sm text-muted-foreground">No connected cards matched a reward profile.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rewardResults.recommendations.map(r => (
                        <Card key={r.rank} className={cn('bg-card border-border', r.rank === 1 && 'border-yellow-500/30')}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-base font-bold text-foreground pr-12">{r.accountName}</p>
                              <Badge variant="outline" className={cn('shrink-0 text-xs', r.rank === 1 ? 'border-yellow-500/40 text-yellow-400' : r.rank === 2 ? 'border-slate-400/30 text-slate-400' : r.rank === 3 ? 'border-amber-700/30 text-amber-600' : 'border-border text-muted-foreground')}>
                                {rankLabel(r.rank)}
                              </Badge>
                            </div>
                            {r.penalized && <Badge variant="outline" className="text-[10px] border-amber/30 text-amber mb-2 flex items-center gap-1 w-fit"><AlertTriangle size={10} />Active balance — ranked lower</Badge>}
                            <p className="text-2xl font-extrabold text-violet-light">{r.effectiveRate}%<span className="text-sm font-normal text-muted-foreground ml-1">effective back</span></p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {r.rewardType === 'cashback' ? `${r.effectiveRate}% cash back` : `${r.multiplier}x ${r.programName} (${r.effectiveRate}% value)`}
                            </p>
                            {r.earnedDollars != null && (
                              <p className={cn('text-sm font-semibold mt-1.5', r.penalized ? 'text-amber' : 'text-green')}>
                                {r.penalized ? `~$${(r.earnedDollars / 0.5).toFixed(2)} if not carrying a balance` : `Earn $${r.earnedDollars.toFixed(2)} on this purchase`}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{r.notes}</p>
                          </CardContent>
                        </Card>
                      ))}
                      {rewardResults.unmatchedAccounts.length > 0 && (
                        <p className="text-xs text-muted-foreground text-center">Not in database: {rewardResults.unmatchedAccounts.join(', ')}</p>
                      )}
                    </div>
                  )
                )}

                <p className="text-xs text-muted-foreground text-center pb-2">{updatedNote}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
