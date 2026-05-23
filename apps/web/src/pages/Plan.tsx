import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { apiFetch, fmt, fmtD } from '../lib/api';
import SubNav from '../components/SubNav';

type PlanTab = 'strategy' | 'goals' | 'insights';
type Strategy = 'avalanche' | 'snowball' | 'hybrid' | 'cashflow';

const STRATEGIES: { id: Strategy; name: string; sub: string }[] = [
  { id: 'avalanche', name: 'Avalanche',  sub: 'Highest APR first' },
  { id: 'snowball',  name: 'Snowball',   sub: 'Smallest balance first' },
  { id: 'hybrid',    name: 'Hybrid',     sub: 'Balanced approach' },
  { id: 'cashflow',  name: 'Cash Flow',  sub: 'Free up minimums fast' },
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

  function setTab(t: PlanTab) {
    t === 'strategy' ? setSearchParams({}) : setSearchParams({ tab: t });
  }

  // ── Strategy tab state ──
  const [planState, setPlanState] = useState<'loading' | 'error' | 'content'>('loading');
  const [plan, setPlan]           = useState<PlanData | null>(null);
  const [strategy, setStrategy]   = useState<Strategy>('avalanche');
  const [planError, setPlanError] = useState('');
  const [lumpAmount, setLumpAmount] = useState('');
  const [lumpResult, setLumpResult] = useState<LumpResult | null>(null);
  const [lumpLoading, setLumpLoading] = useState(false);
  const [reqDate, setReqDate]     = useState('');
  const [reqResult, setReqResult] = useState<ReqResult | null>(null);
  const [reqLoading, setReqLoading] = useState(false);

  // ── Goals tab state ──
  const [goalsState, setGoalsState] = useState<'idle' | 'loading' | 'error' | 'content'>('idle');
  const [goals, setGoals]           = useState<Goal[]>([]);
  const [goalAccounts, setGoalAccounts] = useState<GoalAccount[]>([]);
  const [goalsError, setGoalsError] = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ type: 'debt_free_date', accountId: '', targetDate: '', targetAmount: '' });
  const [saving, setSaving]         = useState(false);

  // ── Insights tab state ──
  const [insightState, setInsightState] = useState<'idle' | 'loading' | 'error' | 'content'>('idle');
  const [insightData, setInsightData]   = useState<InsightData | null>(null);
  const [generating, setGenerating]     = useState(false);

  // Load plan on mount (strategy tab default)
  useEffect(() => { loadPlan(); }, []);

  // Lazy-load Goals and Insights on first visit
  useEffect(() => {
    if (tab === 'goals'    && goalsState   === 'idle') loadGoals();
    if (tab === 'insights' && insightState === 'idle') loadInsights();
  }, [tab]);

  // ── Strategy tab ──

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

  // ── Goals tab ──

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
    if (!confirm('Delete this goal?')) return;
    await apiFetch(`/api/goals/${id}`, { method: 'DELETE' });
    loadGoals();
  }

  function goalLabel(g: Goal) {
    if (g.label)                          return g.label;
    if (g.goal_type === 'debt_free_date') return 'Debt-Free Date';
    if (g.account_name)                   return `Pay off ${g.account_name}`;
    return 'Goal';
  }

  // ── Insights tab ──

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
    try {
      const r = await apiFetch('/api/insights/generate', { method: 'POST' });
      const d = await r.json();
      if (r.status === 429) { alert(d.error); return; }
      setInsightData(d);
    } finally { setGenerating(false); }
  }

  return (
    <div className="page">
      <div className="top-bar">
        <h1>Plan</h1>
        <div className="sub">Your debt-free roadmap</div>
      </div>

      <div className="content">
        <SubNav tabs={PLAN_TABS} active={tab} onChange={t => setTab(t as PlanTab)} />

        {/* ── STRATEGY TAB ── */}
        {tab === 'strategy' && (
          <>
            {planState === 'loading' && <div className="loading-state"><div className="spinner" /><p>Calculating your plan…</p></div>}
            {planState === 'error' && (
              <div className="error-state">
                <div className="error-icon">⚠️</div>
                <p>Could not load plan</p><small>{planError}</small>
                <button className="btn btn-primary" onClick={() => loadPlan()}>Try Again</button>
              </div>
            )}
            {planState === 'content' && plan && (
              <>
                <div className="section-title">Strategy</div>
                <div className="strategy-grid">
                  {STRATEGIES.map(s => (
                    <button key={s.id} className={`strategy-btn ${strategy === s.id ? 'active' : ''}`} onClick={() => selectStrategy(s.id)}>
                      <span className="strat-name">{s.name}</span>
                      <span className="strat-sub">{s.sub}</span>
                    </button>
                  ))}
                </div>

                <div className="card">
                  <div className="card-label">Debt-Free Date</div>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>{plan.debtFreeDate}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-sm)', marginTop: 4 }}>
                    {plan.months} months · {fmtD(plan.totalInterest)} total interest
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-sm)', marginTop: 2 }}>
                    {fmtD(plan.surplus)}/mo surplus · {fmtD(plan.sinkingFundTotal)}/mo reserved
                  </div>
                </div>

                {plan.scenarios && plan.scenarios.length > 0 && (
                  <>
                    <div className="section-title">Pay More Scenarios</div>
                    <div className="scenarios">
                      {plan.scenarios.map((sc, i) => (
                        <div key={i} className="scenario">
                          <div className="sc-label">+{fmt(sc.extra)}/mo</div>
                          <div className="sc-months">{sc.months}</div>
                          <div className="sc-unit">months</div>
                          <div className="sc-interest">Save {fmt(sc.interestSaved)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="section-title">Attack Order</div>
                <div className="card">
                  {plan.cards.map((c, i) => (
                    <div key={i} className="attack-item">
                      <div className="attack-num">{i + 1}</div>
                      <div className="attack-body">
                        <div className="attack-name">{c.name}</div>
                        <div className="attack-sub">{c.apr}% APR · {fmtD(c.minimum_payment)}/mo min</div>
                      </div>
                      <div className="attack-right">
                        <div className="attack-balance">{fmtD(c.balance_current)}</div>
                        {c.payoffDate && <div className="attack-payoff">Free {c.payoffDate}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="section-title">Lump-Sum Simulator</div>
                <div className="card">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <input
                      style={{ flex: 1, padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 15, fontFamily: 'inherit' }}
                      type="number" min="1" placeholder="$ extra payment"
                      value={lumpAmount} onChange={e => { setLumpAmount(e.target.value); setLumpResult(null); }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={calcLump} disabled={!lumpAmount || lumpLoading}>
                      {lumpLoading ? '…' : 'Calculate'}
                    </button>
                  </div>
                  {lumpResult && (
                    <div className="lump-result">
                      <strong>Done by {lumpResult.newDebtFreeDate}</strong>
                      Saves {lumpResult.monthsSaved} month{lumpResult.monthsSaved !== 1 ? 's' : ''} and {fmtD(lumpResult.interestSaved)} in interest
                    </div>
                  )}
                </div>

                <div className="section-title">Required Payment Calculator</div>
                <div className="req-calc">
                  <div style={{ fontSize: 13, color: 'var(--text-sm)', marginBottom: 10 }}>
                    How much extra per month to be debt-free by a target date?
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      style={{ flex: 1, padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 15 }}
                      type="date" value={reqDate}
                      onChange={e => { setReqDate(e.target.value); setReqResult(null); }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={calcRequired} disabled={!reqDate || reqLoading}>
                      {reqLoading ? '…' : 'Calculate'}
                    </button>
                  </div>
                  {reqResult && (
                    <div className={`req-result ${reqResult.extra === 0 ? 'no-extra' : ''} ${!reqResult.feasible ? 'impossible' : ''}`}>
                      {!reqResult.feasible ? (
                        <><span className="req-amount">Not achievable</span>That date is before the minimum payment payoff. Try a later date.</>
                      ) : reqResult.extra === 0 ? (
                        <><span className="req-amount">No extra needed</span>Minimum payments already get you there.</>
                      ) : (
                        <><span className="req-amount">+{fmtD(reqResult.extra)}/mo</span>Extra payment needed on top of minimums.</>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ── GOALS TAB ── */}
        {tab === 'goals' && (
          <>
            {goalsState === 'loading' && <div className="loading-state"><div className="spinner" /><p>Loading goals…</p></div>}
            {goalsState === 'error' && (
              <div className="error-state">
                <div className="error-icon">⚠️</div>
                <p>Could not load goals</p><small>{goalsError}</small>
                <button className="btn btn-primary" onClick={loadGoals}>Try Again</button>
              </div>
            )}
            {goalsState === 'content' && (
              <>
                {goals.length === 0 && !showForm && (
                  <div className="empty">
                    <div className="empty-icon">🎯</div>
                    <p>No goals yet</p>
                    <small>Add a goal to track your progress toward debt freedom.</small>
                  </div>
                )}

                {goals.map(g => (
                  <div key={g.id} className={`goal-card ${g.onTrack ? 'on-track' : 'off-track'}`}>
                    <div className="goal-header">
                      <div>
                        <div className="goal-type">{g.goal_type.replace(/_/g, ' ')}</div>
                        <div className="goal-label">{goalLabel(g)}</div>
                        {g.target_date && (
                          <div className="goal-meta">Target: {new Date(g.target_date + 'T12:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                        )}
                        {g.target_amount && <div className="goal-meta">Target: {fmtD(g.target_amount)}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <span className={`goal-status-badge ${g.onTrack ? 'on-track' : 'off-track'}`}>
                          {g.onTrack ? '✅ On track' : '⚠️ Off track'}
                        </span>
                        <button className="btn btn-danger" onClick={() => deleteGoal(g.id)}>Delete</button>
                      </div>
                    </div>

                    {g.progress != null && (
                      <div className="progress-wrap">
                        <div className="progress-bar">
                          <div className="progress-fill blue" style={{ width: `${Math.min(g.progress, 100)}%` }} />
                        </div>
                        <div className="progress-labels">
                          <span>{g.progress.toFixed(0)}% complete</span>
                          {g.projectedDate && <span>Projected: {g.projectedDate}</span>}
                        </div>
                      </div>
                    )}

                    {g.requiredExtra != null && g.requiredExtra > 0 && (
                      <div className="goal-action">
                        Needs <strong>+{fmt(g.requiredExtra)}/mo</strong> extra to stay on track.
                      </div>
                    )}

                    {g.milestones && g.milestones.length > 0 && (
                      <div className="milestone-list" style={{ marginTop: 12 }}>
                        {g.milestones.map((m, i) => (
                          <div key={i} className="milestone-row">
                            <div className={`milestone-dot ${m.done ? 'done' : m.next ? 'next' : ''}`}>
                              {m.done ? '✓' : m.next ? '→' : '○'}
                            </div>
                            <div className="milestone-body">
                              <div className="milestone-title">{m.label}</div>
                            </div>
                            <div className="milestone-right">{m.date}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {showForm && (
                  <div className="card" style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>New Goal</div>
                    <div className="form-group">
                      <label>Type</label>
                      <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                        <option value="debt_free_date">Debt-Free Date</option>
                        <option value="account_payoff">Pay Off Card</option>
                        <option value="balance_target">Balance Target</option>
                      </select>
                    </div>
                    {form.type !== 'debt_free_date' && (
                      <div className="form-group">
                        <label>Card</label>
                        <select value={form.accountId} onChange={e => setForm(p => ({ ...p, accountId: e.target.value }))}>
                          <option value="">Select card…</option>
                          {goalAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="form-group">
                      <label>Target Date</label>
                      <input type="date" value={form.targetDate} onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))} />
                    </div>
                    {form.type === 'balance_target' && (
                      <div className="form-group">
                        <label>Target Balance ($)</label>
                        <input type="number" value={form.targetAmount} onChange={e => setForm(p => ({ ...p, targetAmount: e.target.value }))} placeholder="0.00" />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" onClick={addGoal} disabled={saving}>{saving ? '…' : 'Add Goal'}</button>
                      <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {!showForm && (
                  <button className="btn btn-primary btn-block mt-12" onClick={() => setShowForm(true)}>+ Add Goal</button>
                )}
              </>
            )}
          </>
        )}

        {/* ── INSIGHTS TAB ── */}
        {tab === 'insights' && (
          <>
            {insightState === 'loading' && <div className="loading-state"><div className="spinner" /><p>Loading insights…</p></div>}
            {insightState === 'error' && (
              <div className="error-state">
                <div className="error-icon">⚠️</div>
                <p>Could not load insights</p>
                <button className="btn btn-primary" onClick={loadInsights}>Try Again</button>
              </div>
            )}
            {insightState === 'content' && insightData && (
              <>
                <div className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div className="card-label">AI Spending Analysis</div>
                      {insightData.insight?.generated_at && (
                        <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                          {new Date(insightData.insight.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'right' }}>
                      {insightData.isPro ? 'Pro — unlimited' : `${insightData.used}/${insightData.limit} this month`}
                    </div>
                  </div>

                  {insightData.insight ? (
                    <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                      {insightData.insight.insight}
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 8 }}>
                      No analysis yet. Generate your first AI spending insight — Claude will review your debt profile and transactions to surface personalized recommendations.
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-primary btn-block"
                  onClick={generateInsight}
                  disabled={generating || (!insightData.isPro && insightData.remaining === 0)}
                >
                  {generating ? 'Analyzing…' : insightData.insight ? 'Refresh Analysis' : 'Generate Analysis'}
                </button>

                {!insightData.isPro && insightData.remaining === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'center', marginTop: 8 }}>
                    Monthly limit reached. Resets next month.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
