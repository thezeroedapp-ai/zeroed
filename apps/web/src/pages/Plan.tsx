import { useEffect, useState } from 'react';

import { apiFetch, fmt, fmtD } from '../lib/api';

type Strategy = 'avalanche' | 'snowball' | 'hybrid' | 'cashflow';

const STRATEGIES: { id: Strategy; name: string; sub: string }[] = [
  { id: 'avalanche', name: 'Avalanche', sub: 'Highest APR first' },
  { id: 'snowball', name: 'Snowball', sub: 'Smallest balance first' },
  { id: 'hybrid', name: 'Hybrid', sub: 'Balanced approach' },
  { id: 'cashflow', name: 'Cash Flow', sub: 'Free up minimums fast' },
];

interface PlanCard { name: string; balance_current: number; apr: number; minimum_payment: number; payoffMonth?: number; payoffDate?: string; }
interface PlanData {
  strategy: Strategy;
  months: number;
  totalInterest: number;
  debtFreeDate: string;
  surplus: number;
  sinkingFundTotal: number;
  monthlyIncome: number;
  cards: PlanCard[];
  scenarios?: { extra: number; months: number; interestSaved: number }[];
}

interface LumpResult { monthsSaved: number; interestSaved: number; newDebtFreeDate: string; }
interface ReqResult { extra: number; feasible: boolean; }

export default function Plan() {
  const [state, setState] = useState<'loading' | 'error' | 'content'>('loading');
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [strategy, setStrategy] = useState<Strategy>('avalanche');
  const [error, setError] = useState('');

  const [lumpAmount, setLumpAmount] = useState('');
  const [lumpResult, setLumpResult] = useState<LumpResult | null>(null);
  const [lumpLoading, setLumpLoading] = useState(false);

  const [reqDate, setReqDate] = useState('');
  const [reqResult, setReqResult] = useState<ReqResult | null>(null);
  const [reqLoading, setReqLoading] = useState(false);

  async function load(strat: Strategy = strategy) {
    setState('loading');
    try {
      const r = await apiFetch('/api/plan/generate', {
        method: 'POST',
        body: JSON.stringify({ strategy: strat }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `Server returned ${r.status}`);
      setPlan(d.plan);
      setState('content');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load plan');
      setState('error');
    }
  }

  useEffect(() => { load(); }, []);

  function selectStrategy(s: Strategy) {
    setStrategy(s);
    load(s);
  }

  async function calcLump() {
    if (!lumpAmount) return;
    setLumpLoading(true);
    try {
      const r = await apiFetch('/api/plan/lump-sum', {
        method: 'POST',
        body: JSON.stringify({ strategy, amount: parseFloat(lumpAmount) }),
      });
      const d = await r.json();
      setLumpResult(d);
    } finally { setLumpLoading(false); }
  }

  async function calcRequired() {
    if (!reqDate) return;
    setReqLoading(true);
    try {
      const r = await apiFetch('/api/plan/required-payment', {
        method: 'POST',
        body: JSON.stringify({ strategy, targetDate: reqDate }),
      });
      const d = await r.json();
      setReqResult(d);
    } finally { setReqLoading(false); }
  }

  return (
    <div className="page">
      <div className="top-bar">
        <h1>Payoff Plan</h1>
        <div className="sub">Your debt-free roadmap</div>
      </div>

      <div className="content">
        {state === 'loading' && <div className="loading-state"><div className="spinner" /><p>Calculating your plan…</p></div>}
        {state === 'error' && (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <p>Could not load plan</p>
            <small>{error}</small>
            <button className="btn btn-primary" onClick={() => load()}>Try Again</button>
          </div>
        )}
        {state === 'content' && plan && (
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
                {fmtD(plan.surplus)}/mo surplus · {fmtD(plan.sinkingFundTotal)}/mo reserved for sinking funds
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
                    <>
                      <span className="req-amount">Not achievable</span>
                      That date is before the minimum payment payoff. Try a later date.
                    </>
                  ) : reqResult.extra === 0 ? (
                    <>
                      <span className="req-amount">No extra needed</span>
                      Minimum payments already get you there.
                    </>
                  ) : (
                    <>
                      <span className="req-amount">+{fmtD(reqResult.extra)}/mo</span>
                      Extra payment needed on top of minimums.
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
