import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie,
  XAxis, YAxis, ReferenceLine, CartesianGrid, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ArrowRight, BarChart2, ShoppingCart,
  Target, Zap, Sparkles, Bell, Flame, Wallet,
  AlertTriangle, AlertCircle, Lock, Brain,
} from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { apiFetch, fmt, fmtD } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  user?: { name: string };
  totalDebt: number;
  totalAssets?: number;
  totalLiabilities?: number;
  netWorth?: number;
  monthlyInterest: number;
  surplus: number;
  accountCount: number;
  totalMinimums: number;
  debtFreeDate?: string;
  debtFreeMonths?: number;
  alerts?: { severity: string; title: string; description: string }[];
  priorityCard?: { name: string; balance_current: number; apr: number; minimum_payment: number; payment_due_date?: string };
  assetsByCategory?: { cash: number; investments: number };
  liabilitiesByCategory?: { creditCards: number; loans: number };
}

interface InsightData {
  insight?: { insight: string; generated_at: string };
  remaining?: number;
  isPro?: boolean;
  used?: number;
  limit?: number;
}

interface GoalRow {
  id: string;
  goal_type: string;
  account_name?: string;
  label?: string;
  onTrack?: boolean;
  requiredExtra?: number;
}

interface NetWorthPoint {
  month: string;
  net_worth: number;
  total_assets?: number;
  total_liabilities?: number;
}

interface SpendingCategory {
  category: string;
  total: number;
}

// ─── Chart configs ────────────────────────────────────────────────────────────

const debtChartConfig: ChartConfig = {
  balance: { label: 'Balance', color: 'var(--primary)' },
};
const netWorthChartConfig: ChartConfig = {
  net_worth:         { label: 'Net Worth',   color: 'var(--violet-light)' },
  total_assets:      { label: 'Assets',      color: 'var(--green)' },
  total_liabilities: { label: 'Liabilities', color: 'var(--muted-foreground)' },
};
const spendingChartConfig: ChartConfig = {
  total: { label: 'Spent', color: 'var(--primary)' },
};
const allocationChartConfig: ChartConfig = {
  'Cash & Savings': { label: 'Cash & Savings', color: 'var(--chart-2)' },
  'Investments':    { label: 'Investments',    color: 'var(--chart-4)' },
  'Credit Cards':   { label: 'Credit Cards',   color: 'var(--chart-3)' },
  'Loans':          { label: 'Loans',          color: 'var(--chart-5)' },
};

const SPENDING_COLORS = ['var(--primary)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(name: string) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name.split(' ')[0]}`;
}

function buildChartData(totalDebt: number, months: number) {
  if (!months || months <= 0 || months > 360 || !totalDebt) return [];
  const cap  = Math.min(months, 60);
  const step = Math.max(1, Math.floor(cap / 24));
  const data: { month: string; balance: number }[] = [];
  const now  = new Date();
  for (let i = 0; i <= cap; i += step) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + i);
    const label   = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const frac    = i / months;
    const balance = Math.max(0, Math.round(totalDebt * (1 - Math.pow(frac, 0.85))));
    data.push({ month: label, balance });
  }
  if (data[data.length - 1]?.balance > 0) {
    const end = new Date(now);
    end.setMonth(end.getMonth() + months);
    data.push({ month: end.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), balance: 0 });
  }
  return data;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [state, setState]                     = useState<'loading' | 'error' | 'content'>('loading');
  const [data, setData]                       = useState<DashboardData | null>(null);
  const [goals, setGoals]                     = useState<GoalRow[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthPoint[]>([]);
  const [spendingData, setSpendingData]       = useState<SpendingCategory[]>([]);
  const [error, setError]                     = useState('');
  const [aiState, setAiState]                 = useState<'loading' | 'empty' | 'content' | 'limit' | 'error'>('loading');
  const [insightPayload, setInsightPayload]   = useState<InsightData | null>(null);
  const [aiError, setAiError]                 = useState('');
  const [activeTab, setActiveTab]             = useState('wealth');

  const [sheet, setSheet] = useState<{
    open: boolean;
    type: 'spending' | 'networth' | 'goal' | null;
    payload?: SpendingCategory | NetWorthPoint | GoalRow;
  }>({ open: false, type: null });

  async function load() {
    setState('loading');
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        apiFetch('/api/dashboard'),
        apiFetch('/api/goals').catch(() => null),
        apiFetch('/api/net-worth-history').catch(() => null),
        apiFetch('/api/transactions/summary').catch(() => null),
      ]);
      if (!r1.ok) throw new Error(`Server returned ${r1.status}`);
      const d  = await r1.json();
      const g  = r2 ? await r2.json().catch(() => null) : null;
      const h  = r3 ? await r3.json().catch(() => null) : null;
      const sp = r4 ? await r4.json().catch(() => null) : null;
      setData(d);
      setGoals(g?.goals || []);
      setNetWorthHistory(h?.history || []);
      setSpendingData(Array.isArray(sp) ? sp : []);
      setState('content');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to server');
      setState('error');
    }
  }

  async function loadInsight() {
    try {
      const r = await apiFetch('/api/insights/latest');
      const d: InsightData = await r.json();
      setInsightPayload(d);
      setAiState(!d.insight ? (d.remaining === 0 && !d.isPro ? 'limit' : 'empty') : 'content');
    } catch { setAiState('empty'); }
  }

  async function generateInsight() {
    setAiState('loading');
    try {
      const r = await apiFetch('/api/insights/generate', { method: 'POST' });
      const d: InsightData = await r.json();
      if (r.status === 429) { setAiState('limit'); return; }
      if (!r.ok) throw new Error((d as { error?: string }).error || 'Generation failed');
      setInsightPayload(d);
      setAiState('content');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Could not generate insight');
      setAiState('error');
    }
  }

  useEffect(() => { load(); loadInsight(); }, []);

  const dateStr  = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const chartData = data ? buildChartData(data.totalDebt, data.debtFreeMonths || 0) : [];

  // ── Drill-down sheet ──────────────────────────────────────────────────────────

  function SheetBody() {
    if (!sheet.open || !sheet.type) return null;

    if (sheet.type === 'spending' && sheet.payload) {
      const cat = sheet.payload as SpendingCategory;
      return (
        <>
          <SheetHeader>
            <SheetTitle className="text-foreground">{cat.category}</SheetTitle>
            <p className="text-2xl font-extrabold tabular text-foreground">
              {fmtD(cat.total)}<span className="text-sm font-normal text-muted-foreground ml-2">last 30 days</span>
            </p>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              See the full list in{' '}
              <Link to="/spending" onClick={() => setSheet({ open: false, type: null })} className="text-violet-light no-underline font-semibold hover:opacity-80">
                Spending → Transactions
              </Link>
            </p>
            {spendingData.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">All Categories</p>
                <div className="space-y-2">
                  {spendingData.map((c, i) => {
                    const pct = Math.round((c.total / spendingData[0].total) * 100);
                    return (
                      <div key={i} className={cn('p-3 rounded-lg border transition-colors', c.category === cat.category ? 'border-[var(--primary)]/50 bg-violet-dim/20' : 'border-border bg-surface-2')}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-medium text-foreground">{c.category}</span>
                          <span className="tabular text-muted-foreground">{fmtD(c.total)}</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      );
    }

    if (sheet.type === 'networth') {
      const latest = netWorthHistory[netWorthHistory.length - 1];
      return (
        <>
          <SheetHeader>
            <SheetTitle className="text-foreground">Net Worth Breakdown</SheetTitle>
            <p className={cn('text-2xl font-extrabold tabular', latest.net_worth >= 0 ? 'text-green' : 'text-foreground')}>
              {latest.net_worth < 0 ? '−' : ''}{fmt(Math.abs(latest.net_worth))}
            </p>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {data && (
              <>
                <div className="p-4 rounded-xl bg-green-dim border border-green/20">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Assets</p>
                  <p className="text-xl font-extrabold tabular text-green">{fmt(data.totalAssets ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Checking, savings, investments, 401k</p>
                </div>
                <div className="p-4 rounded-xl bg-surface-2 border border-border">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Liabilities</p>
                  <p className="text-xl font-extrabold tabular text-foreground">{fmt(data.totalLiabilities ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Credit cards, mortgages, auto loans</p>
                </div>
              </>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">6-Month Trend</p>
              <ChartContainer config={netWorthChartConfig} className="h-[160px] w-full">
                <LineChart data={netWorthHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Net Worth']} />} />
                  <Line type="monotone" dataKey="net_worth" stroke="var(--violet-light)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--violet-light)', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ChartContainer>
            </div>
          </div>
        </>
      );
    }

    if (sheet.type === 'goal' && sheet.payload) {
      const g = sheet.payload as GoalRow;
      const label = g.label || (g.goal_type === 'debt_free_date' ? 'Debt-Free Date' : g.account_name ? `Pay off ${g.account_name}` : 'Goal');
      return (
        <>
          <SheetHeader>
            <SheetTitle className="text-foreground">{label}</SheetTitle>
            <Badge className={cn('w-fit text-xs', g.onTrack ? 'bg-green-dim text-green border-green/20' : 'bg-amber-dim text-amber border-amber/20')} variant="outline">
              {g.onTrack ? '✓ On track' : 'Off track'}
            </Badge>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {!g.onTrack && g.requiredExtra && (
              <div className="p-4 rounded-xl bg-amber-dim border border-amber/20">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">To get on track</p>
                <p className="text-xl font-extrabold tabular text-amber">+{fmt(g.requiredExtra)}/mo</p>
                <p className="text-xs text-muted-foreground mt-1">extra payment needed</p>
              </div>
            )}
            <Button variant="outline" size="sm" asChild className="w-full border-border text-muted-foreground hover:text-foreground">
              <Link to="/plan?tab=goals" onClick={() => setSheet({ open: false, type: null })}>
                Manage Goals <ArrowRight size={13} className="ml-1" />
              </Link>
            </Button>
          </div>
        </>
      );
    }
    return null;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground w-full items-center">

      {/* ── Top bar — greeting only, fixed height ── */}
      <div className="sticky top-0 z-10 w-full border-b border-border bg-background flex flex-col items-center">
        <div className="w-full max-w-[1600px] px-6 md:px-10 lg:px-12 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-bold text-foreground leading-tight">
                {data ? greeting(data.user?.name || 'there') : 'Dashboard'}
              </h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">{dateStr}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="flex-1 w-full flex flex-col items-center pb-16">
        <div className="w-full max-w-[1600px] px-6 md:px-10 lg:px-12">

          {/* Context row — onboarding stepper or command-center strip */}
          <div className="pt-6 pb-2">
            {state === 'content' && data && (() => {
              const steps = [
                { id: 'accounts', label: 'Link accounts', done: data.accountCount > 0,       href: '/accounts'       },
                { id: 'assets',   label: 'Add assets',    done: (data.totalAssets ?? 0) > 0, href: '/accounts'       },
                { id: 'strategy', label: 'Set strategy',  done: !!data.debtFreeDate,         href: '/plan'           },
                { id: 'goals',    label: 'Create a goal', done: goals.length > 0,            href: '/plan?tab=goals' },
              ];
              const doneCount = steps.filter(s => s.done).length;
              const allDone   = doneCount === steps.length;
              const nextStep  = steps.find(s => !s.done);

              if (!allDone) {
                return (
                  <div className="px-4 py-3 rounded-xl bg-surface-2 border border-border flex items-center gap-4 flex-wrap">
                    <div className="flex items-center flex-1 min-w-0 flex-wrap gap-y-2">
                      {steps.map((step, i) => (
                        <div key={step.id} className="flex items-center">
                          <Link to={step.href} className={cn(
                            'flex items-center gap-1.5 no-underline rounded-lg px-2 py-1 transition-colors',
                            step.done ? 'opacity-60' : 'hover:bg-background'
                          )}>
                            <div className={cn(
                              'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border shrink-0',
                              step.done
                                ? 'bg-green border-transparent text-white'
                                : 'bg-background border-border text-muted-foreground'
                            )}>
                              {step.done ? '✓' : i + 1}
                            </div>
                            <span className={cn(
                              'text-xs font-medium whitespace-nowrap',
                              step.done ? 'text-muted-foreground line-through' : 'text-foreground'
                            )}>
                              {step.label}
                            </span>
                          </Link>
                          {i < steps.length - 1 && <div className="w-4 h-px bg-border shrink-0 mx-1" />}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground font-medium">{doneCount}/{steps.length} complete</span>
                      {nextStep && (
                        <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                          <Link to={nextStep.href}>Continue →</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              }

              // ── Command-center strip (post-onboarding) ──────────────────────────
              const monthlySaved = data.priorityCard
                ? Math.round(data.priorityCard.balance_current * (data.priorityCard.apr / 100) / 12)
                : 0;
              const action = data.surplus > 0 && data.priorityCard
                ? {
                    message: `You have ${fmt(data.surplus)} surplus this month.`,
                    detail:  `Applying it to ${data.priorityCard.name} could save ~${fmtD(monthlySaved)} in monthly interest.`,
                    cta: 'View plan',
                    href: '/plan',
                  }
                : (data.alerts?.length ?? 0) > 0
                ? {
                    message: `${data.alerts!.length} alert${data.alerts!.length > 1 ? 's' : ''} need${data.alerts!.length === 1 ? 's' : ''} attention.`,
                    detail:  data.alerts![0].description,
                    cta: 'Review',
                    href: '/accounts',
                  }
                : null;

              if (!action) return null;

              return (
                <div className="px-4 py-2.5 rounded-xl bg-violet-dim border border-[var(--primary)]/20 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Zap size={14} className="text-violet-light shrink-0" />
                    <p className="text-sm min-w-0">
                      <span className="font-semibold text-foreground">{action.message}</span>
                      {' '}
                      <span className="text-muted-foreground">{action.detail}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-border text-muted-foreground hover:text-foreground" onClick={load}>
                      Refresh
                    </Button>
                    <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                      <Link to={action.href}>{action.cta} →</Link>
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>

        {/* Loading skeleton — mirrors 3-column layout */}
        {state === 'loading' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8 items-start w-full">
            {[1, 2, 3].map(col => (
              <div key={col} className="flex flex-col gap-6 w-full min-w-0">
                <div className="rounded-xl border border-border bg-card shadow-sm p-6 min-h-[140px]">
                  <div className="skeleton h-2.5 w-20 mb-4" />
                  <div className="skeleton h-10 w-40 mb-3" />
                  <div className="skeleton h-4 w-28" />
                </div>
                <div className="rounded-xl border border-border bg-card shadow-sm p-6">
                  <div className="skeleton h-2.5 w-24 mb-4" />
                  <div className="skeleton h-[140px] w-full" />
                </div>
                <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-3">
                  <div className="skeleton h-2.5 w-20" />
                  <div className="skeleton h-6 w-32" />
                  <div className="skeleton h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center">
              <AlertTriangle size={22} className="text-amber" />
            </div>
            <p className="text-base font-semibold text-foreground mt-1">Could not load dashboard</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={load} className="mt-1 bg-primary hover:bg-primary/90 text-white">Try again</Button>
          </div>
        )}

        {/* Content */}
        {state === 'content' && data && (
          <div className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-0">

            {/* Mobile / tablet tab bar — hidden on lg+ */}
            <TabsList className="lg:hidden flex w-full mb-8">
              <TabsTrigger value="wealth"   className="flex-1">Wealth</TabsTrigger>
              <TabsTrigger value="payoff"   className="flex-1">Payoff</TabsTrigger>
              <TabsTrigger value="cashflow" className="flex-1">Cash Flow</TabsTrigger>
            </TabsList>

            {/* ── 3-column terminal grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8 items-start w-full">

              {/* ━━━ Column 1 — Wealth ━━━ */}
              <div className={cn('flex flex-col gap-6 w-full min-w-0', activeTab !== 'wealth' && 'hidden lg:flex')}>

                {/* Net Worth trend — 3-line chart */}
                {netWorthHistory.length >= 2 && (() => {
                  const latest    = netWorthHistory[netWorthHistory.length - 1];
                  const delta     = latest.net_worth - netWorthHistory[0].net_worth;
                  const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown;
                  const hasBreakdown = netWorthHistory[0]?.total_assets !== undefined;
                  return (
                    <Card className="bg-card border-border shadow-sm rounded-xl overflow-hidden flex flex-col w-full flex-1 min-h-[300px] cursor-pointer group"
                      onClick={() => navigate('/accounts')}>
                      <CardHeader className="pb-0 pt-6 px-6">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <BarChart2 size={14} className="text-muted-foreground shrink-0" />Net Worth
                          </CardTitle>
                          <ArrowRight size={13} className="text-muted-foreground group-hover:text-violet-light transition-colors" />
                        </div>
                        <div className="flex items-end gap-3 mt-1">
                          <span className={cn('text-4xl xl:text-5xl font-black tracking-tight tabular-nums', latest.net_worth >= 0 ? 'text-green' : 'text-foreground')}>
                            {latest.net_worth < 0 ? '−' : ''}{fmt(Math.abs(latest.net_worth))}
                          </span>
                          <span className={cn('text-xs font-semibold flex items-center gap-0.5 mb-0.5', delta >= 0 ? 'text-green' : 'text-muted-foreground')}>
                            <DeltaIcon size={11} />
                            {delta >= 0 ? '+' : ''}{fmt(delta)}
                          </span>
                        </div>
                        <div className="flex gap-4 mt-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green shrink-0" />
                            <span className="text-[11px] text-muted-foreground">Assets <span className="font-semibold text-foreground">{fmt(latest.total_assets ?? data.totalAssets ?? 0)}</span></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
                            <span className="text-[11px] text-muted-foreground">Liabilities <span className="font-semibold text-foreground">{fmt(latest.total_liabilities ?? data.totalLiabilities ?? 0)}</span></span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="flex-1 min-h-[200px] min-w-0">
                          <ChartContainer config={netWorthChartConfig} className="h-[180px] w-full">
                            <LineChart data={netWorthHistory} margin={{ top: 16, right: 16, bottom: 4, left: 16 }}>
                              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(netWorthHistory.length / 5))} />
                              <YAxis hide domain={['auto', 'auto']} />
                              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                              <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => {
                                const labels: Record<string, string> = { net_worth: 'Net Worth', total_assets: 'Assets', total_liabilities: 'Liabilities' };
                                return [`$${Number(v).toLocaleString()}`, labels[name as string] ?? String(name)];
                              }} />} />
                              {hasBreakdown && <Line type="monotone" dataKey="total_assets" stroke="var(--green)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" activeDot={{ r: 3 }} />}
                              {hasBreakdown && <Line type="monotone" dataKey="total_liabilities" stroke="var(--muted-foreground)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" activeDot={{ r: 3 }} />}
                              <Line type="monotone" dataKey="net_worth" stroke="var(--violet-light)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: 'var(--violet-light)', strokeWidth: 0 }} />
                            </LineChart>
                          </ChartContainer>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Allocation donut — 4 categories */}
                {(() => {
                  const slices = [
                    { name: 'Cash & Savings', value: data.assetsByCategory?.cash        ?? 0, color: 'var(--chart-2)' },
                    { name: 'Investments',    value: data.assetsByCategory?.investments  ?? 0, color: 'var(--chart-4)' },
                    { name: 'Credit Cards',   value: data.liabilitiesByCategory?.creditCards ?? data.totalLiabilities ?? 0, color: 'var(--chart-3)' },
                    { name: 'Loans',          value: data.liabilitiesByCategory?.loans    ?? 0, color: 'var(--chart-5)' },
                  ].filter(s => s.value > 0);
                  const total = slices.reduce((s, c) => s + c.value, 0);
                  if (slices.length === 0) return null;
                  return (
                    <Card className="bg-card border-border shadow-sm rounded-xl overflow-hidden flex flex-col w-full flex-1 min-h-[300px] cursor-pointer group"
                      onClick={() => navigate('/accounts')}>
                      <CardHeader className="pb-0 pt-6 px-6">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <BarChart2 size={14} className="text-muted-foreground shrink-0" />Allocation
                          </CardTitle>
                          <ArrowRight size={13} className="text-muted-foreground group-hover:text-violet-light transition-colors" />
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                        <ChartContainer config={allocationChartConfig} className="h-[160px] w-full">
                          <PieChart>
                            <Pie data={slices} cx="50%" cy="50%" innerRadius="52%" outerRadius="78%" paddingAngle={3} dataKey="value" nameKey="name">
                              {slices.map(s => <Cell key={s.name} fill={s.color} />)}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => [`$${Number(v).toLocaleString()}`, n as string]} />} />
                          </PieChart>
                        </ChartContainer>
                        <div className="space-y-2 mt-4">
                          {slices.map(s => (
                            <div key={s.name} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                                <span className="text-xs text-muted-foreground">{s.name}</span>
                              </div>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xs font-semibold tabular text-foreground">{fmt(s.value)}</span>
                                <span className="text-[10px] text-muted-foreground">{Math.round((s.value / total) * 100)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

              </div>

              {/* ━━━ Column 2 — Payoff ━━━ */}
              <div className={cn('flex flex-col gap-6 w-full min-w-0', activeTab !== 'payoff' && 'hidden lg:flex')}>

                {/* Total Debt hero */}
                <Card className="bg-card border-border shadow-sm rounded-xl overflow-hidden flex flex-col w-full">
                  <CardContent className="p-6">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 mb-3">Total Debt</p>
                    <div className="text-4xl xl:text-5xl font-black tracking-tight tabular-nums text-foreground leading-none">
                      {fmt(data.totalDebt)}
                    </div>
                    {data.debtFreeDate && (
                      <p className="text-sm font-semibold text-violet-light mt-3">
                        Debt-free by <span className="text-base">{data.debtFreeDate}</span>
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-border">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 mb-1">Minimums</p>
                        <p className="text-sm font-bold tabular text-foreground">
                          {fmtD(data.totalMinimums)}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 mb-1">Accounts</p>
                        <p className="text-sm font-bold tabular text-foreground">{data.accountCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payoff Projection */}
                {chartData.length > 2 && (
                  <Card className="bg-card border-border shadow-sm rounded-xl overflow-hidden flex flex-col w-full flex-1 min-h-[300px]">
                    <CardHeader className="pb-0 pt-6 px-6">
                      <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <TrendingDown size={14} className="text-muted-foreground shrink-0" />Payoff Projection
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="flex-1 min-h-[200px] min-w-0">
                        <ChartContainer config={debtChartConfig} className="h-[180px] w-full">
                          <AreaChart data={chartData} margin={{ top: 16, right: 16, bottom: 4, left: 16 }}>
                            <defs>
                              <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(chartData.length / 5))} />
                            <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Balance']} />} />
                            <Area type="monotone" dataKey="balance" stroke="var(--primary)" strokeWidth={2} fill="url(#debtGrad)" dot={false} activeDot={{ r: 4, fill: 'var(--violet-light)', strokeWidth: 0 }} />
                          </AreaChart>
                        </ChartContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Priority Attack */}
                <Card className="bg-card border-[var(--primary)]/30 shadow-sm rounded-xl overflow-hidden flex flex-col w-full">
                  <CardHeader className="pb-0 pt-6 px-6">
                    <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Zap size={14} className="text-violet-light shrink-0" />Priority Attack
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {data.priorityCard ? (
                      <>
                        <div className="text-sm font-bold text-foreground mb-1">{data.priorityCard.name}</div>
                        <div className="text-3xl font-black tracking-tight tabular-nums text-foreground leading-none">
                          {fmtD(data.priorityCard.balance_current)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                            {data.priorityCard.apr}% APR
                          </Badge>
                          {data.priorityCard.payment_due_date && (
                            <span>Due {new Date(data.priorityCard.payment_due_date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          )}
                        </div>
                        <p className="text-xs text-violet-light mt-3 leading-relaxed">Extra dollars here save the most interest.</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No debt cards found.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Monthly Interest */}
                <Card className="bg-card border-border shadow-sm rounded-xl overflow-hidden flex flex-col w-full">
                  <CardHeader className="pb-0 pt-6 px-6">
                    <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Flame size={14} className="text-muted-foreground shrink-0" />Monthly Interest
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="text-4xl font-black tracking-tight tabular-nums text-foreground mt-1">{fmtD(data.monthlyInterest)}</div>
                    <p className="text-xs text-muted-foreground mt-1">cost of carrying debt</p>
                  </CardContent>
                </Card>

                {/* Alerts */}
                {data.alerts && data.alerts.length > 0 && (
                  <Card className="bg-card border-border shadow-sm rounded-xl overflow-hidden flex flex-col w-full">
                    <CardHeader className="pb-0 pt-6 px-6">
                      <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Bell size={14} className="text-muted-foreground shrink-0" />Alerts
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-3">
                      {data.alerts.map((a, i) => (
                        <div key={i} className="flex gap-3 p-3 rounded-lg bg-amber-dim border border-amber/20">
                          <span className="shrink-0 mt-0.5">
                            {a.severity === 'danger'
                              ? <AlertCircle size={15} className="text-red" />
                              : <AlertTriangle size={15} className="text-amber" />}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-amber">{a.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

              </div>

              {/* ━━━ Column 3 — Cash Flow ━━━ */}
              <div className={cn('flex flex-col gap-6 w-full min-w-0', activeTab !== 'cashflow' && 'hidden lg:flex')}>

                {/* Monthly Surplus */}
                <Card className="bg-card border-border shadow-sm rounded-xl overflow-hidden flex flex-col w-full">
                  <CardHeader className="pb-0 pt-6 px-6">
                    <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Wallet size={14} className="text-muted-foreground shrink-0" />Monthly Surplus
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className={cn('text-4xl xl:text-5xl font-black tracking-tight tabular-nums mt-1', data.surplus >= 0 ? 'text-green' : 'text-foreground')}>
                      {fmt(data.surplus)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">available for extra payments</p>
                  </CardContent>
                </Card>

                {/* Spending by Category */}
                {spendingData.length > 0 && (() => {
                  const top5 = spendingData.slice(0, 5);
                  return (
                    <Card className="bg-card border-border shadow-sm rounded-xl overflow-hidden flex flex-col w-full flex-1 min-h-[300px]">
                      <CardHeader className="pb-0 pt-6 px-6">
                        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <ShoppingCart size={14} className="text-muted-foreground shrink-0" />Spending by Category
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="flex-1 min-h-[200px] min-w-0">
                          <ChartContainer config={spendingChartConfig} className="h-[180px] w-full">
                            <BarChart
                              data={top5}
                              layout="vertical"
                              margin={{ top: 8, right: 16, bottom: 8, left: 4 }}
                              barSize={10}
                              onClick={(data: unknown) => {
                                const p = (data as { activePayload?: { payload: SpendingCategory }[] } | null)?.activePayload?.[0]?.payload;
                                if (p) setSheet({ open: true, type: 'spending', payload: p });
                              }}
                            >
                              <XAxis type="number" hide />
                              <YAxis type="category" dataKey="category"
                                tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={90}
                                tickFormatter={(v: string) => {
                                  const s = v.replace(/_/g, ' ').replace(/AND /gi, '& ');
                                  return s.length > 13 ? s.slice(0, 12) + '…' : s;
                                }}
                              />
                              <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Spent']} />} />
                              <Bar dataKey="total" radius={[0, 4, 4, 0]} cursor="pointer">
                                {top5.map((_, i) => <Cell key={i} fill={SPENDING_COLORS[i % SPENDING_COLORS.length]} />)}
                              </Bar>
                            </BarChart>
                          </ChartContainer>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Goals */}
                {goals.length > 0 && (
                  <Card className="bg-card border-border shadow-sm rounded-xl overflow-hidden flex flex-col w-full">
                    <CardHeader className="pb-0 pt-6 px-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Target size={14} className="text-muted-foreground shrink-0" />Goals
                        </CardTitle>
                        <Link to="/plan?tab=goals" className="text-xs text-violet-light font-semibold no-underline flex items-center gap-0.5 hover:opacity-80">
                          All <ArrowRight size={11} />
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-3">
                      {goals.slice(0, 3).map(g => {
                        const label = g.label || (g.goal_type === 'debt_free_date' ? 'Debt-Free Date' : g.account_name ? `Pay off ${g.account_name}` : 'Goal');
                        return (
                          <button
                            key={g.id}
                            onClick={() => setSheet({ open: true, type: 'goal', payload: g })}
                            className="w-full flex items-center justify-between gap-2 cursor-pointer text-left hover:opacity-80 transition-opacity"
                          >
                            <span className="text-sm font-medium text-foreground truncate flex-1">{label}</span>
                            <Badge className={cn('text-[10px] shrink-0', g.onTrack ? 'bg-green-dim text-green border-green/20' : 'bg-amber-dim text-amber border-amber/20')} variant="outline">
                              {g.onTrack ? 'On track' : g.requiredExtra ? `+${fmt(g.requiredExtra)}/mo` : 'Off track'}
                            </Badge>
                          </button>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* AI Insights */}
                <Card className="bg-card border-border shadow-sm rounded-xl overflow-hidden flex flex-col w-full">
                  <CardHeader className="pb-0 pt-6 px-6">
                    <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles size={14} className="text-muted-foreground shrink-0" />AI Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {aiState === 'loading' && (
                      <div className="flex flex-col items-center py-4 gap-2">
                        <div className="spinner" />
                        <p className="text-xs text-muted-foreground">Analyzing…</p>
                      </div>
                    )}
                    {aiState === 'empty' && (
                      <div className="flex flex-col items-center text-center py-3 gap-2">
                        <div className="w-10 h-10 rounded-full bg-violet-dim border border-[var(--primary)]/20 flex items-center justify-center">
                          <Brain size={18} className="text-violet-light" />
                        </div>
                        <p className="text-sm font-semibold">Get AI insights</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">3 actions to get debt-free faster.</p>
                        <Button size="sm" className="w-full mt-1 bg-primary hover:bg-primary/90" onClick={generateInsight}>Generate</Button>
                      </div>
                    )}
                    {aiState === 'content' && insightPayload?.insight && (
                      <>
                        <div className="space-y-2">
                          {insightPayload.insight.insight.split('\n').filter(l => l.trim()).slice(0, 3).map((line, i) => {
                            const m = line.trim().match(/^(\d+)\.\s*(.*)/s);
                            if (m) return (
                              <div key={i} className="flex gap-2">
                                <div className="shrink-0 w-5 h-5 rounded-full bg-violet-dim border border-[var(--primary)]/30 text-violet-light text-[10px] font-bold flex items-center justify-center mt-0.5">{m[1]}</div>
                                <p className="text-xs leading-relaxed text-foreground pt-0.5">{m[2]}</p>
                              </div>
                            );
                            return <p key={i} className="text-xs text-muted-foreground leading-relaxed">{line}</p>;
                          })}
                        </div>
                        <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
                          <span className="text-[11px] text-muted-foreground">
                            {insightPayload.isPro ? 'Unlimited' : `${insightPayload.used}/${insightPayload.limit}`}
                          </span>
                          {(insightPayload.isPro || (insightPayload.remaining ?? 0) > 0) && (
                            <Button variant="outline" size="sm" onClick={generateInsight} className="text-xs h-7 border-border text-muted-foreground hover:text-foreground">Refresh</Button>
                          )}
                        </div>
                      </>
                    )}
                    {aiState === 'limit' && (
                      <div className="flex flex-col items-center text-center py-3 gap-2">
                        <div className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center">
                          <Lock size={16} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold">Limit reached</p>
                        <p className="text-xs text-muted-foreground">10 free uses/month. Resets on the 1st.</p>
                      </div>
                    )}
                    {aiState === 'error' && (
                      <p className="text-xs text-red text-center py-3">{aiError}</p>
                    )}
                  </CardContent>
                </Card>

              </div>

            </div>
          </Tabs>
          </div>
        )}

        </div>
      </div>

      {/* ── Drill-down Sheet ── */}
      <Sheet open={sheet.open} onOpenChange={(open) => setSheet(s => ({ ...s, open }))}>
        <SheetContent className="bg-card border-l border-border text-foreground overflow-y-auto">
          <SheetBody />
        </SheetContent>
      </Sheet>

    </div>
  );
}
