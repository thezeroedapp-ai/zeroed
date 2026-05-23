import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer } from 'recharts';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { apiFetch, fmt, fmtD } from '../lib/api';

// ─── Interfaces ──────────────────────────────────────────────────────────────

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
}

interface SpendingCategory {
  category: string;
  total: number;
}

// ─── Widget catalog ───────────────────────────────────────────────────────────

const DEFAULT_WIDGETS = [
  'debt_projection', 'net_worth_trend', 'spending_by_category',
  'goals_progress', 'interest_cost', 'savings_rate',
  'priority_attack', 'ai_insights', 'alerts',
];

const WIDGET_CATALOG = [
  { id: 'debt_projection',      label: 'Payoff Projection'    },
  { id: 'net_worth_trend',      label: 'Net Worth Trend'      },
  { id: 'spending_by_category', label: 'Spending by Category' },
  { id: 'goals_progress',       label: 'Goals'                },
  { id: 'interest_cost',        label: 'Monthly Interest'     },
  { id: 'savings_rate',         label: 'Monthly Surplus'      },
  { id: 'priority_attack',      label: 'Priority Attack'      },
  { id: 'ai_insights',          label: 'AI Analysis'          },
  { id: 'alerts',               label: 'Alerts'               },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(name: string) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name}`;
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
        opacity: isDragging ? 0.35 : 1,
        position: 'relative',
        zIndex: isDragging ? 50 : undefined,
      }}
    >
      {editMode && (
        <>
          <div
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            style={{
              position: 'absolute', top: 10, left: 10, zIndex: 20,
              cursor: 'grab', color: 'var(--text-2)',
              background: 'var(--bg-elevated)', borderRadius: 6,
              width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, lineHeight: 1, border: '1px solid var(--border)',
              touchAction: 'none',
            }}
            title="Drag to reorder"
          >⠿</div>
          <button
            onClick={onRemove}
            style={{
              position: 'absolute', top: 10, right: 10, zIndex: 20,
              background: 'var(--red-dim)', border: '1px solid rgba(244,63,94,0.25)',
              borderRadius: '50%', width: 26, height: 26, cursor: 'pointer',
              color: 'var(--red)', fontSize: 16, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              fontFamily: 'inherit',
            }}
          >×</button>
        </>
      )}
      {children}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [state, setState] = useState<'loading' | 'error' | 'content'>('loading');
  const [data, setData] = useState<DashboardData | null>(null);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthPoint[]>([]);
  const [spendingData, setSpendingData] = useState<SpendingCategory[]>([]);
  const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_WIDGETS);
  const [editMode, setEditMode] = useState(false);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [aiState, setAiState] = useState<'loading' | 'empty' | 'content' | 'limit' | 'error'>('loading');
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [aiError, setAiError] = useState('');

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

  function handleDragStart(event: DragStartEvent) {
    setDragActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setActiveWidgets(prev => {
        const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string));
        persistConfig(next);
        return next;
      });
    }
  }

  function removeWidget(id: string) {
    setActiveWidgets(prev => {
      const next = prev.filter(w => w !== id);
      persistConfig(next);
      return next;
    });
  }

  function addWidget(id: string) {
    setActiveWidgets(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      persistConfig(next);
      return next;
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
          <div className="card" style={{ height: '100%' }}>
            <div className="card-label">Monthly Interest</div>
            <div className="stat-value red" style={{ marginTop: 8 }}>{fmtD(data.monthlyInterest)}</div>
            <div className="stat-sub">cost of carrying debt</div>
          </div>
        );

      case 'savings_rate':
        return (
          <div className="card" style={{ height: '100%' }}>
            <div className="card-label">Monthly Surplus</div>
            <div className={`stat-value ${data.surplus >= 0 ? 'green' : 'red'}`} style={{ marginTop: 8 }}>{fmt(data.surplus)}</div>
            <div className="stat-sub">for extra payments</div>
          </div>
        );

      case 'debt_projection':
        if (chartData.length <= 2) return null;
        return (
          <div className="card" style={{ height: '100%' }}>
            <div className="card-label" style={{ marginBottom: 12 }}>Payoff Projection</div>
            <ResponsiveContainer width="100%" height={112}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#7c3aed" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(chartData.length / 5))} />
                <Tooltip
                  contentStyle={{ background: '#0d1424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, color: '#e2e8f0' }}
                  formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Balance']}
                  labelStyle={{ color: '#64748b', marginBottom: 4, fontSize: 11 }}
                  cursor={{ stroke: 'rgba(167,139,250,0.2)', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="balance" stroke="#7c3aed" strokeWidth={2} fill="url(#debtGrad)" dot={false} activeDot={{ r: 4, fill: '#a78bfa', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      case 'priority_attack':
        return (
          <div className="card focus-card" style={{ height: '100%' }}>
            <div className="focus-label">⚡ Priority Attack</div>
            {data.priorityCard ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>{data.priorityCard.name}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--red)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{fmtD(data.priorityCard.balance_current)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
                  {data.priorityCard.apr}% APR
                  {data.priorityCard.payment_due_date && (
                    <> · Due {new Date(data.priorityCard.payment_due_date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--accent-2)', marginTop: 8, lineHeight: 1.5 }}>Highest APR — extra dollars here save the most.</div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>No debt cards found.</div>
            )}
          </div>
        );

      case 'alerts':
        if (!data.alerts || data.alerts.length === 0) return null;
        return (
          <div style={{ height: '100%' }}>
            {data.alerts.map((a, i) => (
              <div key={i} className="warning">
                <div className="warn-icon">{a.severity === 'danger' ? '🔴' : '⚠️'}</div>
                <div>
                  <div className="warn-title">{a.title}</div>
                  <div className="warn-desc">{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'net_worth_trend': {
        if (netWorthHistory.length < 2) return null;
        const latest = netWorthHistory[netWorthHistory.length - 1];
        const delta  = latest.net_worth - netWorthHistory[0].net_worth;
        return (
          <div className="card" style={{ height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div className="card-label">Net Worth</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: latest.net_worth >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
                  {latest.net_worth < 0 ? '-' : ''}{fmt(Math.abs(latest.net_worth))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--text-2)' }}>{netWorthHistory.length}mo change</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: delta >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                  {delta >= 0 ? '+' : ''}{fmt(delta)}
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={96}>
              <LineChart data={netWorthHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(netWorthHistory.length / 5))} />
                <YAxis hide domain={['auto', 'auto']} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{ background: '#0d1424', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, color: '#e2e8f0' }}
                  formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Net Worth']}
                  labelStyle={{ color: '#64748b', marginBottom: 4, fontSize: 11 }}
                  cursor={{ stroke: 'rgba(167,139,250,0.2)', strokeWidth: 1 }}
                />
                <Line type="monotone" dataKey="net_worth" stroke="#a78bfa" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#a78bfa', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'spending_by_category': {
        if (!spendingData.length) return null;
        const top5 = spendingData.slice(0, 5);
        const maxTotal = top5[0].total;
        return (
          <div className="card" style={{ height: '100%' }}>
            <div className="card-label" style={{ marginBottom: 10 }}>Spending by Category</div>
            {top5.map(c => (
              <div key={c.category} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{c.category}</span>
                  <span style={{ color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtD(c.total)}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill blue" style={{ width: `${(c.total / maxTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        );
      }

      case 'goals_progress':
        if (!goals.length) return null;
        return (
          <div className="card" style={{ height: '100%' }}>
            <div className="card-label">Goals</div>
            {goals.slice(0, 3).map(g => {
              const label = g.label || (g.goal_type === 'debt_free_date' ? 'Debt-Free Date' : g.account_name ? `Pay off ${g.account_name}` : 'Goal');
              return (
                <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{label}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: g.onTrack ? 'var(--green-dim)' : 'var(--amber-dim)', color: g.onTrack ? 'var(--green)' : 'var(--amber)', flexShrink: 0 }}>
                    {g.onTrack ? 'On track' : g.requiredExtra ? `+${fmt(g.requiredExtra)}/mo` : 'Off track'}
                  </span>
                </div>
              );
            })}
            <Link to="/plan?tab=goals" style={{ display: 'block', textAlign: 'center', marginTop: 10, fontSize: 13, color: 'var(--accent-2)', textDecoration: 'none', fontWeight: 600 }}>
              View All →
            </Link>
          </div>
        );

      case 'ai_insights':
        return (
          <div className="card" style={{ height: '100%' }}>
            <div className="card-label">AI Analysis</div>
            {aiState === 'loading' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Analyzing…</div>
              </div>
            )}
            {aiState === 'empty' && (
              <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🧠</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Get AI insights</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.6 }}>3 actions to get debt-free faster.</div>
                <button className="btn btn-primary btn-block" onClick={generateInsight}>Generate</button>
              </div>
            )}
            {aiState === 'content' && insight?.insight && (
              <>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {insight.insight.insight.split('\n').filter(l => l.trim()).slice(0, 3).map((line, i) => {
                    const m = line.trim().match(/^(\d+)\.\s*(.*)/s);
                    if (m) return (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent-2)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m[1]}</div>
                        <div style={{ fontSize: 12, lineHeight: 1.5, paddingTop: 2, color: 'var(--text)' }}>{m[2]}</div>
                      </div>
                    );
                    return <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 6 }}>{line}</div>;
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{insight.isPro ? 'Unlimited' : `${insight.used}/${insight.limit}`}</div>
                  {(insight.isPro || (insight.remaining ?? 0) > 0) && (
                    <button className="btn btn-ghost btn-sm" onClick={generateInsight}>Refresh</button>
                  )}
                </div>
              </>
            )}
            {aiState === 'limit' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>🔒</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Limit reached</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>10 free uses/month. Resets on the 1st.</div>
              </div>
            )}
            {aiState === 'error' && (
              <div style={{ fontSize: 13, color: 'var(--red)', textAlign: 'center', padding: '12px 0' }}>{aiError}</div>
            )}
          </div>
        );

      default:
        return null;
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="top-bar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{data ? greeting(data.user?.name || 'there') : 'Welcome back'}</h1>
            <div className="sub">{dateStr}</div>
          </div>
          {state === 'content' && (
            <button
              className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-ghost'}`}
              style={{ marginTop: 2 }}
              onClick={() => setEditMode(e => !e)}
            >
              {editMode ? 'Done' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      <div className="content">
        {state === 'loading' && (
          <div className="loading-state"><div className="spinner" /><p>Loading your dashboard…</p></div>
        )}
        {state === 'error' && (
          <div className="error-state">
            <div className="error-icon">⚠</div>
            <p>Could not load dashboard</p>
            <small>{error}</small>
            <button className="btn btn-primary" onClick={load}>Try Again</button>
          </div>
        )}

        {state === 'content' && data && (
          <>
            {/* Hero — always shown, not draggable */}
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="card-label">Total Debt</div>
              <div className="hero-value" style={{ color: 'var(--red)' }}>{fmt(data.totalDebt)}</div>
              <div className="progress-wrap">
                <div className="progress-bar">
                  <div className="progress-fill red" style={{ width: '100%' }} />
                </div>
              </div>
              <div className="hero-meta">
                <span>
                  {data.accountCount} card{data.accountCount !== 1 ? 's' : ''} ·{' '}
                  {fmtD(data.totalMinimums)}/mo mins ·{' '}
                  <span style={{ color: data.surplus >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                    {data.surplus >= 0 ? '+' : ''}{fmt(data.surplus)} surplus
                  </span>
                </span>
                {data.debtFreeDate && <span className="hero-date">{data.debtFreeDate}</span>}
              </div>
              {data.netWorth != null && (
                <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 2 }}>Total Assets</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{fmt(data.totalAssets ?? 0)}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 2 }}>Net Worth</div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: data.netWorth >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {data.netWorth < 0 ? '-' : ''}{fmt(Math.abs(data.netWorth))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Draggable widget grid */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={activeWidgets} strategy={rectSortingStrategy}>
                <div className="widget-grid">
                  {activeWidgets.map(id => {
                    const content = renderWidgetContent(id);
                    if (!content && !editMode) return null;
                    return (
                      <SortableWidgetShell
                        key={id}
                        id={id}
                        editMode={editMode}
                        onRemove={() => removeWidget(id)}
                      >
                        {content ?? (
                          <div className="card" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'center' }}>
                              {WIDGET_CATALOG.find(w => w.id === id)?.label}<br />
                              <span style={{ fontSize: 11 }}>No data yet</span>
                            </div>
                          </div>
                        )}
                      </SortableWidgetShell>
                    );
                  })}
                </div>
              </SortableContext>

              <DragOverlay>
                {dragActiveId ? (
                  <div style={{ opacity: 0.85, transform: 'scale(1.02)', filter: 'drop-shadow(0 8px 24px rgba(124,58,237,0.35))' }}>
                    {renderWidgetContent(dragActiveId) ?? (
                      <div className="card">
                        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{WIDGET_CATALOG.find(w => w.id === dragActiveId)?.label}</div>
                      </div>
                    )}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {/* Add widgets row (edit mode only) */}
            {editMode && hiddenWidgets.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="section-title">Add Widgets</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {hiddenWidgets.map(w => (
                    <button key={w.id} className="btn btn-outline btn-sm" onClick={() => addWidget(w.id)}>
                      + {w.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
