import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiFetch, fmt, fmtD } from '../lib/api';

interface DashboardData {
  user?: { name: string };
  totalDebt: number;
  monthlyInterest: number;
  surplus: number;
  accountCount: number;
  totalMinimums: number;
  debtFreeDate?: string;
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

interface GoalsData {
  goals?: { id: number; goal_type: string; account_name?: string; label?: string; onTrack?: boolean; requiredExtra?: number }[];
}

function greeting(name: string) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name}`;
}

export default function Dashboard() {
  const [state, setState] = useState<'loading' | 'error' | 'content'>('loading');
  const [data, setData] = useState<DashboardData | null>(null);
  const [goals, setGoals] = useState<GoalsData | null>(null);
  const [error, setError] = useState('');
  const [aiState, setAiState] = useState<'loading' | 'empty' | 'content' | 'limit' | 'error'>('loading');
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [aiError, setAiError] = useState('');

  async function load() {
    setState('loading');
    try {
      const [r1, r2] = await Promise.all([
        apiFetch('/api/dashboard'),
        apiFetch('/api/goals').catch(() => null),
      ]);
      if (!r1.ok) throw new Error(`Server returned ${r1.status}`);
      const d = await r1.json();
      const g = r2 ? await r2.json().catch(() => null) : null;
      setData(d);
      setGoals(g);
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
      if (!d.insight) {
        if (d.remaining === 0 && !d.isPro) setAiState('limit');
        else setAiState('empty');
      } else {
        setAiState('content');
      }
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

  useEffect(() => { load(); loadInsight(); }, []);

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page">
      <div className="top-bar">
        <div style={{ fontSize: 17, fontWeight: 700 }}>
          {data ? greeting(data.user?.name || 'there') : 'Welcome back'}
        </div>
        <div className="sub">{dateStr}</div>
      </div>

      <div className="content">
        {state === 'loading' && (
          <div className="loading-state"><div className="spinner" /><p>Loading your dashboard…</p></div>
        )}
        {state === 'error' && (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <p>Could not load dashboard</p>
            <small>{error}</small>
            <button className="btn btn-primary" onClick={load}>Try Again</button>
          </div>
        )}
        {state === 'content' && data && (
          <>
            <div className="card">
              <div className="card-label">Total Debt</div>
              <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{fmt(data.totalDebt)}</div>
              <div className="progress-wrap">
                <div className="progress-bar"><div className="progress-fill red" style={{ width: '100%' }} /></div>
                <div className="progress-labels">
                  <span>{data.accountCount} cards</span>
                  {data.debtFreeDate && <span style={{ fontWeight: 600, color: 'var(--blue)' }}>Free {data.debtFreeDate}</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-sm)', marginTop: 2 }}>
                {data.accountCount} cards · {fmtD(data.totalMinimums)}/mo minimums
              </div>
            </div>

            <div className="metrics">
              <div className="metric">
                <div className="m-label">Monthly Interest</div>
                <div className="m-value red">{fmtD(data.monthlyInterest)}</div>
              </div>
              <div className="metric">
                <div className="m-label">Monthly Surplus</div>
                <div className={`m-value ${data.surplus >= 0 ? 'green' : 'red'}`}>{fmt(data.surplus)}</div>
              </div>
            </div>

            {data.alerts && data.alerts.length > 0 && (
              <>
                <div className="section-title">⚠️ Alerts</div>
                {data.alerts.map((a, i) => (
                  <div key={i} className="warning">
                    <div className="warn-icon">{a.severity === 'danger' ? '🔴' : '⚠️'}</div>
                    <div>
                      <div className="warn-title">{a.title}</div>
                      <div className="warn-desc">{a.description}</div>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="section-title">This Month's Focus</div>
            <div className="focus-card">
              <div className="focus-label">⚡ Priority Attack</div>
              {data.priorityCard ? (
                <>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{data.priorityCard.name}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--red)' }}>{fmtD(data.priorityCard.balance_current)}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-sm)', marginTop: 4 }}>
                    {data.priorityCard.apr}% APR &nbsp;·&nbsp; {fmtD(data.priorityCard.minimum_payment)}/mo minimum
                    {data.priorityCard.payment_due_date && ` · Due ${new Date(data.priorityCard.payment_due_date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 10, color: 'var(--blue)', fontWeight: 500 }}>
                    Highest APR — every extra dollar here saves the most in interest.
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--text-sm)' }}>No cards connected yet.</div>
              )}
            </div>

            {goals?.goals && goals.goals.length > 0 && (
              <>
                <div className="section-title">Goals</div>
                {goals.goals.slice(0, 2).map((g) => {
                  const label = g.label || (g.goal_type === 'debt_free_date' ? 'Debt-Free Date' : g.account_name ? `Pay off ${g.account_name}` : 'Goal');
                  const status = g.onTrack ? '✅ On track' : g.requiredExtra ? `Needs +${fmt(g.requiredExtra)}/mo` : '⚠️ Review';
                  const color = g.onTrack ? 'var(--green)' : 'var(--yellow)';
                  return (
                    <div key={g.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                      <span style={{ fontSize: 12, fontWeight: 600, color }}>{status}</span>
                    </div>
                  );
                })}
                <Link to="/goals" className="btn btn-outline btn-block mt-8" style={{ display: 'block', textAlign: 'center' }}>View All Goals</Link>
              </>
            )}

            <div className="section-title" style={{ marginTop: 20 }}>AI Analysis</div>
            <div className="card">
              {aiState === 'loading' && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div className="spinner" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontSize: 13, color: 'var(--text-sm)' }}>Analyzing your habits…</div>
                </div>
              )}
              {aiState === 'empty' && (
                <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🧠</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Get personalized insights</div>
                  <div style={{ fontSize: 12, color: 'var(--text-sm)', marginBottom: 16, lineHeight: 1.6 }}>
                    Claude analyzes your spending patterns and debt profile to surface 3 specific actions that will get you debt-free faster.
                  </div>
                  <button className="btn btn-primary btn-block" onClick={generateInsight}>Generate Insights</button>
                </div>
              )}
              {aiState === 'content' && insight?.insight && (
                <>
                  <div>
                    {insight.insight.insight.split('\n').filter(l => l.trim()).map((line, i) => {
                      const m = line.trim().match(/^(\d+)\.\s*(.*)/s);
                      if (m) return (
                        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                          <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--blue-light)', color: 'var(--blue)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m[1]}</div>
                          <div style={{ fontSize: 13, lineHeight: 1.55, paddingTop: 3 }}>{m[2]}</div>
                        </div>
                      );
                      return <div key={i} style={{ fontSize: 13, color: 'var(--text-sm)', lineHeight: 1.55, marginBottom: 8 }}>{line}</div>;
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-sm)' }}>
                      {new Date(insight.insight.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {insight.isPro ? 'Pro — unlimited' : `${insight.used} of ${insight.limit} used`}
                    </div>
                    {(insight.isPro || (insight.remaining ?? 0) > 0) && (
                      <button className="btn btn-outline btn-sm" onClick={generateInsight}>Refresh</button>
                    )}
                  </div>
                </>
              )}
              {aiState === 'limit' && (
                <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>🔒</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Monthly limit reached</div>
                  <div style={{ fontSize: 12, color: 'var(--text-sm)', lineHeight: 1.6 }}>You've used all 10 free AI analyses this month.<br />Resets on the 1st.</div>
                </div>
              )}
              {aiState === 'error' && (
                <div style={{ fontSize: 13, color: 'var(--red)', textAlign: 'center', padding: '8px 0' }}>{aiError}</div>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
