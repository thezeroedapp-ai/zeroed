import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis,
} from 'recharts';

import { Widget, WidgetHeader } from '@/components/ui/widget';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { AlertTriangle, CreditCard, ClipboardList, BarChart3, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch, fmtD } from '../lib/api';
import SubNav from '../components/SubNav';
import AvatarCircle from '@/components/ui/avatar-circle';

type Tab = 'transactions' | 'trends' | 'recurring';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  account_id: string;
  category?: string;
}

interface TrendPoint {
  month: string;
  [key: string]: string | number;
}

interface TrendsData {
  data: TrendPoint[];
  categories: string[];
}

interface RecurringItem {
  description: string;
  category: string;
  avgAmount: number;
  annualEstimate: number;
  occurrences: number;
  months: number;
  lastDate: string;
}

function monthKey(date: string) {
  return new Date(date + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const CHART_PALETTE = [
  'var(--primary)', 'var(--violet-light)', 'var(--blue)',
  'var(--green)', 'var(--amber)', 'var(--red)',
  'oklch(0.62 0.18 200)',
];

const SPENDING_TABS = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'trends',       label: 'Trends'       },
  { id: 'recurring',    label: 'Recurring'     },
];

export default function Spending() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') || 'transactions') as Tab;
  function setTab(t: Tab) { t === 'transactions' ? setSearchParams({}) : setSearchParams({ tab: t }); }

  const [txState, setTxState]             = useState<'loading' | 'error' | 'content'>('loading');
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [accountMap, setAccountMap]       = useState<Record<string, string>>({});
  const [filter, setFilter]               = useState<'all' | 'expenses' | 'payments'>('all');
  const [txError, setTxError]             = useState('');

  const [trendsState, setTrendsState] = useState<'idle' | 'loading' | 'content' | 'error'>('idle');
  const [trends, setTrends]           = useState<TrendsData | null>(null);

  const [recurringState, setRecurringState] = useState<'idle' | 'loading' | 'content' | 'error'>('idle');
  const [recurring, setRecurring]           = useState<RecurringItem[]>([]);

  async function loadTransactions() {
    setTxState('loading');
    try {
      const [r1, r2] = await Promise.all([
        apiFetch('/api/transactions?limit=100'),
        apiFetch('/api/plaid/accounts'),
      ]);
      if (!r1.ok) throw new Error(`Server returned ${r1.status}`);
      const txData  = await r1.json();
      const accData = r2.ok ? await r2.json() : { accounts: [] };
      const map: Record<string, string> = {};
      (accData.accounts || []).forEach((a: { id: string; name: string }) => { map[a.id] = a.name; });
      setTransactions(txData.transactions || []);
      setAccountMap(map);
      setTxState('content');
    } catch (e) {
      setTxError(e instanceof Error ? e.message : 'Could not load transactions');
      setTxState('error');
    }
  }

  async function loadTrends() {
    setTrendsState('loading');
    try {
      const r = await apiFetch('/api/transactions/trends');
      if (!r.ok) throw new Error('Failed');
      setTrends(await r.json());
      setTrendsState('content');
    } catch { setTrendsState('error'); }
  }

  async function loadRecurring() {
    setRecurringState('loading');
    try {
      const r = await apiFetch('/api/transactions/recurring');
      if (!r.ok) throw new Error('Failed');
      const d = await r.json();
      setRecurring(d.recurring || []);
      setRecurringState('content');
    } catch { setRecurringState('error'); }
  }

  useEffect(() => { loadTransactions(); }, []);
  useEffect(() => {
    if (tab === 'trends'    && trendsState    === 'idle') loadTrends();
    if (tab === 'recurring' && recurringState === 'idle') loadRecurring();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, searchParams]);

  const filtered = transactions.filter(t => {
    if (filter === 'expenses') return t.amount > 0;
    if (filter === 'payments') return t.amount < 0;
    return true;
  });

  const grouped: Record<string, Transaction[]> = {};
  filtered.forEach(t => {
    const k = monthKey(t.date);
    (grouped[k] = grouped[k] || []).push(t);
  });

  const sortedRecurring = [...recurring].sort((a, b) => b.annualEstimate - a.annualEstimate);
  const annualRecurring = recurring.reduce((s, r) => s + r.annualEstimate, 0);

  function buildChartConfig(categories: string[]): ChartConfig {
    return Object.fromEntries(
      categories.map((cat, i) => [cat, { label: cat, color: CHART_PALETTE[i % CHART_PALETTE.length] }])
    );
  }

  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-20 w-full bg-background/60 backdrop-blur-2xl border-b border-white/10">
        <div className="w-full max-w-[2560px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16">
          <div className="flex items-center justify-between gap-4 pt-5 pb-2">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Spending</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Transactions, trends, and subscriptions</p>
            </div>
          </div>
          <SubNav tabs={SPENDING_TABS} active={tab} onChange={t => setTab(t as Tab)}
            className="mb-0 border-b-0 mx-0 px-0 py-2" />
        </div>
      </div>

      <PageLayout className="pt-4 pb-20 md:pb-10">

        {/* ── TRANSACTIONS TAB ── */}
        {tab === 'transactions' && (
          <>
            {txState === 'loading' && (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="spinner" /><p className="text-sm text-muted-foreground">Loading transactions…</p>
              </div>
            )}
            {txState === 'error' && (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center"><AlertTriangle size={22} className="text-amber" /></div>
                <p className="font-semibold">Could not load transactions</p>
                <p className="text-sm text-muted-foreground">{txError}</p>
                <Button onClick={loadTransactions} className="bg-primary hover:bg-primary/90">Try Again</Button>
              </div>
            )}
            {txState === 'content' && (
              <>
                {/* Filter pills */}
                <div className="pills py-0 -mx-4 px-4 mb-4">
                  {(['all', 'expenses', 'payments'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={cn(
                        'shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border cursor-pointer font-[inherit]',
                        f === filter
                          ? 'bg-violet-dim border-[var(--primary)] text-violet-light'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground',
                      )}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

                {filtered.length > 0 && filter !== 'payments' && (
                  <Widget className="mb-4 border-[var(--primary)]/25 bg-gradient-to-r from-[var(--primary)]/10 to-blue/8 flex-row items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><CreditCard size={14} className="shrink-0" />Using the right card?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">See which cards earn the most on your top categories.</p>
                    </div>
                    <Link to="/accounts?tab=rewards"
                      className="text-xs font-semibold text-violet-light whitespace-nowrap ml-3 no-underline hover:opacity-80 transition-opacity">
                      Explore cards →
                    </Link>
                  </Widget>
                )}

                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center"><ClipboardList size={22} className="text-muted-foreground" /></div>
                    <p className="font-semibold">No transactions</p>
                    <p className="text-sm text-muted-foreground">Transactions appear here after syncing in Settings.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(grouped).map(([month, txs]) => {
                      const monthTotal = txs.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);
                      return (
                        <div key={month}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-foreground">{month}</p>
                            {monthTotal > 0 && <p className="text-sm font-semibold text-muted-foreground">{fmtD(monthTotal)}</p>}
                          </div>
                          <Widget className="p-0 overflow-hidden">
                            {txs.map((tx, idx) => (
                              <div key={tx.id} className={cn(
                                'flex items-center gap-3 px-5 py-4',
                                idx < txs.length - 1 && 'border-b border-border',
                              )}>
                                <AvatarCircle name={tx.description} size={36} color={tx.amount < 0 ? '#10b981' : undefined} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    {accountMap[tx.account_id] || tx.category || ''}
                                  </p>
                                </div>
                                <p className={cn('text-sm font-bold tabular shrink-0', tx.amount < 0 ? 'text-green' : 'text-red')}>
                                  {tx.amount < 0 ? '+' : ''}{fmtD(Math.abs(tx.amount))}
                                </p>
                              </div>
                            ))}
                          </Widget>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── TRENDS TAB ── */}
        {tab === 'trends' && (
          <>
            {trendsState === 'loading' && (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="spinner" /><p className="text-sm text-muted-foreground">Loading trends…</p>
              </div>
            )}
            {trendsState === 'error' && (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center"><AlertTriangle size={22} className="text-amber" /></div>
                <p className="font-semibold">Could not load trends</p>
                <Button onClick={loadTrends} className="bg-primary hover:bg-primary/90">Try Again</Button>
              </div>
            )}
            {trendsState === 'content' && trends && (
              trends.data.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center"><BarChart3 size={22} className="text-muted-foreground" /></div>
                  <p className="font-semibold">Not enough data yet</p>
                  <p className="text-sm text-muted-foreground">Sync your accounts and come back after a few months of transactions.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Widget>
                    <WidgetHeader title="Monthly Spending by Category" />
                    <ChartContainer config={buildChartConfig(trends.categories)} className="h-[220px] w-full">
                      <BarChart data={trends.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false}
                          tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                          width={38}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                        {trends.categories.map((cat, i) => (
                          <Bar
                            key={cat} dataKey={cat} stackId="a"
                            fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                            radius={i === trends.categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ChartContainer>
                  </Widget>

                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Top Categories</p>
                    <Widget className="p-0 overflow-hidden">
                      {trends.categories.map((cat, i) => {
                        const total = trends.data.reduce((s, d) => s + (Number(d[cat]) || 0), 0);
                        return (
                          <div key={cat} className={cn(
                            'flex items-center gap-3 px-5 py-4',
                            i < trends.categories.length - 1 && 'border-b border-border',
                          )}>
                            <div className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                            <p className="flex-1 text-sm font-medium text-foreground">{cat}</p>
                            <p className="text-sm text-muted-foreground tabular">
                              {fmtD(total / Math.max(1, trends.data.length))}/mo avg
                            </p>
                          </div>
                        );
                      })}
                    </Widget>
                  </div>
                </div>
              )
            )}
          </>
        )}

        {/* ── RECURRING TAB ── */}
        {tab === 'recurring' && (
          <>
            {recurringState === 'loading' && (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="spinner" /><p className="text-sm text-muted-foreground">Detecting subscriptions…</p>
              </div>
            )}
            {recurringState === 'error' && (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center"><AlertTriangle size={22} className="text-amber" /></div>
                <p className="font-semibold">Could not detect recurring charges</p>
                <Button onClick={loadRecurring} className="bg-primary hover:bg-primary/90">Try Again</Button>
              </div>
            )}
            {recurringState === 'content' && (
              sortedRecurring.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center"><RefreshCw size={22} className="text-muted-foreground" /></div>
                  <p className="font-semibold">No recurring charges found</p>
                  <p className="text-sm text-muted-foreground">Sync more transaction history to detect subscriptions and bills.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Widget>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Estimated Annual Subscriptions</p>
                    <p className="text-[40px] font-extrabold text-red tabular leading-none">{fmtD(annualRecurring)}</p>
                    <p className="text-sm text-muted-foreground">
                      {fmtD(annualRecurring / 12)}/mo across {sortedRecurring.length} recurring charge{sortedRecurring.length !== 1 ? 's' : ''}
                    </p>
                  </Widget>

                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Detected Recurring Charges</p>
                    <Widget className="p-0 overflow-hidden">
                      {sortedRecurring.map((r, i) => (
                        <div key={i} className={cn(
                          'flex items-center justify-between gap-3 px-5 py-4',
                          i < sortedRecurring.length - 1 && 'border-b border-border',
                        )}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{r.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{r.category}</Badge>
                              <span className="text-xs text-muted-foreground">{r.months} month{r.months !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-red tabular">{fmtD(r.avgAmount)}/mo</p>
                            <p className="text-xs text-muted-foreground tabular mt-0.5">{fmtD(r.annualEstimate)}/yr</p>
                          </div>
                        </div>
                      ))}
                    </Widget>
                  </div>
                </div>
              )
            )}
          </>
        )}
      </PageLayout>
    </div>
  );
}
