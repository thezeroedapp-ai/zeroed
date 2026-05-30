import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Widget, WidgetHeader } from '@/components/ui/widget';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlimProgress } from '@/components/ui/slim-progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Target, DollarSign, CalendarDays, Flame, Layers, Shuffle, TrendingUp, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch, fmt, fmtD } from '../lib/api';
import SubNav from '../components/SubNav';

type PlanTab = 'strategy' | 'goals' | 'insights';
type Strategy = 'avalanche' | 'snowball' | 'hybrid' | 'cashflow';

const STRATEGIES: { id: Strategy; name: string; sub: string; best: string; Icon: LucideIcon }[] = [
  { id: 'avalanche', name: 'Avalanche',  sub: 'Highest APR first',       best: 'Min total interest',     Icon: Flame      },
  { id: 'snowball',  name: 'Snowball',   sub: 'Smallest balance first',   best: 'Fast wins, motivation',  Icon: Layers     },
  { id: 'hybrid',    name: 'Hybrid',     sub: 'APR + balance weighted',   best: 'Balanced approach',      Icon: Shuffle    },
  { id: 'cashflow',  name: 'Cash Flow',  sub: 'Free up minimums fastest', best: 'Maximize monthly cash',  Icon: TrendingUp },
];

interface PlanCard { name: string; balance_current: number; apr: number; minimum_payment: number; payoffMonth?: number; payoffDate?: string; }
interface PlanData {
  strategy: Strategy; months: number; totalInterest: number; debtFreeDate: string;
  surplus: number; sinkingFundTotal: number; monthlyIncome: number; cards: PlanCard[];
  scenarios?: { extra: number; months: number; interestSaved: number }[];
}
interface LumpResult { monthsSaved: number; interestSaved: number; newDebtFreeDate: string; }
interface ReqResult  { extra: number; feasible: boolean; }

interface Goal {
  id: string; goal_type: 'debt_free_date' | 'account_payoff' | 'balance_target';
  account_id?: string; account_name?: string; target_date?: string; target_amount?: number;
  label?: string; onTrack?: boolean; requiredExtra?: number; projectedDate?: string;
  progress?: number; milestones?: { label: string; date: string; done: boolean; next: boolean }[];
}
interface GoalAccount { id: string; name: string; balance_current: number; }

interface InsightData {
  insight: { id: string; insight: string; generated_at: string } | null;
  used: number; limit: number | null; remaining: number | null; isPro: boolean;
}

const PLAN_TABS = [
  { id: 'strategy', label: 'Strategy' },
  { id: 'goals',    label: 'Goals' },
  { id: 'insights', label: 'AI Insights' },
];

export default function Plan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') || 'strategy') as PlanTab;
  function setTab(t: PlanTab) { t === 'strategy' ? setSearchParams({}) : setSearchParams({ tab: t }); }

  const [planState, setPlanState]   = useState<'loading' | 'error' | 'content'>('loading');
  const [plan, setPlan]             = useState<PlanData | null>(null);
  const [strategy, setStrategy]     = useState<Strategy>('avalanche');
  const [planError, setPlanError]   = useState('');
  const [lumpAmount, setLumpAmount] = useState('');
  const [lumpResult, setLumpResult] = useState<LumpResult | null>(null);
  const [lumpLoading, setLumpLoading] = useState(false);
  const [reqDate, setReqDate]       = useState('');
  const [reqResult, setReqResult]   = useState<ReqResult | null>(null);
  const [reqLoading, setReqLoading] = useState(false);

  const [goalsState, setGoalsState] = useState<'idle' | 'loading' | 'error' | 'content'>('idle');
  const [goals, setGoals]           = useState<Goal[]>([]);
  const [goalAccounts, setGoalAccounts] = useState<GoalAccount[]>([]);
  const [goalsError, setGoalsError] = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ type: 'debt_free_date', accountId: '', targetDate: '', targetAmount: '' });
  const [saving, setSaving]         = useState(false);

  const [insightState, setInsightState] = useState<'idle' | 'loading' | 'error' | 'content'>('idle');
  const [insightData, setInsightData]   = useState<InsightData | null>(null);
  const [generating, setGenerating]     = useState(false);
  const [insightError, setInsightError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => { loadPlan(); }, []);
  useEffect(() => {
    if (tab === 'goals'    && goalsState   === 'idle') loadGoals();
    if (tab === 'insights' && insightState === 'idle') loadInsights();
  }, [tab]);

  async function loadPlan(strat: Strategy = strategy) {
    setPlanState('loading');
    try {
      const r = await apiFetch('/api/plan/generate', { method: 'POST', body: JSON.stringify({ strategy: strat }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `Server returned ${r.status}`);
      setPlan(d.plan);
      setPlanState('content');
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : 'Could not load plan');
      setPlanState('error');
    }
  }

  function selectStrategy(s: Strategy) { setStrategy(s); loadPlan(s); }

  async function calcLump() {
    if (!lumpAmount) return;
    setLumpLoading(true);
    try {
      const r = await apiFetch('/api/plan/lump-sum', { method: 'POST', body: JSON.stringify({ strategy, amount: parseFloat(lumpAmount) }) });
      setLumpResult(await r.json());
    } finally { setLumpLoading(false); }
  }

  async function calcRequired() {
    if (!reqDate) return;
    setReqLoading(true);
    try {
      const r = await apiFetch('/api/plan/required-payment', { method: 'POST', body: JSON.stringify({ strategy, targetDate: reqDate }) });
      setReqResult(await r.json());
    } finally { setReqLoading(false); }
  }

  async function loadGoals() {
    setGoalsState('loading');
    try {
      const [r1, r2] = await Promise.all([apiFetch('/api/goals'), apiFetch('/api/plaid/accounts')]);
      if (!r1.ok) throw new Error('Could not load goals');
      const d1 = await r1.json();
      const d2 = r2.ok ? await r2.json() : { accounts: [] };
      setGoals(d1.goals || []);
      setGoalAccounts((d2.accounts || []).filter((a: { type: string }) => a.type === 'credit'));
      setGoalsState('content');
    } catch (e) {
      setGoalsError(e instanceof Error ? e.message : 'Could not load goals');
      setGoalsState('error');
    }
  }

  async function addGoal() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { goal_type: form.type };
      if (form.type !== 'debt_free_date' && form.accountId) body.account_id = form.accountId;
      if (form.targetDate)   body.target_date   = form.targetDate;
      if (form.targetAmount) body.target_amount = parseFloat(form.targetAmount);
      await apiFetch('/api/goals', { method: 'POST', body: JSON.stringify(body) });
      setShowForm(false);
      setForm({ type: 'debt_free_date', accountId: '', targetDate: '', targetAmount: '' });
      loadGoals();
    } finally { setSaving(false); }
  }

  async function deleteGoal(id: string) {
    await apiFetch(`/api/goals/${id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    loadGoals();
  }

  function goalLabel(g: Goal) {
    if (g.label)                          return g.label;
    if (g.goal_type === 'debt_free_date') return 'Debt-Free Date';
    if (g.account_name)                   return `Pay off ${g.account_name}`;
    return 'Goal';
  }

  async function loadInsights() {
    setInsightState('loading');
    try {
      const r = await apiFetch('/api/insights/latest');
      if (!r.ok) throw new Error('Failed');
      setInsightData(await r.json());
      setInsightState('content');
    } catch { setInsightState('error'); }
  }

  async function generateInsight() {
    setGenerating(true);
    setInsightError('');
    try {
      const r = await apiFetch('/api/insights/generate', { method: 'POST' });
      const d = await r.json();
      if (r.status === 429) {
        setInsightError(d.error || 'Monthly limit reached. Resets next month.');
        return;
      }
      setInsightData(d);
      setInsightState('content');
    } finally { setGenerating(false); }
  }

  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-20 w-full bg-background/60 backdrop-blur-2xl border-b border-white/10">
        <div className="w-full max-w-[2560px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16">
          <div className="flex items-center justify-between gap-4 pt-5 pb-2">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Plan</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Your debt-free roadmap</p>
            </div>
          </div>
          <SubNav tabs={PLAN_TABS} active={tab} onChange={t => setTab(t as PlanTab)}
            className="mb-0 border-b-0 mx-0 px-0 py-2" />
        </div>
      </div>

      <PageLayout className="pt-4 pb-20 md:pb-10">

        {/* ── STRATEGY TAB ── */}
        {tab === 'strategy' && (
          <>
            {planState === 'loading' && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="spinner" /><p className="text-sm text-muted-foreground">Calculating your plan…</p>
              </div>
            )}
            {planState === 'error' && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center"><AlertTriangle size={22} className="text-amber" /></div>
                <p className="font-semibold">Could not load plan</p>
                <p className="text-sm text-muted-foreground">{planError}</p>
                <Button onClick={() => loadPlan()} className="bg-primary hover:bg-primary/90">Try Again</Button>
              </div>
            )}
            {planState === 'content' && plan && (
              <div className="space-y-5">
                {/* Strategy selector */}
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3">Strategy</p>
                  <div className="grid grid-cols-2 gap-2">
                    {STRATEGIES.map(s => (
                      <button
                        key={s.id}
                        onClick={() => selectStrategy(s.id)}
                        className={cn(
                          'flex flex-col gap-1.5 p-5 rounded-xl border text-left transition-all cursor-pointer font-[inherit]',
                          strategy === s.id
                            ? 'border-[var(--primary)]/50 bg-violet-dim/30 ring-1 ring-[var(--primary)]/20'
                            : 'border-border bg-card hover:border-border/60',
                        )}
                      >
                        <s.Icon size={20} className={strategy === s.id ? 'text-violet-light' : 'text-muted-foreground'} />
                        <span className="text-sm font-bold text-foreground">{s.name}</span>
                        <span className="text-xs text-muted-foreground">{s.sub}</span>
                        <Badge variant="outline" className={cn('text-[10px] w-fit mt-0.5', strategy === s.id ? 'border-[var(--primary)]/40 text-violet-light' : 'border-border text-muted-foreground')}>
                          {s.best}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Debt-free summary */}
                <Widget>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Debt-Free Date</p>
                  <p className="text-4xl font-extrabold text-foreground">{plan.debtFreeDate}</p>
                  <div className="flex flex-wrap gap-3">
                    <span className="text-xs text-muted-foreground">{plan.months} months</span>
                    <span className="text-xs text-red">{fmtD(plan.totalInterest)} total interest</span>
                    <span className="text-xs text-green">{fmtD(plan.surplus)}/mo surplus</span>
                  </div>
                </Widget>

                {/* Scenarios */}
                {plan.scenarios && plan.scenarios.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-3">Pay More Scenarios</p>
                    <div className="grid grid-cols-3 gap-2">
                      {plan.scenarios.map((sc, i) => (
                        <Widget key={i} className="text-center items-center">
                          <p className="text-xs text-muted-foreground font-semibold">+{fmt(sc.extra)}/mo</p>
                          <p className="text-2xl font-extrabold text-foreground">{sc.months}</p>
                          <p className="text-xs text-muted-foreground">months</p>
                          <p className="text-xs text-green font-semibold">Save {fmt(sc.interestSaved)}</p>
                        </Widget>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attack order */}
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3">Attack Order</p>
                  <Widget className="p-0 overflow-hidden">
                    {plan.cards.map((c, i) => (
                      <div key={i} className={cn('flex items-center gap-3 px-5 py-4', i < plan.cards.length - 1 && 'border-b border-border')}>
                        <div className="w-7 h-7 rounded-full bg-violet-dim border border-[var(--primary)]/30 text-violet-light text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{c.apr}% APR · {fmtD(c.minimum_payment)}/mo min</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold tabular text-foreground">{fmtD(c.balance_current)}</p>
                          {c.payoffDate && <p className="text-xs text-green mt-0.5">Free {c.payoffDate}</p>}
                        </div>
                      </div>
                    ))}
                  </Widget>
                </div>

                {/* Lump-sum */}
                <Widget>
                  <WidgetHeader title="Lump-Sum Simulator" icon={<DollarSign size={14} />} />
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        type="number" min="1" placeholder="$ extra payment"
                        value={lumpAmount}
                        onChange={e => { setLumpAmount(e.target.value); setLumpResult(null); }}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-[var(--primary)]/50"
                      />
                      <Button onClick={calcLump} disabled={!lumpAmount || lumpLoading} className="bg-primary hover:bg-primary/90 shrink-0">
                        {lumpLoading ? '…' : 'Calculate'}
                      </Button>
                    </div>
                    {lumpResult && (
                      <div className="p-3 rounded-lg bg-green-dim border border-green/20 text-sm text-green">
                        <p className="font-bold text-base">Done by {lumpResult.newDebtFreeDate}</p>
                        <p className="mt-0.5 text-xs">Saves {lumpResult.monthsSaved} month{lumpResult.monthsSaved !== 1 ? 's' : ''} and {fmtD(lumpResult.interestSaved)} in interest</p>
                      </div>
                    )}
                  </div>
                </Widget>

                {/* Required payment */}
                <Widget>
                  <div>
                    <WidgetHeader title="Required Payment Calculator" icon={<CalendarDays size={14} />} />
                    <p className="text-xs text-muted-foreground mt-1">How much extra/mo to be debt-free by a target date?</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        type="date" value={reqDate}
                        onChange={e => { setReqDate(e.target.value); setReqResult(null); }}
                        className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50"
                      />
                      <Button onClick={calcRequired} disabled={!reqDate || reqLoading} className="bg-primary hover:bg-primary/90 shrink-0">
                        {reqLoading ? '…' : 'Calculate'}
                      </Button>
                    </div>
                    {reqResult && (
                      <div className={cn('p-3 rounded-lg border text-sm', !reqResult.feasible ? 'bg-red-dim border-red/20 text-red' : reqResult.extra === 0 ? 'bg-green-dim border-green/20 text-green' : 'bg-violet-dim/30 border-[var(--primary)]/30 text-violet-light')}>
                        {!reqResult.feasible ? (
                          <><p className="text-base font-extrabold">Not achievable</p><p className="text-xs mt-0.5">That date is before the minimum payment payoff. Try a later date.</p></>
                        ) : reqResult.extra === 0 ? (
                          <><p className="text-base font-extrabold">No extra needed</p><p className="text-xs mt-0.5">Minimum payments already get you there.</p></>
                        ) : (
                          <><p className="text-2xl font-extrabold tabular">+{fmtD(reqResult.extra)}/mo</p><p className="text-xs mt-0.5">Extra payment needed on top of minimums.</p></>
                        )}
                      </div>
                    )}
                  </div>
                </Widget>
              </div>
            )}
          </>
        )}

        {/* ── GOALS TAB ── */}
        {tab === 'goals' && (
          <>
            {goalsState === 'loading' && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="spinner" /><p className="text-sm text-muted-foreground">Loading goals…</p>
              </div>
            )}
            {goalsState === 'error' && (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center"><AlertTriangle size={22} className="text-amber" /></div>
                <p className="font-semibold">Could not load goals</p>
                <p className="text-sm text-muted-foreground">{goalsError}</p>
                <Button onClick={loadGoals} className="bg-primary hover:bg-primary/90">Try Again</Button>
              </div>
            )}
            {goalsState === 'content' && (
              <div className="space-y-3">
                {goals.length === 0 && !showForm && (
                  <div className="flex flex-col items-center py-16 gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center"><Target size={22} className="text-muted-foreground" /></div>
                    <p className="font-semibold">No goals yet</p>
                    <p className="text-sm text-muted-foreground">Add a goal to track your path to debt freedom.</p>
                  </div>
                )}

                {goals.map(g => (
                  <Widget key={g.id} className={cn('border-l-4', g.onTrack ? 'border-l-green' : 'border-l-amber')}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{g.goal_type.replace(/_/g, ' ')}</p>
                          <p className="text-base font-semibold text-foreground mt-0.5">{goalLabel(g)}</p>
                          {g.target_date && <p className="text-xs text-muted-foreground mt-1">Target: {new Date(g.target_date + 'T12:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
                          {g.target_amount && <p className="text-xs text-muted-foreground mt-1">Target: {fmtD(g.target_amount)}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Badge variant="outline" className={cn('text-xs', g.onTrack ? 'bg-green-dim text-green border-green/20' : 'bg-amber-dim text-amber border-amber/20')}>
                            {g.onTrack ? 'On track' : 'Off track'}
                          </Badge>
                          {confirmDeleteId === g.id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Delete?</span>
                              <Button variant="outline" size="sm" onClick={() => deleteGoal(g.id)} className="h-7 text-xs border-red/30 text-red hover:bg-red-dim">Yes</Button>
                              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)} className="h-7 text-xs border-border text-muted-foreground">No</Button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(g.id)} className="text-xs h-7 border-red/30 text-red hover:bg-red-dim">Delete</Button>
                          )}
                        </div>
                      </div>

                      {g.progress != null && (
                        <div className="mt-3">
                          <SlimProgress
                            value={Math.min(g.progress, 100)}
                            label={`${g.progress.toFixed(0)}% complete`}
                            sublabel={g.projectedDate ?? undefined}
                          />
                        </div>
                      )}

                      {g.requiredExtra != null && g.requiredExtra > 0 && (
                        <div className="mt-3 p-2 rounded-lg bg-surface-2 text-xs text-muted-foreground">
                          Needs <span className="font-bold text-violet-light">+{fmt(g.requiredExtra)}/mo</span> extra to stay on track.
                        </div>
                      )}

                      {g.milestones && g.milestones.length > 0 && (
                        <div className="mt-3 space-y-0">
                          <Separator className="bg-border mb-2" />
                          {g.milestones.map((m, i) => (
                            <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                              <div className={cn('w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs border-2', m.done ? 'bg-green border-green text-white' : m.next ? 'bg-primary border-primary text-white' : 'bg-surface-2 border-border text-muted-foreground')}>
                                {m.done ? '✓' : m.next ? '→' : '○'}
                              </div>
                              <p className="flex-1 text-sm font-medium text-foreground">{m.label}</p>
                              <p className="text-xs text-muted-foreground">{m.date}</p>
                            </div>
                          ))}
                        </div>
                      )}
                  </Widget>
                ))}

                {showForm && (
                  <Widget>
                    <WidgetHeader title="New Goal" />
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Type</Label>
                        <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                          <SelectTrigger className="bg-input border-border text-foreground"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="debt_free_date">Debt-Free Date</SelectItem>
                            <SelectItem value="account_payoff">Pay Off Card</SelectItem>
                            <SelectItem value="balance_target">Balance Target</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {form.type !== 'debt_free_date' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Card</Label>
                          <Select value={form.accountId} onValueChange={v => setForm(p => ({ ...p, accountId: v }))}>
                            <SelectTrigger className="bg-input border-border text-foreground"><SelectValue placeholder="Select card…" /></SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                              {goalAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Target Date</Label>
                        <Input type="date" value={form.targetDate} onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))} className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
                      </div>
                      {form.type === 'balance_target' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Target Balance ($)</Label>
                          <Input type="number" value={form.targetAmount} onChange={e => setForm(p => ({ ...p, targetAmount: e.target.value }))} placeholder="0.00" className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button onClick={addGoal} disabled={saving} className="bg-primary hover:bg-primary/90">{saving ? '…' : 'Add Goal'}</Button>
                        <Button variant="outline" onClick={() => setShowForm(false)} className="border-border text-muted-foreground hover:text-foreground">Cancel</Button>
                      </div>
                    </div>
                  </Widget>
                )}

                {!showForm && (
                  <Button onClick={() => setShowForm(true)} className="w-full bg-primary hover:bg-primary/90">+ Add Goal</Button>
                )}
              </div>
            )}
          </>
        )}

        {/* ── INSIGHTS TAB ── */}
        {tab === 'insights' && (
          <>
            {insightState === 'loading' && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="spinner" /><p className="text-sm text-muted-foreground">Loading insights…</p>
              </div>
            )}
            {insightState === 'error' && (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center"><AlertTriangle size={22} className="text-amber" /></div>
                <p className="font-semibold">Could not load insights</p>
                <Button onClick={loadInsights} className="bg-primary hover:bg-primary/90">Try Again</Button>
              </div>
            )}
            {insightState === 'content' && insightData && (
              <div className="space-y-4">
                <Widget>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">AI Spending Analysis</p>
                      {insightData.insight?.generated_at && (
                        <p className="text-xs text-muted-foreground mt-1">{new Date(insightData.insight.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                      {insightData.isPro ? 'Pro — unlimited' : `${insightData.used}/${insightData.limit} this month`}
                    </Badge>
                  </div>
                  {insightData.insight ? (
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{insightData.insight.insight}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed">No analysis yet. Generate your first AI spending insight — Claude will review your debt profile and transactions to surface personalized recommendations.</p>
                  )}
                </Widget>

                <Button
                  onClick={generateInsight}
                  disabled={generating || (!insightData.isPro && insightData.remaining === 0)}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {generating ? 'Analyzing…' : insightData.insight ? 'Refresh Analysis' : 'Generate Analysis'}
                </Button>

                {insightError && (
                  <p className="text-xs text-red text-center">{insightError}</p>
                )}
                {!insightError && !insightData.isPro && insightData.remaining === 0 && (
                  <p className="text-xs text-muted-foreground text-center">Monthly limit reached. Resets next month.</p>
                )}
              </div>
            )}
          </>
        )}
      </PageLayout>
    </div>
  );
}
