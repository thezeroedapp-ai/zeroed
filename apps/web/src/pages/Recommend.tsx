import { useEffect, useState, useRef } from 'react';

import { apiFetch } from '../lib/api';

interface Category { id: string; icon: string; label: string; }
interface Recommendation {
  rank: number;
  accountName: string;
  effectiveRate: number;
  multiplier: number;
  programName: string;
  rewardType: string;
  notes: string;
  penalized: boolean;
  earnedDollars: number | null;
}
interface RecommendData {
  recommendations: Recommendation[];
  unmatchedAccounts: string[];
  amount?: number;
  profilesLastUpdated?: string;
}

function rankClass(rank: number) {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return '';
}

function rankLabel(rank: number) {
  if (rank === 1) return '🥇 Best';
  if (rank === 2) return '🥈 2nd';
  if (rank === 3) return '🥉 3rd';
  return `#${rank}`;
}

export default function Recommend() {
  const [state, setState] = useState<'loading' | 'error' | 'content'>('loading');
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [results, setResults] = useState<RecommendData | null>(null);
  const [updatedNote, setUpdatedNote] = useState('');
  const [error, setError] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch('/api/recommendations/categories')
      .then(async r => {
        if (!r.ok) throw new Error('Failed to load categories');
        const d = await r.json();
        setCategories(d.categories || []);
        setUpdatedNote(`Reward profiles last updated: ${d.profilesLastUpdated} · Valuations via The Points Guy`);
        setState('content');
        setActiveCategory('dining');
      })
      .catch(e => { setError(e.message); setState('error'); });
  }, []);

  useEffect(() => {
    if (!activeCategory) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(fetchResults, 400);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [activeCategory, amount]);

  async function fetchResults() {
    if (!activeCategory) return;
    const url = `/api/recommendations?category=${activeCategory}${amount ? '&amount=' + encodeURIComponent(amount) : ''}`;
    try {
      const r = await apiFetch(url);
      if (!r.ok) throw new Error('Failed to fetch recommendations');
      setResults(await r.json());
    } catch (e) {
      setResults(null);
    }
  }

  return (
    <div className="page">
      <div className="top-bar">
        <h1>Card Recommender</h1>
        <div className="sub">Which card earns the most for this purchase?</div>
      </div>

      <div className="content">
        {state === 'loading' && <div className="loading-state"><div className="spinner" /><p>Loading your cards…</p></div>}
        {state === 'error' && (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <p>{error}</p>
          </div>
        )}
        {state === 'content' && (
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
                type="number" min="1" step="1" placeholder="$ optional" value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            {results && (
              results.recommendations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', fontSize: 14, color: 'var(--text-sm)', lineHeight: 1.6 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🃏</div>
                  <div>No connected cards matched a reward profile.</div>
                </div>
              ) : (
                <>
                  {results.recommendations.map(r => (
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
                      {r.earnedDollars != null && !r.penalized && (
                        <div className="rec-earn">Earn ${r.earnedDollars.toFixed(2)} on this purchase</div>
                      )}
                      {r.earnedDollars != null && r.penalized && (
                        <div className="rec-earn" style={{ color: 'var(--yellow)' }}>~${(r.earnedDollars / 0.5).toFixed(2)} if not carrying a balance</div>
                      )}
                      <div className="rec-notes">{r.notes}</div>
                    </div>
                  ))}
                  {results.unmatchedAccounts.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-sm)', textAlign: 'center', padding: '8px 0' }}>
                      Cards not in reward database: {results.unmatchedAccounts.join(', ')}
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
      </div>

    </div>
  );
}
