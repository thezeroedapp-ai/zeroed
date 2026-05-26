import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, Bell, Car, CreditCard, Home, Landmark, Link2,
  LineChart as LineChartIcon, Plus, TrendingUp, Wallet, X,
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { apiFetch, fmt, fmtD } from '../lib/api';
import SubNav from '../components/SubNav';
import InstitutionLogo from '@/components/ui/institution-logo';
import CreditCardChip from '@/components/ui/credit-card-chip';
import { getInstitutionBrandColor } from '@/lib/institution-logos';

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountTab = 'accounts' | 'budget' | 'rewards';
type AccountCol = 'wealth' | 'debt' | 'real';

interface Account {
  id: string; name: string; type: string; subtype?: string;
  balance_current: number; balance_available: number | null;
  apr: number | null; minimum_payment: number | null; credit_limit: number | null;
  payment_due_date: string | null; institution_name: string;
  plaid_item_id?: string;
}
interface EditState { apr: string; minimum: string; saving: boolean; }

interface Holding {
  id: string;
  account_id: string;
  name: string;
  ticker_symbol: string | null;
  security_type: string;
  quantity: number;
  institution_value: number;
  cost_basis: number | null;
  close_price: number | null;
}

interface ManualAsset {
  id: string; name: string;
  asset_type: 'real_estate' | 'vehicle' | 'stocks_bonds' | 'other';
  asset_subtype?: string | null;
  current_value: number;
  linked_loan_id?: string | null;
}
interface ManualAssetForm {
  name: string; asset_type: ManualAsset['asset_type'];
  asset_subtype: string; current_value: string; linked_loan_id: string;
}

const BLANK_FORM: ManualAssetForm = {
  name: '', asset_type: 'stocks_bonds', asset_subtype: 'stock', current_value: '', linked_loan_id: '',
};

const ASSET_SUBTYPES: Record<ManualAsset['asset_type'], { value: string; label: string }[]> = {
  stocks_bonds: [
    { value: 'stock',       label: 'Individual Stocks' },
    { value: 'etf',         label: 'ETF' },
    { value: 'mutual_fund', label: 'Mutual Fund' },
    { value: 'bond',        label: 'Bond' },
    { value: 'crypto',      label: 'Crypto' },
    { value: 'other',       label: 'Other' },
  ],
  real_estate: [
    { value: 'primary_home', label: 'Primary Home' },
    { value: 'rental',       label: 'Rental Property' },
    { value: 'vacation',     label: 'Vacation Home' },
    { value: 'commercial',   label: 'Commercial Property' },
    { value: 'land',         label: 'Land' },
    { value: 'other',        label: 'Other Property' },
  ],
  vehicle: [
    { value: 'car',        label: 'Car' },
    { value: 'truck',      label: 'Truck / SUV' },
    { value: 'motorcycle', label: 'Motorcycle' },
    { value: 'boat',       label: 'Boat' },
    { value: 'rv',         label: 'RV / Camper' },
    { value: 'other',      label: 'Other Vehicle' },
  ],
  other: [
    { value: 'collectible', label: 'Collectible / Art' },
    { value: 'jewelry',     label: 'Jewelry' },
    { value: 'business',    label: 'Business Equity' },
    { value: 'other',       label: 'Other' },
  ],
};

interface Budget { id: string; category: string; monthly_limit: number; spent: number; remaining: number; pct: number; }
const PRESET_CATEGORIES = [
  'Food and Drink', 'Groceries', 'Restaurants', 'Travel', 'Shops', 'Recreation',
  'Entertainment', 'Healthcare', 'Gas Stations', 'Personal Care', 'Service', 'Bank Fees', 'Other',
];

interface Category { id: string; icon: string; label: string; }
interface Recommendation {
  rank: number; accountName: string; effectiveRate: number; multiplier: number;
  programName: string; rewardType: string; notes: string; penalized: boolean; earnedDollars: number | null;
}
interface RewardResult { recommendations: Recommendation[]; unmatchedAccounts: string[]; profilesLastUpdated?: string; }
interface NWSnapshot   { month: string; net_worth: number; }
interface AllocSlice   { name: string; value: number; color: string; }

function rankLabel(r: number) { return r === 1 ? 'Best' : r === 2 ? '2nd' : r === 3 ? '3rd' : `#${r}`; }

const ACCOUNT_TABS = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'budget',   label: 'Budget'   },
  { id: 'rewards',  label: 'Rewards'  },
];

const DIST_PALETTE = [
  'var(--chart-2)', 'var(--chart-4)', 'var(--chart-1)',
  'var(--blue)', 'var(--green)', 'var(--chart-3)',
  'var(--violet-light)', 'var(--chart-5)',
];

// ─── DistBar ──────────────────────────────────────────────────────────────────
function DistBar({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0 || items.length <= 1) return null;
  return (
    <div className="mb-5">
      <div className="flex h-2 rounded-full overflow-hidden bg-surface-2">
        {items.map((item, i) => (
          <div key={i} className="h-full transition-all"
            style={{ width: `${Math.max((item.value / total) * 100, 0.5)}%`, background: item.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />
            <span className="text-[10px] text-muted-foreground">
              {item.label} <span className="font-semibold text-foreground">{Math.round((item.value / total) * 100)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── EquityBar ────────────────────────────────────────────────────────────────
function EquityBar({ equityPct, equity, propertyValue }: { equityPct: number; equity: number; propertyValue: number }) {
  return (
    <div className="mt-2.5">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
        <span>Value <span className="text-foreground font-semibold">{fmt(propertyValue)}</span></span>
        <span className="text-green font-semibold">{fmt(equity)} equity</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-2">
        <div className="h-full transition-all" style={{ width: `${equityPct}%`, background: 'var(--chart-2)' }} />
        <div className="h-full transition-all" style={{ width: `${100 - equityPct}%`, background: 'var(--muted-foreground)', opacity: 0.2 }} />
      </div>
      <div className="flex justify-between text-[10px] mt-1.5">
        <span className="text-chart-2 font-medium">Equity {equityPct}%</span>
        <span className="text-muted-foreground">LTV {100 - equityPct}%</span>
      </div>
    </div>
  );
}

// ─── AssetForm ────────────────────────────────────────────────────────────────
function AssetForm({
  form, loanAccounts, onChange, onSave, onCancel, saving, submitLabel,
}: {
  form: ManualAssetForm; loanAccounts: Account[];
  onChange: (p: Partial<ManualAssetForm>) => void;
  onSave: () => void; onCancel: () => void; saving: boolean; submitLabel: string;
}) {
  const subtypes = ASSET_SUBTYPES[form.asset_type];
  const showLoanLink = form.asset_type === 'real_estate' || form.asset_type === 'vehicle';
  return (
    <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Type</Label>
          <Select value={form.asset_type}
            onValueChange={v => onChange({ asset_type: v as ManualAsset['asset_type'], asset_subtype: ASSET_SUBTYPES[v as ManualAsset['asset_type']][0].value })}>
            <SelectTrigger className="h-8 text-sm bg-input border-border text-foreground"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="stocks_bonds">Stocks & Bonds</SelectItem>
              <SelectItem value="real_estate">Real Estate</SelectItem>
              <SelectItem value="vehicle">Vehicle</SelectItem>
              <SelectItem value="other">Other Asset</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Subtype</Label>
          <Select value={form.asset_subtype} onValueChange={v => onChange({ asset_subtype: v })}>
            <SelectTrigger className="h-8 text-sm bg-input border-border text-foreground"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              {subtypes.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Name</Label>
        <Input
          placeholder={form.asset_type === 'real_estate' ? 'e.g. My Home' : form.asset_type === 'vehicle' ? 'e.g. Toyota Camry' : 'e.g. Vanguard S&P 500'}
          value={form.name} onChange={e => onChange({ name: e.target.value })}
          className="h-8 text-sm bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Current Value ($)</Label>
        <Input type="number" min="0" step="1000" placeholder="e.g. 600000"
          value={form.current_value} onChange={e => onChange({ current_value: e.target.value })}
          className="h-8 text-sm bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
      </div>
      {showLoanLink && loanAccounts.length > 0 && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Link to Loan (optional)</Label>
          <Select value={form.linked_loan_id || 'none'} onValueChange={v => onChange({ linked_loan_id: v === 'none' ? '' : v })}>
            <SelectTrigger className="h-8 text-sm bg-input border-border text-foreground"><SelectValue placeholder="No linked loan" /></SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="none">No linked loan</SelectItem>
              {loanAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {fmtD(a.balance_current)}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">Links this asset to calculate equity automatically.</p>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSave} disabled={saving || !form.name || !form.current_value}
          className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground">
          {saving ? '…' : submitLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="h-8 border-border text-muted-foreground">
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function projectFIPath(
  startNW: number,
  monthlyContribution: number,
  annualReturn: number,
  years: number,
): Array<{ year: number; netWorth: number }> {
  const monthlyRate = annualReturn / 12;
  const currentYear = new Date().getFullYear();
  let nw = startNW;
  const data: Array<{ year: number; netWorth: number }> = [{ year: currentYear, netWorth: Math.round(nw) }];
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) nw = nw * (1 + monthlyRate) + monthlyContribution;
    data.push({ year: currentYear + y, netWorth: Math.round(nw) });
  }
  return data;
}

// ─── Viz sub-components ────────────────────────────────────────────────────────

function CashBufferGauge({ liquidCash, monthlyExpenses }: { liquidCash: number; monthlyExpenses: number }) {
  const runway = monthlyExpenses > 0 ? liquidCash / monthlyExpenses : 0;
  const pct    = Math.min(100, (runway / 6) * 100);
  const cx = 70, cy = 60, r = 50;
  const angle = Math.PI * (1 - pct / 100);
  const px = (cx + r * Math.cos(angle)).toFixed(2);
  const py = (cy - r * Math.sin(angle)).toFixed(2);
  const c = runway < 3 ? 'var(--red)' : runway < 6 ? 'var(--amber)' : 'var(--green)';
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-0 pt-5 px-5">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Wallet size={13} className="text-muted-foreground shrink-0" />Emergency Runway
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-2">
        <svg viewBox="0 0 140 72" className="w-full max-w-[190px] mx-auto block overflow-visible">
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none" stroke="var(--surface-2)" strokeWidth="10" strokeLinecap="round" />
          {pct > 0 && (
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${px} ${py}`}
              fill="none" stroke={c} strokeWidth="10" strokeLinecap="round" />
          )}
          <text x={cx} y={cy - 5} textAnchor="middle" fontSize="18" fontWeight="800" style={{ fill: c }}>
            {runway < 100 ? runway.toFixed(1) : '99+'}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" style={{ fill: 'var(--muted-foreground)' }}>
            months
          </text>
        </svg>
        <div className="flex justify-between text-[10px] mt-1">
          <span style={{ color: 'var(--red)' }} className="font-medium">&lt;3 critical</span>
          <span className="text-muted-foreground">{fmt(liquidCash)} liquid</span>
          <span style={{ color: 'var(--green)' }} className="font-medium">&gt;6 safe</span>
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingPayments({ creditAccounts }: { creditAccounts: Account[] }) {
  const now = Date.now();
  const items = creditAccounts
    .filter(a => a.payment_due_date)
    .map(a => {
      const d = new Date(a.payment_due_date! + 'T12:00');
      return { ...a, ts: d.getTime(), days: Math.ceil((d.getTime() - now) / 86400000), label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    })
    .filter(a => a.days > -3 && a.days <= 14)
    .sort((a, b) => a.ts - b.ts);
  if (items.length === 0) return null;
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-0 pt-5 px-5">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bell size={13} className="text-muted-foreground shrink-0" />Upcoming Payments
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground px-1.5 py-0">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-3 space-y-2.5">
        {items.map(a => {
          const overdue = a.days < 0;
          const urgent  = !overdue && a.days <= 3;
          return (
            <div key={a.id} className="flex items-center gap-3">
              <div className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-0.5', overdue ? 'bg-red' : urgent ? 'bg-amber' : 'bg-muted-foreground/40')} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{a.name}</p>
                <p className={cn('text-[10px]', overdue ? 'text-red font-medium' : urgent ? 'text-amber font-medium' : 'text-muted-foreground')}>
                  {overdue ? `${Math.abs(a.days)}d overdue` : a.days === 0 ? 'Due today' : `${a.days}d · ${a.label}`}
                </p>
              </div>
              <span className="text-xs font-bold tabular text-foreground shrink-0">
                {a.minimum_payment != null ? fmtD(a.minimum_payment) : '—'}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function UtilizationDial({ totalDebt, totalLimit, monthlyInterest }: {
  totalDebt: number; totalLimit: number; monthlyInterest: number;
}) {
  if (totalLimit <= 0) return null;
  const pct  = Math.min(100, (totalDebt / totalLimit) * 100);
  const cx = 70, cy = 60, r = 50;
  const angle = Math.PI * (1 - pct / 100);
  const px = (cx + r * Math.cos(angle)).toFixed(2);
  const py = (cy - r * Math.sin(angle)).toFixed(2);
  const c    = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--amber)' : 'var(--chart-2)';
  const avail = Math.max(0, totalLimit - totalDebt);
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-0 pt-5 px-5">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CreditCard size={13} className="text-muted-foreground shrink-0" />Credit Utilization
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-2">
        <svg viewBox="0 0 140 72" className="w-full max-w-[190px] mx-auto block overflow-visible">
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none" stroke="var(--surface-2)" strokeWidth="10" strokeLinecap="round" />
          {pct > 0 && (
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${px} ${py}`}
              fill="none" stroke={c} strokeWidth="10" strokeLinecap="round" />
          )}
          <text x={cx} y={cy - 5} textAnchor="middle" fontSize="18" fontWeight="800" style={{ fill: c }}>
            {Math.round(pct)}%
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" style={{ fill: 'var(--muted-foreground)' }}>
            utilized
          </text>
        </svg>
        <div className="grid grid-cols-3 gap-2 mt-1 text-center">
          {[
            { label: 'Balance',      value: fmt(totalDebt)        },
            { label: 'Available',    value: fmt(avail)            },
            { label: 'Mo. Interest', value: fmtD(monthlyInterest) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="text-xs font-bold tabular text-foreground mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const ALLOC_CONFIG: ChartConfig = {
  Cash:          { label: 'Cash',        color: 'var(--chart-2)' },
  Investments:   { label: 'Investments', color: 'var(--chart-4)' },
  'Real Estate': { label: 'Real Estate', color: 'var(--chart-1)' },
  Vehicles:      { label: 'Vehicles',    color: 'var(--chart-5)' },
  Other:         { label: 'Other',       color: 'var(--chart-3)' },
};

function AllocationDonut({ slices, totalAssets }: { slices: AllocSlice[]; totalAssets: number }) {
  if (slices.length === 0 || totalAssets <= 0) return null;
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-0 pt-5 px-5">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp size={13} className="text-muted-foreground shrink-0" />Asset Allocation
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-2">
        <ChartContainer config={ALLOC_CONFIG} className="aspect-square max-h-[150px] w-full mx-auto">
          <PieChart>
            <Pie data={slices} cx="50%" cy="50%" innerRadius="52%" outerRadius="80%" paddingAngle={2} dataKey="value" nameKey="name">
              {slices.map(s => <Cell key={s.name} fill={s.color} />)}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => [
              `${fmt(Number(v))} · ${Math.round((Number(v) / totalAssets) * 100)}%`, n as string,
            ]} />} />
          </PieChart>
        </ChartContainer>
        <div className="space-y-1.5 mt-3">
          {slices.map(s => (
            <div key={s.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-[11px] text-muted-foreground">{s.name}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-semibold tabular text-foreground">{fmt(s.value)}</span>
                <span className="text-[10px] text-muted-foreground">{Math.round((s.value / totalAssets) * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const FI_CONFIG: ChartConfig = {
  netWorth: { label: 'Net Worth', color: 'var(--violet-light)' },
};

function FIProjector({ currentNW, userIncome, fiTarget }: { currentNW: number; userIncome: number; fiTarget: number }) {
  const [savingsRate, setSavingsRate] = useState(20);
  const monthlyContrib = (userIncome * savingsRate) / 100;

  const chartData = useMemo(
    () => projectFIPath(currentNW, monthlyContrib, 0.07, 30),
    [currentNW, monthlyContrib],
  );

  const fiYear    = chartData.find(d => d.netWorth >= fiTarget);
  const fiLabel   = fiYear ? `${fiYear.year}` : '30y+';
  const fiProgress = fiTarget > 0 ? Math.min(100, Math.round((Math.max(0, currentNW) / fiTarget) * 100)) : 0;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-0 pt-5 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp size={13} className="text-muted-foreground shrink-0" />FI Projector
          </CardTitle>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{fiProgress}% to FI</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Target <span className="font-semibold text-foreground">{fmt(fiTarget)}</span> · reach by{' '}
          <span className="font-semibold text-violet-light">{fiLabel}</span>
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-2 space-y-3">
        <div className="aspect-[2/1] w-full">
          <ChartContainer config={FI_CONFIG} className="h-full w-full">
            <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="fiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--violet-light)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--violet-light)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => `'${String(v).slice(2)}`} interval={4} />
              <YAxis hide domain={['auto', 'auto']} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Net Worth']} />} />
              <Area type="monotone" dataKey="netWorth" stroke="var(--violet-light)" strokeWidth={2} fill="url(#fiGrad)" dot={false} />
            </AreaChart>
          </ChartContainer>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs text-muted-foreground">Savings rate</label>
            <span className="text-sm font-bold tabular text-foreground">{savingsRate}%</span>
          </div>
          <input
            type="range" min={1} max={60} step={1} value={savingsRate}
            onChange={e => setSavingsRate(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-surface-2 cursor-pointer accent-[var(--primary)]"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>1%</span>
            <span>{fmtD(monthlyContrib)}/mo saved</span>
            <span>60%</span>
          </div>
        </div>
        <div>
          <Progress value={fiProgress} className="h-1 [&>div]:bg-violet-light" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Accounts page ────────────────────────────────────────────────────────────
export default function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') || 'accounts') as AccountTab;
  function setTab(t: AccountTab) { if (t === 'accounts') setSearchParams({}); else setSearchParams({ tab: t }); }
  const [activeCol, setActiveCol] = useState<AccountCol>('wealth');

  // Plaid accounts
  const [acctState, setAcctState] = useState<'loading' | 'error' | 'content'>('loading');
  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [acctError, setAcctError] = useState('');
  const [editing, setEditing]     = useState<Record<string, EditState>>({});

  // Holdings
  const [holdings, setHoldings]               = useState<Holding[]>([]);
  const [reconnecting, setReconnecting]       = useState<string | null>(null);
  const [plaidConnecting, setPlaidConnecting] = useState(false);

  // Financial metrics for viz widgets
  const [userIncome,   setUserIncome]   = useState(0);
  const [userExpenses, setUserExpenses] = useState(0);
  const [nwHistory,    setNwHistory]    = useState<NWSnapshot[]>([]);

  // Manual assets
  const [manualAssets, setManualAssets]       = useState<ManualAsset[]>([]);
  const [addingSection, setAddingSection]     = useState<ManualAsset['asset_type'] | null>(null);
  const [addForm, setAddForm]                 = useState<ManualAssetForm>(BLANK_FORM);
  const [addSaving, setAddSaving]             = useState(false);
  const [editingAssetId, setEditingAssetId]   = useState<string | null>(null);
  const [editForm, setEditForm]               = useState<ManualAssetForm>(BLANK_FORM);
  const [editSaving, setEditSaving]           = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Budget
  const [confirmBudgetId, setConfirmBudgetId] = useState<string | null>(null);
  const [budgetState, setBudgetState]   = useState<'idle' | 'loading' | 'error' | 'content'>('idle');
  const [budgets, setBudgets]           = useState<Budget[]>([]);
  const [budgetError, setBudgetError]   = useState('');
  const [budgetForm, setBudgetForm]     = useState({ category: 'Food and Drink', limit: '' });
  const [budgetSaving, setBudgetSaving] = useState(false);

  // Rewards
  const [rewardsState, setRewardsState]     = useState<'idle' | 'loading' | 'error' | 'content'>('idle');
  const [categories, setCategories]         = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [rewardAmount, setRewardAmount]     = useState('');
  const [rewardResults, setRewardResults]   = useState<RewardResult | null>(null);
  const [updatedNote, setUpdatedNote]       = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadAll(); }, []);
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

  async function loadAll() {
    setAcctState('loading');
    try {
      const [rAcct, rManual, rHoldings, rUser, rNWH] = await Promise.all([
        apiFetch('/api/plaid/accounts'),
        apiFetch('/api/manual-assets').catch(() => null),
        apiFetch('/api/plaid/holdings').catch(() => null),
        apiFetch('/api/user').catch(() => null),
        apiFetch('/api/net-worth-history').catch(() => null),
      ]);
      if (!rAcct.ok) throw new Error(`Server returned ${rAcct.status}`);
      const dAcct     = await rAcct.json();
      const dManual   = rManual   ? await rManual.json().catch(() => null)   : null;
      const dHoldings = rHoldings ? await rHoldings.json().catch(() => null) : null;
      const dUser     = rUser     ? await rUser.json().catch(() => null)     : null;
      const dNWH      = rNWH      ? await rNWH.json().catch(() => null)      : null;
      setAccounts(dAcct.accounts || []);
      setManualAssets(dManual?.assets || []);
      setHoldings(dHoldings?.holdings || []);
      if (dUser?.user) {
        setUserIncome(dUser.user.monthly_income || 0);
        setUserExpenses(dUser.user.monthly_expenses || 0);
      }
      setNwHistory(dNWH?.history || []);
      setAcctState('content');
    } catch (e) {
      setAcctError(e instanceof Error ? e.message : 'Could not load accounts');
      setAcctState('error');
    }
  }

  function loadPlaidScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as Window & { Plaid?: unknown }).Plaid) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function reconnectItem(plaidItemId: string) {
    setReconnecting(plaidItemId);
    try {
      await loadPlaidScript();
      const r = await apiFetch('/api/plaid/create-link-token/update', {
        method: 'POST', body: JSON.stringify({ item_id: plaidItemId }),
      });
      const { link_token } = await r.json();
      (window as Window & { Plaid?: { create: (cfg: object) => { open: () => void } } }).Plaid?.create({
        token:     link_token,
        onSuccess: async () => { await apiFetch('/api/plaid/sync', { method: 'POST' }); loadAll(); },
        onExit:    () => setReconnecting(null),
      }).open();
    } catch { setReconnecting(null); }
  }

  async function connectBrokerageViaPlaid() {
    setPlaidConnecting(true);
    try {
      await loadPlaidScript();
      const r = await apiFetch('/api/plaid/create-link-token', { method: 'POST' });
      const { link_token } = await r.json();
      (window as Window & { Plaid?: { create: (cfg: object) => { open: () => void } } }).Plaid?.create({
        token:     link_token,
        onSuccess: async (token: string, metadata: { institution?: { name?: string } }) => {
          await apiFetch('/api/plaid/exchange-token', {
            method: 'POST',
            body: JSON.stringify({ public_token: token, institution_name: metadata?.institution?.name || null }),
          });
          await apiFetch('/api/plaid/sync', { method: 'POST' });
          setPlaidConnecting(false);
          loadAll();
        },
        onExit: () => setPlaidConnecting(false),
      }).open();
    } catch { setPlaidConnecting(false); }
  }

  function startEdit(acc: Account) {
    setEditing(p => ({ ...p, [acc.id]: { apr: acc.apr?.toString() ?? '', minimum: acc.minimum_payment?.toString() ?? '', saving: false } }));
  }
  function cancelEdit(id: string) { setEditing(p => { const n = { ...p }; delete n[id]; return n; }); }
  function updateEditField(id: string, field: 'apr' | 'minimum', value: string) {
    setEditing(p => ({ ...p, [id]: { ...p[id], [field]: value } }));
  }
  async function saveEdit(id: string) {
    const e = editing[id];
    const apr = parseFloat(e.apr); const minimum = parseFloat(e.minimum);
    if (isNaN(apr) || apr < 0 || isNaN(minimum) || minimum < 0) return;
    setEditing(p => ({ ...p, [id]: { ...p[id], saving: true } }));
    try {
      const r = await apiFetch(`/api/plaid/accounts/${id}/credit-details`, {
        method: 'PUT', body: JSON.stringify({ apr, minimum_payment: minimum }),
      });
      if (!r.ok) throw new Error('Save failed');
      cancelEdit(id); loadAll();
    } catch { setEditing(p => ({ ...p, [id]: { ...p[id], saving: false } })); }
  }

  function openAdd(type: ManualAsset['asset_type']) {
    setAddingSection(type);
    setAddForm({ ...BLANK_FORM, asset_type: type, asset_subtype: ASSET_SUBTYPES[type][0].value });
  }
  async function saveAdd() {
    const val = parseFloat(addForm.current_value);
    if (!addForm.name || isNaN(val)) return;
    setAddSaving(true);
    try {
      await apiFetch('/api/manual-assets', {
        method: 'POST',
        body: JSON.stringify({ name: addForm.name, asset_type: addForm.asset_type, asset_subtype: addForm.asset_subtype, current_value: val, linked_loan_id: addForm.linked_loan_id || null }),
      });
      setAddingSection(null); loadAll();
    } finally { setAddSaving(false); }
  }
  function startEditAsset(a: ManualAsset) {
    setEditingAssetId(a.id);
    setEditForm({ name: a.name, asset_type: a.asset_type, asset_subtype: a.asset_subtype || '', current_value: String(a.current_value), linked_loan_id: a.linked_loan_id || '' });
  }
  async function saveEditAsset() {
    if (!editingAssetId) return;
    const val = parseFloat(editForm.current_value);
    if (!editForm.name || isNaN(val)) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/manual-assets/${editingAssetId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editForm.name, asset_type: editForm.asset_type, asset_subtype: editForm.asset_subtype, current_value: val, linked_loan_id: editForm.linked_loan_id || null }),
      });
      setEditingAssetId(null); loadAll();
    } finally { setEditSaving(false); }
  }
  async function deleteAsset(id: string) {
    await apiFetch(`/api/manual-assets/${id}`, { method: 'DELETE' });
    setConfirmDeleteId(null); loadAll();
  }

  // Derived totals
  const plaidAssets      = accounts.filter(a => ['depository', 'investment', 'brokerage'].includes(a.type)).reduce((s, a) => s + (a.balance_current || 0), 0);
  const manualTotal      = manualAssets.reduce((s, a) => s + (a.current_value || 0), 0);
  const totalAssets      = plaidAssets + manualTotal;
  const totalLiabilities = accounts.filter(a => ['credit', 'loan', 'mortgage'].includes(a.type)).reduce((s, a) => s + (a.balance_current || 0), 0);
  const netWorth         = totalAssets - totalLiabilities;
  const loanAccounts     = accounts.filter(a => ['loan', 'mortgage'].includes(a.type));
  const creditAccounts   = accounts.filter(a => a.type === 'credit');
  const totalCreditDebt  = creditAccounts.reduce((s, a) => s + (a.balance_current || 0), 0);
  const totalCreditLimit = creditAccounts.reduce((s, a) => s + (a.credit_limit || 0), 0);
  const monthlyInterest  = creditAccounts.reduce((s, a) => s + (a.balance_current || 0) * ((a.apr || 0) / 100 / 12), 0);

  // Pulse header metrics
  const liquidCash       = accounts.filter(a => a.type === 'depository').reduce((s, a) => s + (a.balance_current || 0), 0);
  const effectiveExpenses = userExpenses > 0
    ? userExpenses
    : creditAccounts.reduce((s, a) => s + (a.minimum_payment || 0), 0) + monthlyInterest + 1500;
  const runwayMonths     = effectiveExpenses > 0 ? liquidCash / effectiveExpenses : 0;
  const nwDelta          = nwHistory.length >= 2
    ? nwHistory[nwHistory.length - 1].net_worth - nwHistory[0].net_worth
    : null;

  const MILESTONES = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000];
  const nextMsIdx   = MILESTONES.findIndex(m => m > netWorth);
  const hasNextMs   = nextMsIdx >= 0;
  const nextMsValue = hasNextMs ? MILESTONES[nextMsIdx] : MILESTONES[MILESTONES.length - 1];
  const prevMsValue = hasNextMs && nextMsIdx > 0 ? MILESTONES[nextMsIdx - 1] : 0;
  const msProgress  = hasNextMs && nextMsValue > prevMsValue
    ? Math.min(100, Math.round(((Math.max(0, netWorth) - prevMsValue) / (nextMsValue - prevMsValue)) * 100))
    : 100;

  const allocationSlices = useMemo<AllocSlice[]>(() => {
    const invVal = accounts.filter(a => ['investment', 'brokerage'].includes(a.type)).reduce((s, a) => s + (a.balance_current || 0), 0);
    const sbVal  = manualAssets.filter(a => a.asset_type === 'stocks_bonds').reduce((s, a) => s + a.current_value, 0);
    const reVal  = manualAssets.filter(a => a.asset_type === 'real_estate').reduce((s, a) => s + a.current_value, 0);
    const vehVal = manualAssets.filter(a => a.asset_type === 'vehicle').reduce((s, a) => s + a.current_value, 0);
    const othVal = manualAssets.filter(a => a.asset_type === 'other').reduce((s, a) => s + a.current_value, 0);
    return [
      { name: 'Cash',        value: liquidCash,    color: 'var(--chart-2)' },
      { name: 'Investments', value: invVal + sbVal, color: 'var(--chart-4)' },
      { name: 'Real Estate', value: reVal,          color: 'var(--chart-1)' },
      { name: 'Vehicles',    value: vehVal,         color: 'var(--chart-5)' },
      { name: 'Other',       value: othVal,         color: 'var(--chart-3)' },
    ].filter(s => s.value > 0);
  }, [liquidCash, accounts, manualAssets]);

  const fiTarget = useMemo(() => {
    const annualExp = userExpenses > 0 ? userExpenses * 12 : effectiveExpenses * 12;
    return annualExp > 0 ? Math.round((annualExp * 25) / 1000) * 1000 : 1_000_000;
  }, [userExpenses, effectiveExpenses]);

  // Budget
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
    try {
      await apiFetch('/api/budgets', { method: 'POST', body: JSON.stringify({ category: budgetForm.category, monthly_limit: parseFloat(budgetForm.limit) }) });
      setBudgetForm({ category: 'Food and Drink', limit: '' }); loadBudgets();
    } finally { setBudgetSaving(false); }
  }
  async function deleteBudget(id: string) { await apiFetch(`/api/budgets/${id}`, { method: 'DELETE' }); setConfirmBudgetId(null); loadBudgets(); }
  const totalBudgeted  = budgets.reduce((s, b) => s + b.monthly_limit, 0);
  const totalSpent     = budgets.reduce((s, b) => s + b.spent, 0);
  const overallBudgPct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const month          = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Rewards
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground w-full">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 w-full border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 md:px-10 lg:px-12 py-5">
          <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Assets, liabilities, budgets &amp; rewards</p>
        </div>
      </div>

      <div className="px-6 md:px-10 lg:px-12 pt-6 pb-20 md:pb-10 w-full max-w-[1600px] mx-auto">
        <SubNav tabs={ACCOUNT_TABS} active={tab} onChange={t => setTab(t as AccountTab)} />

        {/* ── ACCOUNTS TAB ── */}
        {tab === 'accounts' && (
          <>
            {acctState === 'loading' && (
              <div className="flex flex-col items-center py-20 gap-3">
                <div className="spinner" />
                <p className="text-sm text-muted-foreground">Loading accounts…</p>
              </div>
            )}
            {acctState === 'error' && (
              <div className="flex flex-col items-center py-20 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center">
                  <AlertTriangle size={22} className="text-amber" />
                </div>
                <p className="font-semibold">Could not load accounts</p>
                <p className="text-sm text-muted-foreground">{acctError}</p>
                <Button onClick={loadAll} className="bg-primary hover:bg-primary/90">Try Again</Button>
              </div>
            )}
            {acctState === 'content' && (
              <div className="mt-6 space-y-5">

                {/* ── Pulse Header ── */}
                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 divide-y md:divide-y-0 md:divide-x divide-border">

                      {/* Emergency Runway */}
                      <div className="pb-4 md:pb-0 md:pr-4">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Emergency Runway</p>
                        <div className="flex items-baseline gap-2">
                          <span className={cn('text-3xl font-black tabular leading-none',
                            runwayMonths < 3 ? 'text-red' : runwayMonths < 6 ? 'text-amber' : 'text-green')}>
                            {runwayMonths < 100 ? runwayMonths.toFixed(1) : '99+'}
                          </span>
                          <span className="text-sm text-muted-foreground">months</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          {fmt(liquidCash)} liquid · {fmtD(effectiveExpenses)}/mo est.
                        </p>
                      </div>

                      {/* Net Worth + 30d delta */}
                      <div className="pt-4 pb-4 md:pt-0 md:pb-0 md:px-4">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Net Worth</p>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-3xl font-black tabular leading-none text-foreground">
                            {netWorth < 0 ? '−' : ''}{fmt(Math.abs(netWorth))}
                          </span>
                          {nwDelta !== null && (
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 shrink-0',
                              nwDelta >= 0 ? 'border-green/30 text-green' : 'border-muted-foreground/30 text-muted-foreground')}>
                              {nwDelta >= 0 ? '+' : ''}{fmt(nwDelta)} 30d
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          {fmt(totalAssets)} assets · {fmt(totalLiabilities)} debts
                        </p>
                      </div>

                      {/* Next Milestone */}
                      <div className="pt-4 md:pt-0 md:pl-4">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Next Milestone</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black tabular leading-none text-foreground">{fmt(nextMsValue)}</span>
                        </div>
                        <Progress value={msProgress} className="h-1 mt-2.5 [&>div]:bg-violet-light" />
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          {msProgress}% · {fmt(Math.max(0, nextMsValue - netWorth))} to go
                        </p>
                      </div>

                    </div>
                  </CardContent>
                </Card>

                {/* Mobile column switcher */}
                <Tabs value={activeCol} onValueChange={v => setActiveCol(v as AccountCol)} className="lg:hidden">
                  <TabsList className="w-full">
                    <TabsTrigger value="wealth" className="flex-1">Liquidity</TabsTrigger>
                    <TabsTrigger value="debt"   className="flex-1">Debt</TabsTrigger>
                    <TabsTrigger value="real"   className="flex-1">Assets</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* 3-column grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8 items-start">

                  {/* ━━━ Column 1 — Liquidity & Flow ━━━ */}
                  <div className={cn('flex flex-col gap-5 min-w-0', activeCol !== 'wealth' && 'hidden lg:flex')}>
                    <CashBufferGauge liquidCash={liquidCash} monthlyExpenses={effectiveExpenses} />
                    <UpcomingPayments creditAccounts={creditAccounts} />
                    <PlaidWidget
                      label="Cash & Savings" icon={<Wallet size={13} />} accentColor="var(--chart-2)"
                      accounts={accounts} types={['depository']}
                      manualAssets={manualAssets} loanAccounts={loanAccounts}
                      editing={editing} startEdit={startEdit} cancelEdit={cancelEdit}
                      saveEdit={saveEdit} onEditField={updateEditField}
                    />
                    <PlaidWidget
                      label="Investments" icon={<LineChartIcon size={13} />} accentColor="var(--chart-4)"
                      accounts={accounts} types={['investment', 'brokerage']}
                      manualAssets={manualAssets} loanAccounts={loanAccounts}
                      editing={editing} startEdit={startEdit} cancelEdit={cancelEdit}
                      saveEdit={saveEdit} onEditField={updateEditField}
                      holdings={holdings} reconnecting={reconnecting} onReconnect={reconnectItem}
                    />
                    <ManualWidget
                      sectionType="stocks_bonds"
                      label="Stocks & Bonds" icon={<LineChartIcon size={13} />} accentColor="var(--chart-4)"
                      manualAssets={manualAssets.filter(a => a.asset_type === 'stocks_bonds')}
                      loanAccounts={loanAccounts}
                      editingAssetId={editingAssetId} editForm={editForm} editSaving={editSaving}
                      confirmDeleteId={confirmDeleteId}
                      addingSection={addingSection} addForm={addForm} addSaving={addSaving}
                      onOpenAdd={openAdd} onAdd={f => setAddForm(p => ({ ...p, ...f }))}
                      onSaveAdd={saveAdd} onCancelAdd={() => setAddingSection(null)}
                      onStartEdit={startEditAsset} onEditChange={f => setEditForm(p => ({ ...p, ...f }))}
                      onSaveEdit={saveEditAsset} onCancelEdit={() => setEditingAssetId(null)}
                      onConfirmDelete={setConfirmDeleteId} onDelete={deleteAsset}
                      onConnectPlaid={connectBrokerageViaPlaid} plaidConnecting={plaidConnecting}
                    />
                  </div>

                  {/* ━━━ Column 2 — Debt & Optimization ━━━ */}
                  <div className={cn('flex flex-col gap-5 min-w-0', activeCol !== 'debt' && 'hidden lg:flex')}>
                    <UtilizationDial totalDebt={totalCreditDebt} totalLimit={totalCreditLimit} monthlyInterest={monthlyInterest} />
                    <PlaidWidget
                      label="Credit Cards" icon={<CreditCard size={13} />} accentColor="var(--chart-3)"
                      accounts={accounts} types={['credit']}
                      manualAssets={manualAssets} loanAccounts={loanAccounts}
                      editing={editing} startEdit={startEdit} cancelEdit={cancelEdit}
                      saveEdit={saveEdit} onEditField={updateEditField}
                    />
                    <PlaidWidget
                      label="Loans & Mortgages" icon={<Landmark size={13} />} accentColor="var(--chart-5)"
                      accounts={accounts} types={['loan', 'mortgage']}
                      manualAssets={manualAssets} loanAccounts={loanAccounts}
                      editing={editing} startEdit={startEdit} cancelEdit={cancelEdit}
                      saveEdit={saveEdit} onEditField={updateEditField}
                    />
                  </div>

                  {/* ━━━ Column 3 — Assets & Strategy ━━━ */}
                  <div className={cn('flex flex-col gap-5 min-w-0', activeCol !== 'real' && 'hidden lg:flex')}>
                    <AllocationDonut slices={allocationSlices} totalAssets={totalAssets} />
                    <FIProjector currentNW={netWorth} userIncome={userIncome} fiTarget={fiTarget} />
                    <ManualWidget
                      sectionType="real_estate"
                      label="Real Estate & Vehicles" icon={<Home size={13} />} accentColor="var(--chart-2)"
                      manualAssets={manualAssets.filter(a => ['real_estate', 'vehicle', 'other'].includes(a.asset_type))}
                      loanAccounts={loanAccounts}
                      editingAssetId={editingAssetId} editForm={editForm} editSaving={editSaving}
                      confirmDeleteId={confirmDeleteId}
                      addingSection={addingSection} addForm={addForm} addSaving={addSaving}
                      onOpenAdd={openAdd} onAdd={f => setAddForm(p => ({ ...p, ...f }))}
                      onSaveAdd={saveAdd} onCancelAdd={() => setAddingSection(null)}
                      onStartEdit={startEditAsset} onEditChange={f => setEditForm(p => ({ ...p, ...f }))}
                      onSaveEdit={saveEditAsset} onCancelEdit={() => setEditingAssetId(null)}
                      onConfirmDelete={setConfirmDeleteId} onDelete={deleteAsset}
                    />
                  </div>

                </div>
              </div>
            )}
          </>
        )}

        {/* ── BUDGET TAB ── */}
        {tab === 'budget' && (
          <div className="max-w-2xl mx-auto mt-6">
            {budgetState === 'loading' && (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="spinner" />
                <p className="text-sm text-muted-foreground">Loading budgets…</p>
              </div>
            )}
            {budgetState === 'error' && (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center">
                  <AlertTriangle size={22} className="text-amber" />
                </div>
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
                        { label: `Spent — ${month.split(' ')[0]}`, value: fmtD(totalSpent), sub: `${overallBudgPct}% used`, color: totalSpent > totalBudgeted ? 'text-red' : 'text-green' },
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
                    <CardTitle className="text-sm font-semibold">
                      {budgets.length === 0 ? 'Set Your First Budget' : 'Add Budget'}
                    </CardTitle>
                    {budgets.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Set monthly spending limits per category. We'll track your actual spending automatically.
                      </p>
                    )}
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
                      <Input type="number" min="1" step="1" placeholder="e.g. 500"
                        value={budgetForm.limit} onChange={e => setBudgetForm(p => ({ ...p, limit: e.target.value }))}
                        className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
                    </div>
                    <Button onClick={addBudget} disabled={budgetSaving || !budgetForm.limit} className="w-full bg-primary hover:bg-primary/90">
                      {budgetSaving ? '…' : 'Add Budget'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ── REWARDS TAB ── */}
        {tab === 'rewards' && (
          <div className="max-w-2xl mx-auto mt-6">
            {rewardsState === 'loading' && (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="spinner" />
                <p className="text-sm text-muted-foreground">Loading reward profiles…</p>
              </div>
            )}
            {rewardsState === 'error' && (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-dim border border-amber/20 flex items-center justify-center">
                  <AlertTriangle size={22} className="text-amber" />
                </div>
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
                          activeCategory === c.id
                            ? 'border-[var(--primary)]/50 bg-violet-dim/30 text-violet-light'
                            : 'border-border bg-card text-muted-foreground hover:text-foreground')}>
                        <span className="text-xl">{c.icon}</span>
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-sm font-semibold shrink-0">Amount</Label>
                  <Input type="number" min="1" step="1" placeholder="$ optional"
                    value={rewardAmount} onChange={e => setRewardAmount(e.target.value)}
                    className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
                </div>
                {rewardResults && (
                  rewardResults.recommendations.length === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-3 text-center">
                      <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center">
                        <CreditCard size={22} className="text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No connected cards matched a reward profile.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rewardResults.recommendations.map(r => (
                        <Card key={r.rank} className={cn('bg-card border-border', r.rank === 1 && 'border-yellow-500/30')}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-base font-bold text-foreground pr-12">{r.accountName}</p>
                              <Badge variant="outline" className={cn('shrink-0 text-xs',
                                r.rank === 1 ? 'border-yellow-500/40 text-yellow-400' :
                                r.rank === 2 ? 'border-slate-400/30 text-slate-400' :
                                r.rank === 3 ? 'border-amber-700/30 text-amber-600' :
                                'border-border text-muted-foreground')}>
                                {rankLabel(r.rank)}
                              </Badge>
                            </div>
                            {r.penalized && (
                              <Badge variant="outline" className="text-[10px] border-amber/30 text-amber mb-2 flex items-center gap-1 w-fit">
                                <AlertTriangle size={10} />Active balance — ranked lower
                              </Badge>
                            )}
                            <p className="text-2xl font-extrabold text-violet-light">
                              {r.effectiveRate}%<span className="text-sm font-normal text-muted-foreground ml-1">effective back</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {r.rewardType === 'cashback' ? `${r.effectiveRate}% cash back` : `${r.multiplier}x ${r.programName} (${r.effectiveRate}% value)`}
                            </p>
                            {r.earnedDollars != null && (
                              <p className={cn('text-sm font-semibold mt-1.5', r.penalized ? 'text-amber' : 'text-green')}>
                                {r.penalized
                                  ? `~$${(r.earnedDollars / 0.5).toFixed(2)} if not carrying a balance`
                                  : `Earn $${r.earnedDollars.toFixed(2)} on this purchase`}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{r.notes}</p>
                          </CardContent>
                        </Card>
                      ))}
                      {rewardResults.unmatchedAccounts.length > 0 && (
                        <p className="text-xs text-muted-foreground text-center">
                          Not in database: {rewardResults.unmatchedAccounts.join(', ')}
                        </p>
                      )}
                    </div>
                  )
                )}
                <p className="text-xs text-muted-foreground text-center pb-2">{updatedNote}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PlaidWidget ──────────────────────────────────────────────────────────────

interface PlaidWidgetProps {
  label: string; icon: React.ReactNode; accentColor: string;
  accounts: Account[]; types: string[];
  manualAssets: ManualAsset[]; loanAccounts: Account[];
  editing: Record<string, EditState>;
  startEdit: (a: Account) => void;
  cancelEdit: (id: string) => void;
  saveEdit: (id: string) => void;
  onEditField: (id: string, field: 'apr' | 'minimum', value: string) => void;
  holdings?: Holding[];
  reconnecting?: string | null;
  onReconnect?: (plaidItemId: string) => void;
}

function PlaidWidget({
  label, icon, accentColor, accounts, types, manualAssets,
  editing, startEdit, cancelEdit, saveEdit, onEditField,
  holdings = [], reconnecting, onReconnect,
}: PlaidWidgetProps) {
  const catAccounts = accounts.filter(a => types.includes(a.type));
  if (catAccounts.length === 0) return null;

  const catTotal         = catAccounts.reduce((s, a) => s + (a.balance_current || 0), 0);
  const isCreditSection  = types.includes('credit');
  const isLoanSection    = types.includes('loan');

  const totalCreditLimit = isCreditSection ? catAccounts.reduce((s, a) => s + (a.credit_limit || 0), 0) : 0;
  const overallUtilPct   = isCreditSection && totalCreditLimit > 0
    ? Math.min(100, Math.round((catTotal / totalCreditLimit) * 100)) : 0;

  const linkedAssets = isLoanSection
    ? manualAssets.filter(a => a.linked_loan_id && catAccounts.find(l => l.id === a.linked_loan_id))
    : [];
  const totalLinkedPropValue = linkedAssets.reduce((s, a) => s + a.current_value, 0);
  const totalLinkedLoanBal   = linkedAssets.reduce((s, a) => {
    const loan = catAccounts.find(l => l.id === a.linked_loan_id);
    return s + (loan?.balance_current || 0);
  }, 0);
  const totalEquity     = totalLinkedPropValue - totalLinkedLoanBal;
  const equitySumPct    = totalLinkedPropValue > 0 ? Math.round((totalEquity / totalLinkedPropValue) * 100) : 0;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{ background: accentColor + '22', color: accentColor }}>
              {icon}
            </div>
            <CardTitle className="text-sm font-semibold text-foreground truncate">{label}</CardTitle>
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground px-1.5 py-0 shrink-0">
              {catAccounts.length}
            </Badge>
          </div>
          <span className="text-sm font-bold tabular text-foreground shrink-0 pl-2">{fmt(catTotal)}</span>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 pt-1">
        {/* Distribution bar for non-liability sections */}
        {!isCreditSection && !isLoanSection && catAccounts.length > 1 && (
          <DistBar items={catAccounts.map((a, i) => ({
            label: a.name.split(' ')[0], value: a.balance_current, color: DIST_PALETTE[i % DIST_PALETTE.length],
          }))} />
        )}

        {/* Credit: overall utilization bar */}
        {isCreditSection && totalCreditLimit > 0 && (
          <div className="mb-5">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
              <span>Overall utilization</span>
              <span className={cn('font-semibold',
                overallUtilPct >= 90 ? 'text-red' : overallUtilPct >= 70 ? 'text-amber' : 'text-foreground')}>
                {overallUtilPct}% of {fmt(totalCreditLimit)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${overallUtilPct}%`,
                background: overallUtilPct >= 90 ? 'var(--red)' : overallUtilPct >= 70 ? 'var(--amber)' : 'var(--chart-2)',
              }} />
            </div>
          </div>
        )}

        {/* Loans: equity summary */}
        {isLoanSection && totalEquity > 0 && (
          <div className="mb-5">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
              <span>Equity in linked properties</span>
              <span className="text-green font-semibold">{fmt(totalEquity)}</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-2">
              <div className="h-full transition-all" style={{ width: `${equitySumPct}%`, background: 'var(--chart-2)' }} />
              <div className="h-full transition-all" style={{ width: `${100 - equitySumPct}%`, background: 'var(--muted-foreground)', opacity: 0.2 }} />
            </div>
            <div className="flex justify-between text-[10px] mt-1.5">
              <span className="text-chart-2 font-medium">Equity {equitySumPct}%</span>
              <span className="text-muted-foreground">LTV {100 - equitySumPct}%</span>
            </div>
          </div>
        )}

        {/* Account rows */}
        <div className="divide-y divide-border">
          {catAccounts.map(acc => {
            const isCredit    = acc.type === 'credit';
            const isAsset     = ['depository', 'investment', 'brokerage'].includes(acc.type);
            const utilPct     = isCredit && acc.credit_limit && acc.credit_limit > 0
              ? Math.min(100, Math.round((acc.balance_current / acc.credit_limit) * 100)) : null;
            const linkedAsset = isLoanSection ? manualAssets.find(a => a.linked_loan_id === acc.id) : undefined;
            const equity      = linkedAsset ? linkedAsset.current_value - acc.balance_current : 0;
            const equityPct   = linkedAsset && linkedAsset.current_value > 0
              ? Math.round((equity / linkedAsset.current_value) * 100) : 0;

            const accentColor = isCredit
              ? (getInstitutionBrandColor(acc.institution_name || acc.name) ?? 'var(--violet-light)')
              : undefined;

            return (
              <div key={acc.id} className={cn('relative py-4 flex items-start gap-3', isCredit && 'pl-3')}>
                {isCredit && (
                  <div className="absolute left-0 inset-y-0 w-[3px]" style={{ background: accentColor }} />
                )}
                <div className="shrink-0 mt-0.5 w-14 flex items-center">
                  {isCredit
                    ? <CreditCardChip cardName={acc.name} institutionName={acc.institution_name} size={32} />
                    : <InstitutionLogo name={acc.institution_name || acc.name} size={32} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{acc.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {acc.institution_name || '—'}
                        {acc.subtype && <span className="ml-1.5 capitalize">{acc.subtype}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular text-foreground">{fmtD(acc.balance_current)}</p>
                      {isAsset && acc.balance_available != null && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtD(acc.balance_available)} avail.</p>
                      )}
                    </div>
                  </div>

                  {linkedAsset && equity > 0 && (
                    <EquityBar equityPct={equityPct} equity={equity} propertyValue={linkedAsset.current_value} />
                  )}
                  {isLoanSection && !linkedAsset && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 italic">
                      Add a property in "Real Estate & Vehicles" and link it here to see equity.
                    </p>
                  )}

                  {/* Investment holdings */}
                  {isAsset && ['investment', 'brokerage'].includes(acc.type) && (() => {
                    const acctHoldings = holdings.filter(h => h.account_id === acc.id);
                    if (acctHoldings.length === 0) {
                      return (
                        <div className="mt-3 p-3 rounded-xl bg-surface-2 border border-border flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-foreground">Connect with Plaid</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Sync your investment positions and holdings.</p>
                          </div>
                          {onReconnect && acc.plaid_item_id && (
                            <Button size="sm" disabled={reconnecting === acc.plaid_item_id}
                              onClick={() => onReconnect(acc.plaid_item_id!)}
                              className="h-7 text-xs bg-primary hover:bg-primary/90 shrink-0 flex items-center gap-1.5">
                              <Link2 size={11} className={reconnecting === acc.plaid_item_id ? 'animate-pulse' : ''} />
                              {reconnecting === acc.plaid_item_id ? 'Connecting…' : 'Connect with Plaid'}
                            </Button>
                          )}
                        </div>
                      );
                    }
                    const top = acctHoldings.slice(0, 8);
                    const rest = acctHoldings.length - top.length;
                    return (
                      <div className="mt-3 space-y-0 divide-y divide-border/60">
                        {top.map(h => {
                          const gain = h.cost_basis != null ? h.institution_value - h.cost_basis : null;
                          const gainPct = gain != null && h.cost_basis ? Math.round((gain / h.cost_basis) * 100) : null;
                          return (
                            <div key={h.id} className="flex items-center justify-between py-2 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold bg-surface-2 text-foreground">
                                  {h.ticker_symbol ? h.ticker_symbol.slice(0, 4) : h.security_type.slice(0, 3).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold text-foreground truncate">{h.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{h.quantity % 1 === 0 ? h.quantity : h.quantity.toFixed(4)} shares</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[11px] font-semibold tabular text-foreground">{fmtD(h.institution_value)}</p>
                                {gain != null && (
                                  <p className={cn('text-[10px] tabular', gain >= 0 ? 'text-green' : 'text-muted-foreground')}>
                                    {gain >= 0 ? '+' : ''}{fmtD(gain)}{gainPct != null && ` (${gain >= 0 ? '+' : ''}${gainPct}%)`}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {rest > 0 && (
                          <p className="text-[10px] text-muted-foreground pt-2">+{rest} more position{rest !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                    );
                  })()}

                  {isCredit && (
                    <>
                      {utilPct !== null && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>{utilPct}% utilized</span>
                            {acc.credit_limit && <span>{fmtD(acc.credit_limit)} limit</span>}
                          </div>
                          <Progress value={utilPct} className={cn('h-1',
                            utilPct >= 90 ? '[&>div]:bg-red' : utilPct >= 70 ? '[&>div]:bg-amber' : '[&>div]:bg-chart-2')} />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {acc.apr != null
                          ? <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md',
                              acc.apr >= 20 ? 'bg-amber-dim text-amber' : 'bg-surface-2 text-muted-foreground')}>
                              {acc.apr}% APR
                            </span>
                          : <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-dim text-amber">APR missing</span>
                        }
                        {acc.minimum_payment != null && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-2 text-muted-foreground">
                            {fmtD(acc.minimum_payment)} min
                          </span>
                        )}
                        {acc.payment_due_date && (() => {
                          const d = new Date(acc.payment_due_date + 'T12:00');
                          const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
                          return (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium',
                              daysLeft <= 7 ? 'bg-red-dim text-red' : 'bg-surface-2 text-muted-foreground')}>
                              Due {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{daysLeft <= 7 && ` · ${daysLeft}d`}
                            </span>
                          );
                        })()}
                      </div>
                      {editing[acc.id] ? (
                        <div className="mt-3 p-3 rounded-xl bg-surface-2 border border-border space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">APR %</Label>
                              <Input type="number" step="0.01" placeholder="e.g. 24.99"
                                value={editing[acc.id].apr}
                                onChange={e => onEditField(acc.id, 'apr', e.target.value)}
                                className="h-7 text-sm bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Min Payment $</Label>
                              <Input type="number" step="0.01" placeholder="e.g. 35.00"
                                value={editing[acc.id].minimum}
                                onChange={e => onEditField(acc.id, 'minimum', e.target.value)}
                                className="h-7 text-sm bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEdit(acc.id)} disabled={editing[acc.id].saving}
                              className="h-7 text-xs bg-primary hover:bg-primary/90">
                              {editing[acc.id].saving ? '…' : 'Save'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => cancelEdit(acc.id)}
                              className="h-7 text-xs border-border text-muted-foreground">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(acc)}
                          className="mt-2 text-[10px] text-muted-foreground hover:text-violet-light transition-colors font-medium">
                          Edit APR / Min →
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── ManualWidget ─────────────────────────────────────────────────────────────

interface ManualWidgetProps {
  sectionType: ManualAsset['asset_type'];
  label: string; icon: React.ReactNode; accentColor: string;
  manualAssets: ManualAsset[]; loanAccounts: Account[];
  editingAssetId: string | null;
  editForm: ManualAssetForm; editSaving: boolean;
  confirmDeleteId: string | null;
  addingSection: ManualAsset['asset_type'] | null;
  addForm: ManualAssetForm; addSaving: boolean;
  onOpenAdd: (t: ManualAsset['asset_type']) => void;
  onAdd: (p: Partial<ManualAssetForm>) => void;
  onSaveAdd: () => void; onCancelAdd: () => void;
  onStartEdit: (a: ManualAsset) => void;
  onEditChange: (p: Partial<ManualAssetForm>) => void;
  onSaveEdit: () => void; onCancelEdit: () => void;
  onConfirmDelete: (id: string | null) => void;
  onDelete: (id: string) => void;
  onConnectPlaid?: () => void;
  plaidConnecting?: boolean;
}

function ManualWidget({
  sectionType, label, icon, accentColor,
  manualAssets, loanAccounts,
  editingAssetId, editForm, editSaving, confirmDeleteId,
  addingSection, addForm, addSaving,
  onOpenAdd, onAdd, onSaveAdd, onCancelAdd,
  onStartEdit, onEditChange, onSaveEdit, onCancelEdit,
  onConfirmDelete, onDelete,
  onConnectPlaid, plaidConnecting = false,
}: ManualWidgetProps) {
  const sectionTotal = manualAssets.reduce((s, a) => s + a.current_value, 0);
  const isAddingHere = addingSection === sectionType
    || (sectionType === 'real_estate' && (addingSection === 'vehicle' || addingSection === 'other'));
  const subtypeLabel = (a: ManualAsset) =>
    ASSET_SUBTYPES[a.asset_type]?.find(s => s.value === a.asset_subtype)?.label ?? a.asset_subtype ?? a.asset_type;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{ background: accentColor + '22', color: accentColor }}>
              {icon}
            </div>
            <CardTitle className="text-sm font-semibold text-foreground truncate">{label}</CardTitle>
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground px-1.5 py-0 shrink-0">
              {manualAssets.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0 pl-2">
            {sectionTotal > 0 && (
              <span className="text-sm font-bold tabular text-foreground">{fmt(sectionTotal)}</span>
            )}
            {sectionType === 'stocks_bonds' && onConnectPlaid && (
              <button onClick={onConnectPlaid} disabled={plaidConnecting}
                title="Connect via Plaid"
                className="h-6 px-2 rounded-md flex items-center gap-1 border border-dashed border-border text-muted-foreground hover:text-violet-light hover:border-violet-light transition-colors text-[10px] font-medium disabled:opacity-50">
                <Link2 size={10} className={plaidConnecting ? 'animate-pulse' : ''} />
                {plaidConnecting ? 'Connecting…' : 'Link'}
              </button>
            )}
            <button onClick={() => onOpenAdd(sectionType)}
              className="w-6 h-6 rounded-md flex items-center justify-center border border-dashed border-border text-muted-foreground hover:text-violet-light hover:border-violet-light transition-colors">
              <Plus size={11} />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 pt-1">
        {sectionType === 'stocks_bonds' && manualAssets.length > 1 && (
          <DistBar items={manualAssets.map((a, i) => ({
            label: a.name.split(' ')[0], value: a.current_value, color: DIST_PALETTE[i % DIST_PALETTE.length],
          }))} />
        )}

        {manualAssets.length === 0 && !isAddingHere && (
          sectionType === 'stocks_bonds' && onConnectPlaid ? (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-2 border border-border">
                <LineChartIcon size={18} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No holdings yet</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Connect a brokerage or add holdings manually.</p>
              </div>
              <div className="flex gap-2 mt-1">
                <Button size="sm" onClick={onConnectPlaid} disabled={plaidConnecting}
                  className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 text-xs">
                  <Link2 size={11} className={plaidConnecting ? 'animate-pulse' : ''} />
                  {plaidConnecting ? 'Connecting…' : 'Connect via Plaid'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onOpenAdd(sectionType)}
                  className="h-8 border-border text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs">
                  <Plus size={11} />Add Manually
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 gap-2 text-center">
              <p className="text-sm text-muted-foreground">No {label.toLowerCase()} added yet.</p>
              <button onClick={() => onOpenAdd(sectionType)}
                className="text-xs text-violet-light font-semibold hover:opacity-80 transition-opacity flex items-center gap-1">
                <Plus size={11} />Add {sectionType === 'stocks_bonds' ? 'a holding' : 'an asset'}
              </button>
            </div>
          )
        )}

        <div className="divide-y divide-border">
          {manualAssets.map(asset => {
            const linkedLoan = loanAccounts.find(l => l.id === asset.linked_loan_id);
            const equity     = linkedLoan ? asset.current_value - linkedLoan.balance_current : 0;
            const equityPct  = linkedLoan && asset.current_value > 0
              ? Math.round((equity / asset.current_value) * 100) : 0;
            const isEditing  = editingAssetId === asset.id;

            return (
              <div key={asset.id} className="py-4">
                {isEditing ? (
                  <AssetForm
                    form={editForm} loanAccounts={loanAccounts}
                    onChange={onEditChange} onSave={onSaveEdit} onCancel={onCancelEdit}
                    saving={editSaving} submitLabel="Save Changes"
                  />
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: accentColor + '18', color: accentColor }}>
                      {asset.asset_type === 'real_estate'
                        ? <Home size={13} />
                        : asset.asset_type === 'vehicle'
                        ? <Car size={13} />
                        : <LineChartIcon size={13} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{asset.name}</p>
                          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground mt-0.5">
                            {subtypeLabel(asset)}
                          </Badge>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold tabular text-foreground">{fmt(asset.current_value)}</p>
                          {linkedLoan && equity > 0 && (
                            <p className="text-[10px] text-green mt-0.5">{fmt(equity)} equity</p>
                          )}
                        </div>
                      </div>
                      {linkedLoan && equity > 0 && (
                        <EquityBar equityPct={equityPct} equity={equity} propertyValue={asset.current_value} />
                      )}
                      {linkedLoan && (
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          Linked: {linkedLoan.name} · {fmtD(linkedLoan.balance_current)} remaining
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => onStartEdit(asset)}
                          className="text-[10px] text-muted-foreground hover:text-violet-light transition-colors font-medium">
                          Edit →
                        </button>
                        {confirmDeleteId === asset.id ? (
                          <span className="flex items-center gap-1.5 text-[10px]">
                            <span className="text-muted-foreground">Remove?</span>
                            <button onClick={() => onDelete(asset.id)} className="text-red font-semibold hover:opacity-80">Yes</button>
                            <button onClick={() => onConfirmDelete(null)} className="text-muted-foreground font-semibold hover:opacity-80">No</button>
                          </span>
                        ) : (
                          <button onClick={() => onConfirmDelete(asset.id)}
                            className="text-[10px] text-muted-foreground hover:text-red transition-colors">
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isAddingHere && (
          <div className={cn(manualAssets.length > 0 && 'border-t border-border pt-4 mt-2')}>
            <AssetForm
              form={addForm} loanAccounts={loanAccounts}
              onChange={onAdd} onSave={onSaveAdd} onCancel={onCancelAdd}
              saving={addSaving} submitLabel="Add Asset"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
