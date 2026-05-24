import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, ReferenceLine, CartesianGrid, Cell,
} from 'recharts';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Plus, Pencil, Check, TrendingUp, TrendingDown, ArrowRight, BarChart2, ShoppingCart, Target, Zap, Sparkles, Bell, Flame, Wallet } from 'lucide-react';

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

// ─── Widget catalog ───────────────────────────────────────────────────────────

const DEFAULT_WIDGETS = [
  'debt_projection', 'spending_by_category',
  'net_worth_trend', 'priority_attack',
  'goals_progress', 'ai_insights',
  'alerts',
];

const WIDGET_CATALOG = [
  { id: 'debt_projection',      label: 'Payoff Projection'    },
  { id: 'net_worth_trend',      label: 'Net Worth Trend'      },
  { id: 'spending_by_category', label: 'Spending by Category' },
  { id: 'goals_progress',       label: 'Goals'                },
  { id: 'interest_cost',        label: 'Monthly Interest'     },
  { id: 'savings_rate',         label: 'Monthly Surplus'      },
  { id: 'priority_attack',      label: 'Priority Attack'      },
  { id: 'ai_insights',          label: 'AI Insights'          },
  { id: 'alerts',               label: 'Alerts'               },
];

// ─── Chart configs ────────────────────────────────────────────────────────────

const debtChartConfig: ChartConfig = {
  balance: { label: 'Balance', color: 'var(--primary)' },
};
const netWorthChartConfig: ChartConfig = {
  net_worth: { label: 'Net Worth', color: 'var(--violet-light)' },
};
const spendingChartConfig: ChartConfig = {
  total: { label: 'Spent', color: 'var(--primary)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(name: string) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name.split(' ')[0]}`;
}

function buildChartData(totalDebt: number, months: number) {
  if (!months || months <= 0 || months > 360 || !totalDebt) return [];
  const cap = Math.min(months, 60);
  const step = Math.max(1, Math.floor(cap / 24));
  const data: { month: string; balance: number }[] = [];
  const now = new Date();
  for (let i = 0; i <= cap; i += step) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + i);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const frac = i / months;
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

// ─── Sortable widget shell ────────────────────────────────────────────────────

function SortableWidgetShell({ id, editMode, onRemove, children }: {
  id: string;
  editMode: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        position: 'relative',
        zIndex: isDragging ? 50 : undefined,
      }}
    >
      {editMode && (
        <>
          <button
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            className="absolute top-2 left-2 z-20 w-7 h-7 flex items-center justify-center rounded-md bg-surface-2 border border-border text-muted-foreground cursor-grab hover:text-foreground touch-none"
            title="Drag to reorder"
          >
            <GripVertical size={14} />
          </button>
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-red-dim border border-red/25 text-red hover:bg-red/20 cursor-pointer"
          >
            <X size={13} />
          </button>
        </>
      )}
      {children}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [state, setState]                   = useState<'loading' | 'error' | 'content'>('loading');
  const [data, setData]                     = useState<DashboardData | null>(null);
  const [goals, setGoals]                   = useState<GoalRow[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthPoint[]>([]);
  const [spendingData, setSpendingData]     = useState<SpendingCategory[]>([]);
  const [activeWidgets, setActiveWidgets]   = useState<string[]>(DEFAULT_WIDGETS);
  const [editMode, setEditMode]             = useState(false);
  const [dragActiveId, setDragActiveId]     = useState<string | null>(null);
  const [error, setError]                   = useState('');
  const [aiState, setAiState]               = useState<'loading' | 'empty' | 'content' | 'limit' | 'error'>('loading');
  const [insight, setInsight]               = useState<InsightData | null>(null);
  const [aiError, setAiError]               = useState('');

  // Drill-down sheet state
  const [sheet, setSheet] = useState<{
    open: boolean;
    type: 'spending' | 'networth' | 'goal' | null;
    payload?: SpendingCategory | NetWorthPoint | GoalRow;
  }>({ open: false, type: null });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  async function load() {
    setState('loading');
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        apiFetch('/api/dashboard'),
        apiFetch('/api/goals').catch(() => null),
        apiFetch('/api/net-worth-history').catch(() => null),
        apiFetch('/api/transactions/summary').catch(() => null),
        apiFetch('/api/dashboard-config').catch(() => null),
      ]);
      if (!r1.ok) throw new Error(`Server returned ${r1.status}`);
      const d  = await r1.json();
      const g  = r2 ? await r2.json().catch(() => null) : null;
      const h  = r3 ? await r3.json().catch(() => null) : null;
      const sp = r4 ? await r4.json().catch(() => null) : null;
      const cf = r5 ? await r5.json().catch(() => null) : null;
      setData(d);
      setGoals(g?.goals || []);
      setNetWorthHistory(h?.history || []);
      setSpendingData(Array.isArray(sp) ? sp : []);
      setActiveWidgets(cf?.widgets || DEFAULT_WIDGETS);
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
      setInsight(d);
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
      setInsight(d);
      setAiState('content');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Could not generate insight');
      setAiState('error');
    }
  }

  function persistConfig(widgets: string[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      apiFetch('/api/dashboard-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets }),
      }).catch(() => {});
    }, 600);
  }

  function handleDragStart(e: DragStartEvent) { setDragActiveId(e.active.id as string); }
  function handleDragEnd(e: DragEndEvent) {
    setDragActiveId(null);
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setActiveWidgets(prev => {
        const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string));
        persistConfig(next);
        return next;
      });
    }
  }
  function removeWidget(id: string) {
    setActiveWidgets(prev => { const next = prev.filter(w => w !== id); persistConfig(next); return next; });
  }
  function addWidget(id: string) {
    setActiveWidgets(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id]; persistConfig(next); return next;
    });
  }

  useEffect(() => { load(); loadInsight(); }, []);

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const chartData = data ? buildChartData(data.totalDebt, data.debtFreeMonths || 0) : [];
  const hiddenWidgets = WIDGET_CATALOG.filter(w => !activeWidgets.includes(w.id));

  // ── Widget renderer ──────────────────────────────────────────────────────────

  function renderWidgetContent(id: string) {
    if (!data) return null;

    switch (id) {
      case 'interest_cost':
        return (
          <Card className="h-full bg-card border-border">
            <CardHeader className="pb-2 pt-6 px-6">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2"><Flame size={14} className="text-muted-foreground shrink-0" />Monthly Interest</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="text-3xl font-extrabold tabular text-red mt-1">{fmtD(data.monthlyInterest)}</div>
              <p className="text-xs text-muted-foreground mt-1">cost of carrying debt</p>
            </CardContent>
          </Card>
        );

      case 'savings_rate':
        return (
          <Card className="h-full bg-card border-border">
            <CardHeader className="pb-2 pt-6 px-6">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2"><Wallet size={14} className="text-muted-foreground shrink-0" />Monthly Surplus</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className={cn('text-3xl font-extrabold tabular mt-1', data.surplus >= 0 ? 'text-green' : 'text-red')}>
                {fmt(data.surplus)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">available for extra payments</p>
            </CardContent>
          </Card>
        );

      case 'debt_projection':
        if (chartData.length <= 2) return null;
        return (
          <Card className="h-full bg-card border-border">
            <CardHeader className="pb-2 pt-6 px-6">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2"><TrendingDown size={14} className="text-muted-foreground shrink-0" />Payoff Projection</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-4">
              <ChartContainer config={debtChartConfig} className="h-[150px] w-full">
                <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
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
            </CardContent>
          </Card>
        );

      case 'priority_attack':
        return (
          <Card className="h-full border-[var(--primary)]/30 bg-violet-dim/5">
            <CardHeader className="pb-2 pt-6 px-6">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap size={14} className="text-violet-light shrink-0" />Priority Attack
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {data.priorityCard ? (
                <>
                  <div className="text-sm font-bold text-foreground mb-1">{data.priorityCard.name}</div>
                  <div className="text-2xl font-extrabold tabular text-red leading-none">{fmtD(data.priorityCard.balance_current)}</div>
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{data.priorityCard.apr}% APR</Badge>
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
        );

      case 'alerts':
        if (!data.alerts || data.alerts.length === 0) return null;
        return (
          <Card className="h-full bg-card border-border">
            <CardHeader className="pb-2 pt-6 px-6">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2"><Bell size={14} className="text-muted-foreground shrink-0" />Alerts</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-3">
              {data.alerts.map((a, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-amber-dim border border-amber/20">
                  <span className="text-base shrink-0 mt-0.5">{a.severity === 'danger' ? '🔴' : '⚠️'}</span>
                  <div>
                    <div className="text-sm font-semibold text-amber">{a.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );

      case 'net_worth_trend': {
        if (netWorthHistory.length < 2) return null;
        const latest = netWorthHistory[netWorthHistory.length - 1];
        const delta  = latest.net_worth - netWorthHistory[0].net_worth;
        const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown;
        return (
          <Card className="h-full bg-card border-border cursor-pointer group" onClick={() => setSheet({ open: true, type: 'networth', payload: latest })}>
            <CardHeader className="pb-2 pt-6 px-6">
              <div className="flex justify-between items-start">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2"><BarChart2 size={14} className="text-muted-foreground shrink-0" />Net Worth</CardTitle>
                <ArrowRight size={13} className="text-muted-foreground group-hover:text-violet-light transition-colors" />
              </div>
              <div className="flex items-end gap-3 mt-1">
                <span className={cn('text-xl font-extrabold tabular', latest.net_worth >= 0 ? 'text-green' : 'text-red')}>
                  {latest.net_worth < 0 ? '−' : ''}{fmt(Math.abs(latest.net_worth))}
                </span>
                <span className={cn('text-xs font-semibold flex items-center gap-0.5 mb-0.5', delta >= 0 ? 'text-green' : 'text-red')}>
                  <DeltaIcon size={11} />
                  {delta >= 0 ? '+' : ''}{fmt(delta)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-4">
              <ChartContainer config={netWorthChartConfig} className="h-[120px] w-full">
                <LineChart data={netWorthHistory} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(netWorthHistory.length / 5))} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <ReferenceLine y={0} stroke="oklch(1 0 0 / 10%)" strokeDasharray="3 3" />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Net Worth']} />} />
                  <Line type="monotone" dataKey="net_worth" stroke="var(--violet-light)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--violet-light)', strokeWidth: 0 }} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        );
      }

      case 'spending_by_category': {
        if (!spendingData.length) return null;
        const top5 = spendingData.slice(0, 5);
        const COLORS = ['var(--primary)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
        return (
          <Card className="h-full bg-card border-border">
            <CardHeader className="pb-2 pt-6 px-6">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2"><ShoppingCart size={14} className="text-muted-foreground shrink-0" />Spending by Category</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-4">
              <ChartContainer config={spendingChartConfig} className="h-[160px] w-full">
                <BarChart
                  data={top5}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 4 }}
                  barSize={10}
                  onClick={(d: any) => { if (d?.activePayload?.[0]) setSheet({ open: true, type: 'spending', payload: d.activePayload[0].payload as SpendingCategory }); }}
                >
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="category"
                    tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={76}
                    tickFormatter={(v: string) => v.replace(/_/g, ' ').replace(/AND /g, '& ').slice(0, 14)}
                  />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Spent']} />} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} cursor="pointer">
                    {top5.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        );
      }

      case 'goals_progress':
        if (!goals.length) return null;
        return (
          <Card className="h-full bg-card border-border">
            <CardHeader className="pb-2 pt-6 px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2"><Target size={14} className="text-muted-foreground shrink-0" />Goals</CardTitle>
                <Link to="/plan?tab=goals" className="text-xs text-violet-light font-semibold no-underline flex items-center gap-0.5 hover:opacity-80">
                  All <ArrowRight size={11} />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-3">
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
        );

      case 'ai_insights':
        return (
          <Card className="h-full bg-card border-border">
            <CardHeader className="pb-2 pt-6 px-6">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2"><Sparkles size={14} className="text-muted-foreground shrink-0" />AI Insights</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {aiState === 'loading' && (
                <div className="flex flex-col items-center py-4 gap-2">
                  <div className="spinner" />
                  <p className="text-xs text-muted-foreground">Analyzing…</p>
                </div>
              )}
              {aiState === 'empty' && (
                <div className="flex flex-col items-center text-center py-3 gap-2">
                  <span className="text-3xl">🧠</span>
                  <p className="text-sm font-semibold">Get AI insights</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">3 actions to get debt-free faster.</p>
                  <Button size="sm" className="w-full mt-1 bg-primary hover:bg-primary/90" onClick={generateInsight}>Generate</Button>
                </div>
              )}
              {aiState === 'content' && insight?.insight && (
                <>
                  <div className="space-y-2 flex-1">
                    {insight.insight.insight.split('\n').filter(l => l.trim()).slice(0, 3).map((line, i) => {
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
                    <span className="text-[11px] text-muted-foreground">{insight.isPro ? 'Unlimited' : `${insight.used}/${insight.limit}`}</span>
                    {(insight.isPro || (insight.remaining ?? 0) > 0) && (
                      <Button variant="outline" size="sm" onClick={generateInsight} className="text-xs h-7 border-border text-muted-foreground hover:text-foreground">Refresh</Button>
                    )}
                  </div>
                </>
              )}
              {aiState === 'limit' && (
                <div className="flex flex-col items-center text-center py-3 gap-2">
                  <span className="text-2xl">🔒</span>
                  <p className="text-sm font-semibold">Limit reached</p>
                  <p className="text-xs text-muted-foreground">10 free uses/month. Resets on the 1st.</p>
                </div>
              )}
              {aiState === 'error' && (
                <p className="text-xs text-red text-center py-3">{aiError}</p>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  }

  // ── Drill-down sheet content ──────────────────────────────────────────────────

  function SheetBody() {
    if (!sheet.open || !sheet.type) return null;

    if (sheet.type === 'spending' && sheet.payload) {
      const cat = sheet.payload as SpendingCategory;
      return (
        <>
          <SheetHeader>
            <SheetTitle className="text-foreground">{cat.category}</SheetTitle>
            <p className="text-2xl font-extrabold tabular text-foreground">{fmtD(cat.total)}<span className="text-sm font-normal text-muted-foreground ml-2">last 30 days</span></p>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              See the full transaction list in <Link to="/spending" onClick={() => setSheet({ open: false, type: null })} className="text-violet-light no-underline font-semibold hover:opacity-80">Spending → Transactions</Link>
            </p>
            {spendingData.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">All Categories</p>
                <div className="space-y-2">
                  {spendingData.map((c, i) => {
                    const pct = Math.round((c.total / spendingData[0].total) * 100);
                    return (
                      <div key={i} className={cn('p-3 rounded-lg border cursor-pointer transition-colors', c.category === cat.category ? 'border-[var(--primary)]/50 bg-violet-dim/20' : 'border-border bg-surface-2 hover:border-border/60')}>
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
            <p className={cn('text-2xl font-extrabold tabular', latest.net_worth >= 0 ? 'text-green' : 'text-red')}>
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
                <div className="p-4 rounded-xl bg-red-dim border border-red/20">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Liabilities</p>
                  <p className="text-xl font-extrabold tabular text-red">{fmt(data.totalLiabilities ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Credit cards, mortgages, auto loans</p>
                </div>
              </>
            )}
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">6-Month Trend</p>
              <ChartContainer config={netWorthChartConfig} className="h-[160px] w-full">
                <LineChart data={netWorthHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <ReferenceLine y={0} stroke="oklch(1 0 0 / 15%)" strokeDasharray="3 3" />
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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh">
      {/* Top bar */}
      <div className="sticky top-0 z-10 px-6 lg:px-10 py-5 top-bar border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {data ? greeting(data.user?.name || 'there') : 'Welcome back'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
          </div>
          {state === 'content' && (
            <Button
              size="sm"
              variant={editMode ? 'default' : 'outline'}
              className={cn('mt-0.5', editMode ? 'bg-primary hover:bg-primary/90 text-white' : 'border-border text-muted-foreground hover:text-foreground')}
              onClick={() => setEditMode(e => !e)}
            >
              {editMode ? <><Check size={13} className="mr-1" />Done</> : <><Pencil size={13} className="mr-1" />Edit</>}
            </Button>
          )}
        </div>
      </div>

      <div className="px-6 lg:px-10 pb-[calc(var(--nav-h)+32px)] md:pb-12 pt-8">
        {/* Loading */}
        {state === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="spinner" />
            <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-4xl">⚠️</span>
            <p className="text-base font-semibold">Could not load dashboard</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={load} className="bg-primary hover:bg-primary/90">Try Again</Button>
          </div>
        )}

        {state === 'content' && data && (
          <>
            {/* ── Hero card ── */}
            <Card className="mb-8 card-hero bg-gradient-to-br from-card via-card to-[var(--primary)]/5 border-[var(--primary)]/20 overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Debt</p>
                    <div className="text-[64px] font-extrabold tabular text-red leading-none tracking-tight">{fmt(data.totalDebt)}</div>
                    {data.debtFreeDate && (
                      <div className="mt-4">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Debt-Free Date</p>
                        <p className="text-xl font-extrabold text-violet-light">{data.debtFreeDate}</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Monthly Interest</p>
                    <div className="text-2xl font-extrabold tabular text-red leading-none">{fmtD(data.monthlyInterest)}</div>
                    <p className="text-xs text-muted-foreground mt-1.5">cost of debt</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8 mt-8 pt-6 border-t border-border">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Minimums</p>
                    <p className="text-base font-bold tabular text-foreground">{fmtD(data.totalMinimums)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Surplus</p>
                    <p className={cn('text-base font-bold tabular', data.surplus >= 0 ? 'text-green' : 'text-red')}>
                      {data.surplus >= 0 ? '+' : ''}{fmt(data.surplus)}
                    </p>
                  </div>
                  {data.netWorth != null ? (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Net Worth</p>
                      <p className={cn('text-base font-bold tabular', data.netWorth >= 0 ? 'text-green' : 'text-red')}>
                        {data.netWorth < 0 ? '−' : ''}{fmt(Math.abs(data.netWorth))}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Cards</p>
                      <p className="text-base font-bold tabular text-foreground">{data.accountCount}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Drag-and-drop widget grid ── */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={activeWidgets} strategy={rectSortingStrategy}>
                <div className="widget-grid">
                  {activeWidgets.map(id => {
                    const content = renderWidgetContent(id);
                    if (!content && !editMode) return null;
                    return (
                      <SortableWidgetShell key={id} id={id} editMode={editMode} onRemove={() => removeWidget(id)}>
                        {content ?? (
                          <Card className="h-full min-h-[160px] flex items-center justify-center bg-card border-border border-dashed">
                            <div className="text-center">
                              <p className="text-sm font-medium text-muted-foreground">{WIDGET_CATALOG.find(w => w.id === id)?.label}</p>
                              <p className="text-xs text-muted-foreground/60 mt-1">No data yet</p>
                            </div>
                          </Card>
                        )}
                      </SortableWidgetShell>
                    );
                  })}
                </div>
              </SortableContext>

              <DragOverlay>
                {dragActiveId ? (
                  <div className="opacity-90 scale-[1.02] drop-shadow-[0_8px_24px_rgba(124,58,237,0.4)]">
                    {renderWidgetContent(dragActiveId) ?? (
                      <Card className="bg-card border-border">
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground">{WIDGET_CATALOG.find(w => w.id === dragActiveId)?.label}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {/* ── Add widgets panel (edit mode only) ── */}
            {editMode && hiddenWidgets.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Add Widgets</p>
                <div className="flex flex-wrap gap-2">
                  {hiddenWidgets.map(w => (
                    <Button key={w.id} variant="outline" size="sm" onClick={() => addWidget(w.id)} className="border-border text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/50 text-xs">
                      <Plus size={12} className="mr-1" />{w.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
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
