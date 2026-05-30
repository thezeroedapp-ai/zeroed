import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageLayout } from '@/components/ui/page-layout';
import { WidgetGrid } from '@/components/ui/widget-grid';
import { Widget, WidgetHeader } from '@/components/ui/widget';
import { SlimProgress } from '@/components/ui/slim-progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle as AlertDialogTitlePrimitive,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertTriangle, Archive, Bell, Car, ChevronLeft, CreditCard, Home, Landmark, Link2,
  LineChart as LineChartIcon, Loader2, MoreVertical, Plus, Trash2, TrendingUp, Wallet, X,
} from 'lucide-react';
import {
  AreaChart, Area, Treemap, ReferenceLine,
  BarChart, Bar, Cell, PieChart, Pie,
  XAxis, YAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { apiFetch, fmt, fmtD } from '../lib/api';
import SubNav from '../components/SubNav';
import InstitutionLogo from '@/components/ui/institution-logo';
import CreditCardChip from '@/components/ui/credit-card-chip';
import { getInstitutionBrandColor } from '@/lib/institution-logos';
import { fetchRealEstateAVM } from '@/services/api/valuationService';

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountTab = 'accounts' | 'budget' | 'rewards';
type AccountCol = 'wealth' | 'debt' | 'real';

interface Account {
  id: string; name: string; type: string; subtype?: string;
  balance_current: number; balance_available: number | null;
  apr: number | null; minimum_payment: number | null; credit_limit: number | null;
  payment_due_date: string | null; institution_name: string;
  plaid_item_id?: string;
  property_address?: string | null;
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
  address?: string | null;
}
interface ManualAssetForm {
  name: string; asset_type: ManualAsset['asset_type'];
  asset_subtype: string; current_value: string; linked_loan_id: string;
  address: string;
}

const BLANK_FORM: ManualAssetForm = {
  name: '', asset_type: 'stocks_bonds', asset_subtype: 'stock', current_value: '', linked_loan_id: '', address: '',
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

const _LOWER = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by']);
function fmtCategory(cat: string): string {
  return cat.replace(/_/g, ' ').toLowerCase()
    .split(' ')
    .map((w, i) => i === 0 || !_LOWER.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
}

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
  const [isFetchingValuation, setIsFetchingValuation] = useState(false);
  const [avmError,            setAvmError]            = useState<string | null>(null);
  const [suggestions,         setSuggestions]         = useState<string[]>([]);
  const [showSuggestions,     setShowSuggestions]     = useState(false);
  const [activeIndex,         setActiveIndex]         = useState(-1);

  const addressWrapRef = useRef<HTMLDivElement>(null);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (addressWrapRef.current && !addressWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function handleAddressChange(value: string) {
    onChange({ address: value });
    setAvmError(null);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await apiFetch(`/api/valuations/address-autocomplete?q=${encodeURIComponent(value)}`);
        if (r.ok) {
          const data = await r.json();
          const list = data.suggestions ?? [];
          setSuggestions(list);
          setShowSuggestions(list.length > 0);
        }
      } catch { /* silent — user can type manually */ }
    }, 300);
  }

  function handleSelectSuggestion(address: string) {
    onChange({ address });
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    setAvmError(null);
  }

  function handleAddressKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && !isFetchingValuation && form.address.trim()) handleFetchAVM();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) handleSelectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  }

  async function handleFetchAVM() {
    const address = form.address.trim();
    if (!address) return;
    setIsFetchingValuation(true);
    setAvmError(null);
    try {
      const avm = await fetchRealEstateAVM(address);
      onChange({ current_value: String(avm.estimatedValue) });
    } catch {
      setAvmError('Could not fetch estimate. Please enter manually.');
    } finally {
      setIsFetchingValuation(false);
    }
  }

  const subtypes    = ASSET_SUBTYPES[form.asset_type];
  const showLoanLink = form.asset_type === 'real_estate' || form.asset_type === 'vehicle';

  return (
    <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Type</Label>
          <Select value={form.asset_type}
            onValueChange={v => onChange({ asset_type: v as ManualAsset['asset_type'], asset_subtype: ASSET_SUBTYPES[v as ManualAsset['asset_type']][0].value, address: '' })}>
            <SelectTrigger className="h-8 text-sm bg-input border-border text-foreground"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="stocks_bonds">Stocks &amp; Bonds</SelectItem>
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

      {form.asset_type === 'real_estate' && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Property Address</Label>
          <div className="flex gap-2">
            <div ref={addressWrapRef} className="relative flex-1">
              <Input
                placeholder="e.g. 123 Main St, Austin, TX 78701"
                value={form.address}
                onChange={e => handleAddressChange(e.target.value)}
                onKeyDown={handleAddressKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="h-8 text-sm bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); handleSelectSuggestion(s); }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs text-foreground hover:bg-surface-2 transition-colors',
                        activeIndex === i && 'bg-surface-2',
                      )}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={handleFetchAVM}
              disabled={isFetchingValuation || !form.address.trim()}
              className="h-8 shrink-0 text-xs border-violet-light/30 text-violet-light hover:opacity-80 hover:bg-transparent transition-opacity">
              {isFetchingValuation ? '…' : 'Get Estimate'}
            </Button>
          </div>
          {avmError && (
            <p className="text-[10px] text-muted-foreground">{avmError}</p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Current Value ($)</Label>
        <Input type="number" min="0" step="1000"
          placeholder={form.asset_type === 'real_estate' ? 'Auto-filled or enter manually' : 'e.g. 600000'}
          value={form.current_value} onChange={e => onChange({ current_value: e.target.value })}
          className="h-8 text-sm bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
      </div>

      {showLoanLink && loanAccounts.length > 0 && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Link to Loan (optional)</Label>
          <Select
            value={form.linked_loan_id || 'none'}
            onValueChange={v => {
              const updates: Partial<ManualAssetForm> = { linked_loan_id: v === 'none' ? '' : v };
              if (form.asset_type === 'real_estate' && v !== 'none') {
                const loan = loanAccounts.find(a => a.id === v);
                if (loan?.property_address) updates.address = loan.property_address;
              }
              onChange(updates);
            }}>
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

const NW_FI_CONFIG: ChartConfig = {
  actual:    { label: 'Actual',    color: 'var(--green)'        },
  projected: { label: 'Projected', color: 'var(--violet-light)' },
};

interface NetWorthFIChartProps {
  history: NWSnapshot[];
  currentNetWorth: number;
  targetFI: number;
  actualMonthlySavings: number;
  blendedAnnualReturn: number;
}

function NetWorthFIChart({ history, currentNetWorth, targetFI, actualMonthlySavings, blendedAnnualReturn }: NetWorthFIChartProps) {
  const { chartData, fiLabel, fiProgress } = useMemo(() => {
    const proj = projectFIPath(currentNetWorth, actualMonthlySavings, blendedAnnualReturn, 30);

    const hist: { label: string; actual: number | undefined; projected: number | undefined }[] =
      history.map(h => ({ label: h.month, actual: h.net_worth, projected: undefined }));

    // Always pin today's live net worth as the terminal actual point.
    // Historical snapshots may be stale (e.g. recorded before manual assets were included),
    // so we upsert rather than rely on the last recorded value.
    const todayMonth = new Date().toISOString().slice(0, 7);
    if (hist.length > 0 && hist[hist.length - 1].label === todayMonth) {
      hist[hist.length - 1].actual = currentNetWorth;
    } else {
      hist.push({ label: todayMonth, actual: currentNetWorth, projected: undefined });
    }

    // Bridge from the live net worth into the projection line
    if (hist.length > 0) hist[hist.length - 1].projected = currentNetWorth;

    const projPoints = proj.slice(1).map(p => ({
      label: String(p.year),
      actual: undefined as number | undefined,
      projected: p.netWorth,
    }));

    const fiYear     = proj.find(d => d.netWorth >= targetFI);
    const fiLabel    = fiYear ? String(fiYear.year) : '30y+';
    const fiProgress = targetFI > 0
      ? Math.min(100, Math.round((Math.max(0, currentNetWorth) / targetFI) * 100)) : 0;

    return { chartData: [...hist, ...projPoints], fiLabel, fiProgress };
  }, [history, currentNetWorth, actualMonthlySavings, blendedAnnualReturn, targetFI]);

  return (
    <Widget>
      <WidgetHeader
        title="Net Worth & FI"
        icon={<TrendingUp size={13} />}
        action={
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums text-foreground leading-tight">
              {currentNetWorth < 0 ? '−' : ''}{fmt(Math.abs(currentNetWorth))}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              FI {fiProgress}% · {fiLabel}
            </p>
          </div>
        }
      />
      <div className="h-[160px] w-full">
        <ChartContainer config={NW_FI_CONFIG} className="h-full w-full">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 16, left: 0 }}>
            <defs>
              <linearGradient id="nwActualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--green)"        stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--green)"        stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="nwProjGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--violet-light)" stopOpacity={0.3}  />
                <stop offset="100%" stopColor="var(--violet-light)" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
              interval="preserveStartEnd"
              tickFormatter={(v: string) => {
                if (v && v.includes('-')) {
                  const [yr, mo] = v.split('-');
                  return new Date(Number(yr), Number(mo) - 1, 1)
                    .toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                }
                return v;
              }}
            />
            <YAxis hide domain={['auto', 'auto']} />
            {targetFI > 0 && (
              <ReferenceLine y={targetFI} stroke="var(--violet-light)"
                strokeDasharray="4 3" strokeOpacity={0.5} />
            )}
            <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => [fmt(Number(v)), n as string]} />} />
            <Area type="monotone" dataKey="actual"    stroke="var(--green)"        strokeWidth={2}
              fill="url(#nwActualGrad)" dot={false} connectNulls={false} />
            <Area type="monotone" dataKey="projected" stroke="var(--violet-light)" strokeWidth={2}
              strokeDasharray="5 3" fill="url(#nwProjGrad)" dot={false} connectNulls={false} />
          </AreaChart>
        </ChartContainer>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center pt-1">
        {[
          { label: 'FI Target',  value: fmt(targetFI)                                          },
          { label: 'FI Year',    value: fiLabel                                                 },
          { label: 'Saving/mo',  value: actualMonthlySavings > 0 ? fmt(actualMonthlySavings) : '—' },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="text-xs font-bold tabular text-foreground mt-0.5">{value}</p>
          </div>
        ))}
      </div>
    </Widget>
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
    <Widget>
      <WidgetHeader title="Upcoming Payments" icon={<Bell size={13} />} badge={items.length} />
      <div className="flex flex-col gap-2.5">
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
      </div>
    </Widget>
  );
}


const ALLOC_CONFIG: ChartConfig = {
  Cash:          { label: 'Cash',        color: 'var(--green)'        },
  Investments:   { label: 'Investments', color: 'var(--blue)'         },
  'Real Estate': { label: 'Real Estate', color: 'var(--amber)'        },
  Vehicles:      { label: 'Vehicles',    color: 'var(--violet-light)' },
  Other:         { label: 'Other',       color: 'var(--chart-3)'      },
};

function AllocationDonut({ slices, totalAssets }: { slices: AllocSlice[]; totalAssets: number }) {
  if (slices.length === 0 || totalAssets <= 0) return null;
  const sorted   = [...slices].sort((a, b) => b.value - a.value);
  const treeData = sorted.map(s => ({ name: s.name, value: s.value, color: s.color }));
  return (
    <Widget>
      <WidgetHeader
        title="Asset Allocation"
        icon={<TrendingUp size={13} />}
        action={
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums text-foreground leading-tight">{fmt(totalAssets)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{slices.length} categories</p>
          </div>
        }
      />
      <div className="h-[160px] w-full">
        <ChartContainer config={ALLOC_CONFIG} className="h-full w-full">
          <Treemap
            data={treeData}
            dataKey="value"
            content={(props: Record<string, unknown>) => {
              const x      = Number(props.x      ?? 0);
              const y      = Number(props.y      ?? 0);
              const width  = Number(props.width  ?? 0);
              const height = Number(props.height ?? 0);
              const name   = String(props.name   ?? '');
              const color  = String(props.color  ?? 'var(--chart-2)');
              const value  = Number(props.value  ?? 0);
              const pct    = totalAssets > 0 ? Math.round((value / totalAssets) * 100) : 0;
              if (width < 10 || height < 10) return <g />;

              const cx = x + width / 2;
              const cy = y + height / 2;
              // Narrow-tall tile: rotate text so it reads vertically
              // Rotate when the tile is taller than it is wide (e.g. a slim column slice)
              const isNarrowTall = height > width * 1.25 && width < 85;
              const showLabel    = width > 28 && height > 22;

              return (
                <g>
                  <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2}
                    rx={8} fill={color} fillOpacity={0.92} />
                  {showLabel && isNarrowTall ? (
                    // Full name rotated −90° so it reads bottom-to-top in the slim tile
                    <text
                      x={cx} y={cy}
                      textAnchor="middle" dominantBaseline="central"
                      fill="white" fontSize={9} fontWeight={700}
                      transform={`rotate(-90, ${cx}, ${cy})`}
                    >
                      {name} · {pct}%
                    </text>
                  ) : showLabel ? (
                    <>
                      {height > 36 && (
                        <text x={cx} y={cy - 8}
                          textAnchor="middle" dominantBaseline="central"
                          fill="white" fontSize={10} fontWeight={700}
                        >{name}</text>
                      )}
                      <text x={cx} y={height > 36 ? cy + 8 : cy}
                        textAnchor="middle" dominantBaseline="central"
                        fill="white" fontSize={height > 36 ? 9 : 10} fontWeight={height > 36 ? 500 : 700}
                        opacity={height > 36 ? 0.85 : 1}
                      >{pct}%</text>
                    </>
                  ) : null}
                </g>
              );
            }}
          />
        </ChartContainer>
      </div>
      {/* Legend strip */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
        {sorted.map(s => (
          <div key={s.name} className="flex items-center gap-1.5 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {s.name}{' '}
              <span className="font-semibold text-foreground">
                {Math.round((s.value / totalAssets) * 100)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </Widget>
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
  const [addForm, setAddForm]                 = useState<ManualAssetForm>(BLANK_FORM);
  const [addSaving, setAddSaving]             = useState(false);
  const [editingAssetId, setEditingAssetId]   = useState<string | null>(null);
  const [editForm, setEditForm]               = useState<ManualAssetForm>(BLANK_FORM);
  const [editSaving, setEditSaving]           = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Global Add Account modal
  const [addModalStep, setAddModalStep] = useState<'selection' | 'manual_form'>('selection');

  // Budget
  const [confirmBudgetId, setConfirmBudgetId] = useState<string | null>(null);
  const [budgetState, setBudgetState]   = useState<'idle' | 'loading' | 'error' | 'content'>('idle');
  const [budgets, setBudgets]           = useState<Budget[]>([]);
  const [budgetError, setBudgetError]   = useState('');
  const [budgetForm, setBudgetForm]     = useState({ category: 'Food and Drink', limit: '' });
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editBudget, setEditBudget]             = useState<Budget | null>(null);
  const [budgetDialogLimit, setBudgetDialogLimit] = useState('');

  // Rewards
  const [rewardsState, setRewardsState]     = useState<'idle' | 'loading' | 'error' | 'content'>('idle');
  const [categories, setCategories]         = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [rewardAmount, setRewardAmount]     = useState('');
  const [rewardResults, setRewardResults]   = useState<RewardResult | null>(null);
  const [updatedNote, setUpdatedNote]       = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addAccountOpen, setAddAccountOpen] = useState(false);

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

  function openAddModal(type?: ManualAsset['asset_type']) {
    const t = type ?? 'stocks_bonds';
    setAddForm({ ...BLANK_FORM, asset_type: t, asset_subtype: ASSET_SUBTYPES[t][0].value });
    setAddModalStep('manual_form');
    setAddAccountOpen(true);
  }
  function openSelectionModal() {
    setAddModalStep('selection');
    setAddAccountOpen(true);
  }
  function closeAddModal() {
    setAddAccountOpen(false);
    setAddModalStep('selection');
  }
  async function saveAdd() {
    const val = parseFloat(addForm.current_value);
    if (!addForm.name || isNaN(val)) return;
    setAddSaving(true);
    try {
      await apiFetch('/api/manual-assets', {
        method: 'POST',
        body: JSON.stringify({
          name:           addForm.name,
          asset_type:     addForm.asset_type,
          asset_subtype:  addForm.asset_subtype,
          current_value:  val,
          linked_loan_id: addForm.linked_loan_id || null,
          address:        addForm.asset_type === 'real_estate' ? (addForm.address.trim() || null) : null,
        }),
      });
      closeAddModal(); loadAll();
    } finally { setAddSaving(false); }
  }
  function startEditAsset(a: ManualAsset) {
    setEditingAssetId(a.id);
    setEditForm({ name: a.name, asset_type: a.asset_type, asset_subtype: a.asset_subtype || '', current_value: String(a.current_value), linked_loan_id: a.linked_loan_id || '', address: a.address || '' });
  }
  async function saveEditAsset() {
    if (!editingAssetId) return;
    const val = parseFloat(editForm.current_value);
    if (!editForm.name || isNaN(val)) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/manual-assets/${editingAssetId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name:           editForm.name,
          asset_type:     editForm.asset_type,
          asset_subtype:  editForm.asset_subtype,
          current_value:  val,
          linked_loan_id: editForm.linked_loan_id || null,
          address:        editForm.asset_type === 'real_estate' ? (editForm.address.trim() || null) : null,
        }),
      });
      setEditingAssetId(null); loadAll();
    } finally { setEditSaving(false); }
  }
  async function deleteAsset(id: string) {
    await apiFetch(`/api/manual-assets/${id}`, { method: 'DELETE' });
    setConfirmDeleteId(null); loadAll();
  }

  async function handleArchivePlaidAccount(accountId: string) {
    await apiFetch(`/api/plaid/accounts/${accountId}/archive`, { method: 'PUT' });
    loadAll();
  }

  async function handleRemovePlaidAccount(accountId: string) {
    await apiFetch(`/api/plaid/accounts/${accountId}`, { method: 'DELETE' });
    loadAll();
  }

  // Derived totals
  const plaidAssets      = accounts.filter(a => ['depository', 'investment', 'brokerage'].includes(a.type)).reduce((s, a) => s + (a.balance_current || 0), 0);
  const manualTotal      = manualAssets.reduce((s, a) => s + (a.current_value || 0), 0);
  const totalAssets      = plaidAssets + manualTotal;
  const totalLiabilities = accounts.filter(a => ['credit', 'loan', 'mortgage'].includes(a.type)).reduce((s, a) => s + (a.balance_current || 0), 0);
  const netWorth         = totalAssets - totalLiabilities;
  const loanAccounts     = accounts.filter(a => ['loan', 'mortgage'].includes(a.type));
  const creditAccounts   = accounts.filter(a => a.type === 'credit');
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
      { name: 'Cash',        value: liquidCash,    color: 'var(--green)'        },
      { name: 'Investments', value: invVal + sbVal, color: 'var(--blue)'         },
      { name: 'Real Estate', value: reVal,          color: 'var(--amber)'        },
      { name: 'Vehicles',    value: vehVal,         color: 'var(--violet-light)' },
      { name: 'Other',       value: othVal,         color: 'var(--chart-3)'      },
    ].filter(s => s.value > 0);
  }, [liquidCash, accounts, manualAssets]);

  const fiTarget = useMemo(() => {
    const annualExp = userExpenses > 0 ? userExpenses * 12 : effectiveExpenses * 12;
    return annualExp > 0 ? Math.round((annualExp * 25) / 1000) * 1000 : 1_000_000;
  }, [userExpenses, effectiveExpenses]);

  const blendedAnnualReturn = useMemo(() => {
    const RATES: Record<string, number> = {
      Cash:          0.035,
      Investments:   0.07,
      'Real Estate': 0.05,
      Vehicles:      -0.02,
      Other:         0.03,
    };
    const total = allocationSlices.reduce((s, sl) => s + sl.value, 0);
    if (total <= 0) return 0.065;
    return allocationSlices.reduce(
      (rate, sl) => rate + (sl.value / total) * (RATES[sl.name] ?? 0.04),
      0,
    );
  }, [allocationSlices]);

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
      setBudgetForm({ category: 'Food and Drink', limit: '' });
      setBudgetDialogOpen(false);
      loadBudgets();
    } finally { setBudgetSaving(false); }
  }
  async function saveBudgetEdit() {
    if (!editBudget || !budgetDialogLimit) return;
    setBudgetSaving(true);
    try {
      await apiFetch(`/api/budgets/${editBudget.id}`, { method: 'PUT', body: JSON.stringify({ monthly_limit: parseFloat(budgetDialogLimit) }) });
      setEditBudget(null);
      setBudgetDialogOpen(false);
      loadBudgets();
    } finally { setBudgetSaving(false); }
  }
  function openAddBudgetDialog() {
    setEditBudget(null);
    setBudgetDialogLimit('');
    setBudgetDialogOpen(true);
  }
  function openEditBudgetDialog(b: Budget) {
    setEditBudget(b);
    setBudgetDialogLimit(String(b.monthly_limit));
    setBudgetDialogOpen(true);
  }
  function closeBudgetDialog() {
    setBudgetDialogOpen(false);
    setEditBudget(null);
    setBudgetDialogLimit('');
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
    <div className="flex flex-col min-h-dvh text-foreground w-full">

      {/* Composite sticky header */}
      <div className="sticky top-0 z-20 w-full bg-background/60 backdrop-blur-2xl border-b border-white/10">
        <div className="w-full max-w-[2560px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16">
          <div className="flex items-center justify-between gap-4 pt-5 pb-2">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Assets, liabilities, budgets &amp; rewards</p>
            </div>
            <Button
              onClick={openSelectionModal}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 text-sm font-semibold rounded-md shrink-0 flex items-center gap-1.5">
              <Plus size={14} />Add Account
            </Button>
          </div>
          <SubNav tabs={ACCOUNT_TABS} active={tab} onChange={t => setTab(t as AccountTab)}
            className="mb-0 border-b-0 mx-0 px-0 py-2" />
        </div>
      </div>

      <PageLayout className="pt-4 pb-20 md:pb-10">

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
                <Widget>
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
                </Widget>

                {/* Mobile column switcher */}
                <Tabs value={activeCol} onValueChange={v => setActiveCol(v as AccountCol)} className="lg:hidden">
                  <TabsList className="w-full">
                    <TabsTrigger value="wealth" className="flex-1">Liquidity</TabsTrigger>
                    <TabsTrigger value="debt"   className="flex-1">Debt</TabsTrigger>
                    <TabsTrigger value="real"   className="flex-1">Assets</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* 3-column grid */}
                <WidgetGrid>

                  {/* ━━━ Column 1 — Liquidity & Flow ━━━ */}
                  <div className={cn('flex flex-col gap-5 w-full min-w-0', activeCol !== 'wealth' && 'hidden lg:flex')}>
                    <UpcomingPayments creditAccounts={creditAccounts} />
                    <PlaidWidget
                      label="Cash & Savings" icon={<Wallet size={13} />} accentColor="var(--chart-2)"
                      accounts={accounts} types={['depository']}
                      manualAssets={manualAssets} loanAccounts={loanAccounts}
                      editing={editing} startEdit={startEdit} cancelEdit={cancelEdit}
                      saveEdit={saveEdit} onEditField={updateEditField}
                      onAddAccount={openSelectionModal}
                      onArchiveAccount={handleArchivePlaidAccount}
                      onRemoveAccount={handleRemovePlaidAccount}
                    />
                    <PlaidWidget
                      label="Investments" icon={<LineChartIcon size={13} />} accentColor="var(--chart-4)"
                      accounts={accounts} types={['investment', 'brokerage']}
                      manualAssets={manualAssets} loanAccounts={loanAccounts}
                      editing={editing} startEdit={startEdit} cancelEdit={cancelEdit}
                      saveEdit={saveEdit} onEditField={updateEditField}
                      holdings={holdings} reconnecting={reconnecting} onReconnect={reconnectItem}
                      onAddAccount={openSelectionModal}
                      onArchiveAccount={handleArchivePlaidAccount}
                      onRemoveAccount={handleRemovePlaidAccount}
                    />
                    <ManualWidget
                      sectionType="stocks_bonds"
                      label="Stocks & Bonds" icon={<LineChartIcon size={13} />} accentColor="var(--chart-4)"
                      manualAssets={manualAssets.filter(a => a.asset_type === 'stocks_bonds')}
                      loanAccounts={loanAccounts}
                      editingAssetId={editingAssetId} editForm={editForm} editSaving={editSaving}
                      confirmDeleteId={confirmDeleteId}
                      onOpenAdd={openAddModal}
                      onStartEdit={startEditAsset} onEditChange={f => setEditForm(p => ({ ...p, ...f }))}
                      onSaveEdit={saveEditAsset} onCancelEdit={() => setEditingAssetId(null)}
                      onConfirmDelete={setConfirmDeleteId} onDelete={deleteAsset}
                      onAddAccount={openSelectionModal}
                    />
                    <ManualWidget
                      sectionType="real_estate"
                      label="Real Estate & Vehicles" icon={<Home size={13} />} accentColor="var(--chart-2)"
                      manualAssets={manualAssets.filter(a => ['real_estate', 'vehicle', 'other'].includes(a.asset_type))}
                      loanAccounts={loanAccounts}
                      editingAssetId={editingAssetId} editForm={editForm} editSaving={editSaving}
                      confirmDeleteId={confirmDeleteId}
                      onOpenAdd={openAddModal}
                      onStartEdit={startEditAsset} onEditChange={f => setEditForm(p => ({ ...p, ...f }))}
                      onSaveEdit={saveEditAsset} onCancelEdit={() => setEditingAssetId(null)}
                      onConfirmDelete={setConfirmDeleteId} onDelete={deleteAsset}
                      onAddAccount={openSelectionModal}
                    />
                  </div>

                  {/* ━━━ Column 2 — Debt & Optimization ━━━ */}
                  <div className={cn('flex flex-col gap-5 w-full min-w-0', activeCol !== 'debt' && 'hidden lg:flex')}>
                    <PlaidWidget
                      label="Credit Cards" icon={<CreditCard size={13} />} accentColor="var(--chart-3)"
                      accounts={accounts} types={['credit']}
                      manualAssets={manualAssets} loanAccounts={loanAccounts}
                      editing={editing} startEdit={startEdit} cancelEdit={cancelEdit}
                      saveEdit={saveEdit} onEditField={updateEditField}
                      onAddAccount={openSelectionModal}
                      onArchiveAccount={handleArchivePlaidAccount}
                      onRemoveAccount={handleRemovePlaidAccount}
                    />
                    <PlaidWidget
                      label="Loans & Mortgages" icon={<Landmark size={13} />} accentColor="var(--chart-5)"
                      accounts={accounts} types={['loan', 'mortgage']}
                      manualAssets={manualAssets} loanAccounts={loanAccounts}
                      editing={editing} startEdit={startEdit} cancelEdit={cancelEdit}
                      saveEdit={saveEdit} onEditField={updateEditField}
                      onAddAccount={openSelectionModal}
                      onArchiveAccount={handleArchivePlaidAccount}
                      onRemoveAccount={handleRemovePlaidAccount}
                    />
                  </div>

                  {/* ━━━ Column 3 — Assets & Strategy ━━━ */}
                  <div className={cn('flex flex-col gap-5 w-full min-w-0', activeCol !== 'real' && 'hidden lg:flex')}>
                    <AllocationDonut slices={allocationSlices} totalAssets={totalAssets} />
                    <NetWorthFIChart
                      history={nwHistory}
                      currentNetWorth={netWorth}
                      targetFI={fiTarget}
                      actualMonthlySavings={Math.max(0, userIncome - userExpenses)}
                      blendedAnnualReturn={blendedAnnualReturn}
                    />
                  </div>

                </WidgetGrid>
              </div>
            )}
          </>
        )}

        {/* ── BUDGET TAB ── */}
        {tab === 'budget' && (
          <>
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
            {/* Add / Edit budget dialog */}
            <Dialog open={budgetDialogOpen} onOpenChange={open => { if (!open) closeBudgetDialog(); }}>
              <DialogContent className="bg-card border-border text-foreground max-w-sm">
                <DialogHeader>
                  <DialogTitle>
                    {editBudget ? `Edit ${fmtCategory(editBudget.category)}` : 'Add Budget Category'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-1">
                  {!editBudget && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Category</Label>
                      <Select value={budgetForm.category} onValueChange={v => setBudgetForm(p => ({ ...p, category: v }))}>
                        <SelectTrigger className="bg-input border-border text-foreground"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          {PRESET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Monthly Limit ($)</Label>
                    <Input
                      type="number" min="1" step="1" placeholder="e.g. 500"
                      value={editBudget ? budgetDialogLimit : budgetForm.limit}
                      onChange={e => editBudget
                        ? setBudgetDialogLimit(e.target.value)
                        : setBudgetForm(p => ({ ...p, limit: e.target.value }))}
                      className="bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={editBudget ? saveBudgetEdit : addBudget}
                      disabled={budgetSaving || !(editBudget ? budgetDialogLimit : budgetForm.limit)}
                      className="flex-1 bg-primary hover:bg-primary/90">
                      {budgetSaving ? '…' : editBudget ? 'Save Changes' : 'Add Budget'}
                    </Button>
                    <Button variant="outline" onClick={closeBudgetDialog} className="border-border text-muted-foreground">
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {budgetState === 'content' && (() => {
              const spendingSlices = budgets.filter(b => b.spent > 0);
              const barData = [...budgets]
                .sort((a, b) => b.pct - a.pct)
                .map(b => ({
                  name:    fmtCategory(b.category),
                  pct:     b.pct,
                  spent:   b.spent,
                  limit:   b.monthly_limit,
                }));
              const barDomain = Math.max(110, ...barData.map(d => d.pct));
              return (
              <WidgetGrid className="mt-4">

                {/* ━━━ Column 1 — Monthly Pulse + Donut + Add ━━━ */}
                <div className="flex flex-col gap-5">

                  {/* Monthly overview */}
                  <Widget>
                    <WidgetHeader
                      title={month}
                      icon={<Wallet size={13} />}
                      action={
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums text-foreground leading-tight">{fmtD(totalSpent)}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">of {fmtD(totalBudgeted)}</p>
                        </div>
                      }
                    />
                    {totalBudgeted > 0 && (
                      <>
                        <div className="flex h-2 rounded-full overflow-hidden bg-surface-2 mt-1">
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${Math.min(100, overallBudgPct)}%`,
                            background: overallBudgPct >= 100 ? 'var(--red)' : overallBudgPct >= 80 ? 'var(--amber)' : 'var(--green)',
                          }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          {overallBudgPct}% used · {fmtD(Math.max(0, totalBudgeted - totalSpent))} remaining
                        </p>
                      </>
                    )}
                    {budgets.length > 0 && (() => {
                      const onTrack = budgets.filter(b => b.pct < 80).length;
                      const atRisk  = budgets.filter(b => b.pct >= 80 && b.pct < 100).length;
                      const over    = budgets.filter(b => b.pct >= 100).length;
                      return (
                        <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-border mt-2">
                          {([
                            { label: 'On Track', value: onTrack, color: 'text-green'  },
                            { label: 'At Risk',  value: atRisk,  color: 'text-amber'  },
                            { label: 'Over',     value: over,    color: over > 0 ? 'text-red' : 'text-muted-foreground' },
                          ] as const).map(({ label, value, color }) => (
                            <div key={label}>
                              <p className={cn('text-2xl font-black tabular leading-none', color)}>{value}</p>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </Widget>

                  {/* Spending distribution donut */}
                  {spendingSlices.length > 0 && (
                    <Widget>
                      <WidgetHeader
                        title="Where It's Going"
                        icon={<TrendingUp size={13} />}
                        action={
                          <div className="text-right">
                            <p className="text-sm font-bold tabular-nums text-foreground leading-tight">{fmtD(totalSpent)}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">total spent</p>
                          </div>
                        }
                      />
                      <div className="h-[160px]">
                        <ChartContainer config={{}} className="h-full w-full">
                          <PieChart>
                            <Pie
                              data={spendingSlices}
                              dataKey="spent"
                              nameKey="category"
                              innerRadius="52%"
                              outerRadius="82%"
                              paddingAngle={2}
                              startAngle={90}
                              endAngle={-270}
                              stroke="none"
                            >
                              {spendingSlices.map((b, i) => (
                                <Cell key={b.id} fill={DIST_PALETTE[i % DIST_PALETTE.length]} />
                              ))}
                            </Pie>
                            <ChartTooltip
                              content={
                                <ChartTooltipContent
                                  formatter={(v, _n, item) => [
                                    fmtD(Number(v)),
                                    fmtCategory(((item as { payload: { category: string } }).payload).category),
                                  ]}
                                />
                              }
                            />
                          </PieChart>
                        </ChartContainer>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
                        {spendingSlices.map((b, i) => (
                          <div key={b.id} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: DIST_PALETTE[i % DIST_PALETTE.length] }} />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {fmtCategory(b.category)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Widget>
                  )}

                </div>

                {/* ━━━ Column 2 — Budget List ━━━ */}
                <div className="flex flex-col gap-3">
                  <Widget>
                    <WidgetHeader
                      title="Budget Categories"
                      icon={<Wallet size={13} />}
                      action={
                        <Button size="sm" onClick={openAddBudgetDialog}
                          className="h-7 bg-primary hover:bg-primary/90 gap-1 text-xs px-2.5">
                          <Plus size={12} />Add
                        </Button>
                      }
                    />
                    {budgets.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No budgets yet — click "Add" to get started.
                      </p>
                    ) : (
                      <div className="flex flex-col divide-y divide-border -mx-6 lg:-mx-7">
                        {budgets.map(b => (
                          <div key={b.id} className="flex flex-col gap-3 px-6 lg:px-7 py-4 group/row first:pt-1 last:pb-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground">{fmtCategory(b.category)}</span>
                              {confirmBudgetId === b.id ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-muted-foreground">Remove?</span>
                                  <Button variant="outline" size="sm" onClick={() => deleteBudget(b.id)} className="h-7 text-xs border-red/30 text-red hover:bg-red-dim">Yes</Button>
                                  <Button variant="outline" size="sm" onClick={() => setConfirmBudgetId(null)} className="h-7 text-xs border-border text-muted-foreground">No</Button>
                                </div>
                              ) : (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      className="p-0.5 rounded opacity-0 group-hover/row:opacity-60 hover:!opacity-100 transition-opacity focus:opacity-100 focus:outline-none"
                                      aria-label="Budget actions"
                                    >
                                      <MoreVertical size={14} className="text-muted-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => openEditBudgetDialog(b)}>
                                      Edit Limit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onSelect={() => setConfirmBudgetId(b.id)}
                                    >
                                      <Trash2 size={13} />
                                      Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            <SlimProgress
                              value={Math.min(100, b.pct)}
                              label={b.pct >= 100 ? `${fmtD(b.spent)} spent — over budget` : `${fmtD(b.spent)} spent`}
                              sublabel={b.pct < 100 ? `${fmtD(b.remaining)} left of ${fmtD(b.monthly_limit)}` : `of ${fmtD(b.monthly_limit)}`}
                              colorClass={b.pct >= 100 ? 'bg-red' : b.pct >= 80 ? 'bg-amber' : 'bg-green'}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </Widget>
                </div>

                {/* ━━━ Column 3 — Horizontal Bar Chart ━━━ */}
                <div className="flex flex-col gap-5">
                  {barData.length > 0 && (
                    <Widget>
                      <WidgetHeader
                        title="Spent vs. Limit"
                        icon={<TrendingUp size={13} />}
                        action={<span className="text-[10px] text-muted-foreground">% of monthly limit</span>}
                      />
                      <div style={{ height: `${Math.max(200, barData.length * 38)}px` }} className="mt-2">
                        <ChartContainer
                          config={{ pct: { label: '% used' } }}
                          className="h-full w-full"
                        >
                          <BarChart
                            layout="vertical"
                            data={barData}
                            margin={{ top: 0, right: 28, bottom: 0, left: 0 }}
                          >
                            <XAxis type="number" domain={[0, barDomain]} hide />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={108}
                              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <ReferenceLine
                              x={100}
                              stroke="var(--border)"
                              strokeDasharray="4 3"
                              strokeOpacity={0.7}
                            />
                            <ChartTooltip
                              content={
                                <ChartTooltipContent
                                  formatter={(v, _n, item) => {
                                    const d = (item as { payload: { spent: number; limit: number } }).payload;
                                    return [`${fmtD(d.spent)} of ${fmtD(d.limit)}`, `${v}% used`];
                                  }}
                                />
                              }
                            />
                            <Bar
                              dataKey="pct"
                              barSize={12}
                              radius={[0, 4, 4, 0]}
                              background={{ fill: 'var(--surface-2)', radius: 4 } as React.SVGProps<SVGRectElement>}
                            >
                              {barData.map((entry, i) => (
                                <Cell
                                  key={i}
                                  fill={entry.pct >= 100 ? 'var(--red)' : entry.pct >= 80 ? 'var(--amber)' : 'var(--green)'}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ChartContainer>
                      </div>
                    </Widget>
                  )}
                </div>

              </WidgetGrid>
              );
            })()}
          </>
        )}

        {/* ── REWARDS TAB ── */}
        {tab === 'rewards' && (
          <>
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
              <WidgetGrid className="mt-4">

                {/* ━━━ Column 1 — Controls ━━━ */}
                <div className="flex flex-col gap-5">
                  <Widget>
                    <WidgetHeader title="Spend Category" icon={<CreditCard size={13} />} />
                    <div className="grid grid-cols-3 gap-2 -mt-1">
                      {categories.map(c => (
                        <button key={c.id} onClick={() => setActiveCategory(c.id)}
                          className={cn(
                            'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-[10px] font-medium cursor-pointer font-[inherit] transition-all',
                            activeCategory === c.id
                              ? 'border-[var(--primary)]/50 bg-violet-dim/30 text-violet-light'
                              : 'border-border bg-surface-2 text-muted-foreground hover:text-foreground hover:border-border/60',
                          )}>
                          <span className="text-lg leading-none">{c.icon}</span>
                          <span className="leading-tight text-center">{c.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-1 border-t border-border">
                      <Label className="text-xs text-muted-foreground shrink-0">Purchase amount</Label>
                      <Input type="number" min="1" step="1" placeholder="$ optional"
                        value={rewardAmount} onChange={e => setRewardAmount(e.target.value)}
                        className="h-8 text-sm bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50" />
                    </div>
                    {updatedNote && (
                      <p className="text-[10px] text-muted-foreground -mt-2">{updatedNote}</p>
                    )}
                  </Widget>
                </div>

                {/* ━━━ Column 2 — Ranked List ━━━ */}
                <div className="flex flex-col gap-5">
                  <Widget>
                    <WidgetHeader title="Your Cards Ranked" icon={<TrendingUp size={13} />}
                      badge={rewardResults?.recommendations.length ?? 0} />
                    {!rewardResults || rewardResults.recommendations.length === 0 ? (
                      <div className="flex flex-col items-center py-8 gap-2 text-center">
                        <CreditCard size={20} className="text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {rewardResults ? 'No connected cards matched a profile.' : 'Select a category to see rankings.'}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col divide-y divide-border -mx-6 lg:-mx-7">
                        {rewardResults.recommendations.map(r => (
                          <div key={r.rank} className="flex items-center gap-3 px-6 lg:px-7 py-3.5 first:pt-1 last:pb-0">
                            <span className={cn('text-[10px] font-bold w-7 shrink-0 tabular-nums',
                              r.rank === 1 ? 'text-yellow-400' :
                              r.rank === 2 ? 'text-slate-400' :
                              r.rank === 3 ? 'text-amber-600' : 'text-muted-foreground')}>
                              {rankLabel(r.rank)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">{r.accountName}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                {r.rewardType === 'cashback' ? `${r.effectiveRate}% cash back` : `${r.multiplier}x ${r.programName}`}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn('text-sm font-bold tabular-nums', r.penalized ? 'text-amber' : 'text-violet-light')}>
                                {r.effectiveRate}%
                              </p>
                              {r.earnedDollars != null && (
                                <p className="text-[10px] text-muted-foreground">
                                  ${r.earnedDollars.toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {rewardResults?.unmatchedAccounts && rewardResults.unmatchedAccounts.length > 0 && (
                      <p className="text-[10px] text-muted-foreground border-t border-border pt-3 -mb-1">
                        Not in database: {rewardResults.unmatchedAccounts.join(', ')}
                      </p>
                    )}
                  </Widget>
                </div>

                {/* ━━━ Column 3 — Best Pick Detail ━━━ */}
                <div className="flex flex-col gap-5">
                  {rewardResults && rewardResults.recommendations.length > 0 ? (() => {
                    const best = rewardResults.recommendations[0];
                    return (
                      <Widget className="border-yellow-500/20">
                        <WidgetHeader
                          title="Best Pick"
                          icon={<TrendingUp size={13} />}
                          action={
                            <Badge variant="outline" className="border-yellow-500/40 text-yellow-400 text-[10px]">
                              {rankLabel(1)}
                            </Badge>
                          }
                        />
                        <div>
                          <p className="text-base font-bold text-foreground leading-snug">{best.accountName}</p>
                          {best.penalized && (
                            <Badge variant="outline" className="text-[10px] border-amber/30 text-amber mt-1.5 flex items-center gap-1 w-fit">
                              <AlertTriangle size={10} />Carrying a balance — earning reduced
                            </Badge>
                          )}
                        </div>
                        <div className="p-4 rounded-xl bg-surface-2 border border-border">
                          <p className={cn('text-4xl font-black tabular-nums leading-none', best.penalized ? 'text-amber' : 'text-violet-light')}>
                            {best.effectiveRate}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">effective value back</p>
                          {best.earnedDollars != null && (
                            <p className={cn('text-sm font-semibold mt-2', best.penalized ? 'text-amber' : 'text-green')}>
                              {best.penalized
                                ? `~$${(best.earnedDollars / 0.5).toFixed(2)} without a balance`
                                : `Earn $${best.earnedDollars.toFixed(2)} on this purchase`}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">How it works</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {best.rewardType === 'cashback'
                              ? `${best.effectiveRate}% cash back`
                              : `${best.multiplier}x ${best.programName} points (${best.effectiveRate}% value)`}
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-2">{best.notes}</p>
                        </div>
                      </Widget>
                    );
                  })() : (
                    <Widget>
                      <WidgetHeader title="Best Pick" icon={<TrendingUp size={13} />} />
                      <div className="flex flex-col items-center py-8 gap-2 text-center">
                        <CreditCard size={20} className="text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Pick a category to see your best card.</p>
                      </div>
                    </Widget>
                  )}
                </div>

              </WidgetGrid>
            )}
          </>
        )}

      </PageLayout>

      {/* ── Global Add Account Modal ── */}
      <Dialog open={addAccountOpen} onOpenChange={open => { setAddAccountOpen(open); if (!open) setAddModalStep('selection'); }}>
        <DialogContent
          showCloseButton={false}
          className="bg-card border-border shadow-xl p-0 max-w-sm w-full gap-0">

          {/* ── Step 1: Selection ── */}
          {addModalStep === 'selection' && (
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-foreground">Add Account</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose how you'd like to connect or add an account.</p>
                </DialogHeader>
                <button
                  onClick={closeAddModal}
                  className="shrink-0 ml-3 mt-0.5 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
                  <X size={15} />
                </button>
              </div>
              <div className="space-y-2.5">
                <button
                  onClick={() => { closeAddModal(); connectBrokerageViaPlaid(); }}
                  disabled={plaidConnecting}
                  className="w-full p-4 rounded-xl border border-border bg-surface-2 hover:border-violet-light/50 hover:bg-violet-dim/20 transition-all text-left disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 group">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-violet-dim border border-violet-light/20 flex items-center justify-center shrink-0">
                      <Link2 size={17} className="text-violet-light" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground group-hover:text-violet-light transition-colors">
                        Link an Institution
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Securely connect banks, credit cards, or brokerages via Plaid.
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setAddModalStep('manual_form')}
                  className="w-full p-4 rounded-xl border border-border bg-surface-2 hover:border-violet-light/50 hover:bg-violet-dim/20 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 group">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-violet-dim border border-violet-light/20 flex items-center justify-center shrink-0">
                      <Plus size={17} className="text-violet-light" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground group-hover:text-violet-light transition-colors">
                        Add Manual Asset
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Track real estate, vehicles, or unlisted investments.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Manual Asset Form ── */}
          {addModalStep === 'manual_form' && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <button
                  onClick={() => setAddModalStep('selection')}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  <ChevronLeft size={14} />Back
                </button>
                <div className="h-3.5 w-px bg-border mx-0.5" />
                <DialogTitle className="text-base font-bold text-foreground">Add Manual Asset</DialogTitle>
                <button
                  onClick={closeAddModal}
                  className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors shrink-0">
                  <X size={15} />
                </button>
              </div>
              <AssetForm
                form={addForm}
                loanAccounts={loanAccounts}
                onChange={f => setAddForm(p => ({ ...p, ...f }))}
                onSave={saveAdd}
                onCancel={closeAddModal}
                saving={addSaving}
                submitLabel="Add Asset"
              />
            </div>
          )}

        </DialogContent>
      </Dialog>
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
  onAddAccount?: () => void;
  onArchiveAccount?: (accountId: string) => Promise<void>;
  onRemoveAccount?: (accountId: string) => Promise<void>;
}

function PlaidWidget({
  label, icon, accentColor, accounts, types, manualAssets,
  editing, startEdit, cancelEdit, saveEdit, onEditField,
  holdings = [], onAddAccount, onArchiveAccount, onRemoveAccount,
}: PlaidWidgetProps) {
  const [pendingRemoveAcc,  setPendingRemoveAcc]  = useState<Account | null>(null);
  const [removingAction,    setRemovingAction]    = useState<'archive' | 'delete' | null>(null);

  async function handleAccountArchive() {
    if (!pendingRemoveAcc || !onArchiveAccount) return;
    setRemovingAction('archive');
    try { await onArchiveAccount(pendingRemoveAcc.id); setPendingRemoveAcc(null); }
    finally { setRemovingAction(null); }
  }

  async function handleAccountDelete() {
    if (!pendingRemoveAcc || !onRemoveAccount) return;
    setRemovingAction('delete');
    try { await onRemoveAccount(pendingRemoveAcc.id); setPendingRemoveAcc(null); }
    finally { setRemovingAction(null); }
  }
  const catAccounts = accounts.filter(a => types.includes(a.type));
  if (catAccounts.length === 0) {
    return (
      <Widget>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: accentColor + '22', color: accentColor }}>
            {icon}
          </div>
          <span className="text-sm font-semibold text-foreground truncate">{label}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          No {label.toLowerCase()} linked yet.{' '}
          <button onClick={onAddAccount}
            className="text-violet-light hover:opacity-80 font-medium underline underline-offset-2">
            Link an institution
          </button>{' '}or{' '}
          <button onClick={onAddAccount}
            className="text-violet-light hover:opacity-80 font-medium underline underline-offset-2">
            add manually
          </button>.
        </p>
      </Widget>
    );
  }

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
    <Widget>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: accentColor + '22', color: accentColor }}>
            {icon}
          </div>
          <span className="text-sm font-semibold text-foreground truncate">{label}</span>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground px-1.5 py-0 shrink-0">
            {catAccounts.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-2">
          <span className="text-sm font-bold tabular text-foreground">{fmt(catTotal)}</span>
          <button onClick={onAddAccount} title="Link an institution"
            className="h-6 px-2 rounded-md flex items-center gap-1 border border-dashed border-violet-light/40 text-violet-light hover:opacity-80 transition-opacity text-[10px] font-medium">
            <Link2 size={10} />Link
          </button>
        </div>
      </div>

      <div>
        {/* Distribution bar for non-liability sections */}
        {!isCreditSection && !isLoanSection && catAccounts.length > 1 && (
          <DistBar items={catAccounts.map((a, i) => ({
            label: a.name.split(' ')[0], value: a.balance_current, color: DIST_PALETTE[i % DIST_PALETTE.length],
          }))} />
        )}

        {/* Credit: overall utilization summary */}
        {isCreditSection && totalCreditLimit > 0 && (() => {
          const avail       = Math.max(0, totalCreditLimit - catTotal);
          const estInterest = catAccounts.reduce((s, a) => s + (a.balance_current || 0) * ((a.apr || 0) / 100 / 12), 0);
          const utilColor   = overallUtilPct >= 90 ? 'var(--red)' : overallUtilPct >= 70 ? 'var(--amber)' : 'var(--chart-2)';
          return (
            <div className="mb-5 space-y-2.5">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-muted-foreground">Overall utilization</span>
                <span className={cn('text-sm font-black tabular-nums',
                  overallUtilPct >= 90 ? 'text-red' : overallUtilPct >= 70 ? 'text-amber' : 'text-foreground')}>
                  {overallUtilPct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${overallUtilPct}%`, background: utilColor }} />
              </div>
              <div className="grid grid-cols-3 text-center pt-0.5">
                {[
                  { label: 'Balance',     value: fmt(catTotal)      },
                  { label: 'Available',   value: fmt(avail)         },
                  { label: 'Est. Int/mo', value: fmtD(estInterest)  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className="text-[11px] font-bold tabular text-foreground mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

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
        <div className="flex flex-col gap-1">
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
              <div key={acc.id} className={cn('relative py-3 flex items-start gap-3 group/row', isCredit && 'pl-3')}>
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
                    <div className="flex items-start gap-1 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold tabular text-foreground">{fmtD(acc.balance_current)}</p>
                        {isAsset && acc.balance_available != null && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtD(acc.balance_available)} avail.</p>
                        )}
                      </div>
                      {(onArchiveAccount || onRemoveAccount) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-0.5 rounded opacity-0 group-hover/row:opacity-60 hover:!opacity-100 transition-opacity focus:opacity-100 focus:outline-none mt-0.5"
                              aria-label="Account actions"
                            >
                              <MoreVertical size={13} className="text-white" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setPendingRemoveAcc(acc)}
                            >
                              <Trash2 size={13} />
                              Remove Account
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                        <p className="text-[11px] text-muted-foreground mt-2">
                          No holdings yet.{' '}
                          <button onClick={onAddAccount}
                            className="text-violet-light hover:opacity-80 font-medium underline underline-offset-2">
                            Link an institution
                          </button>{' '}or{' '}
                          <button onClick={onAddAccount}
                            className="text-violet-light hover:opacity-80 font-medium underline underline-offset-2">
                            add manually
                          </button>.
                        </p>
                      );
                    }
                    const top = acctHoldings.slice(0, 8);
                    const rest = acctHoldings.length - top.length;
                    return (
                      <div className="mt-3 flex flex-col gap-1">
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
                          className="mt-2 text-[10px] text-violet-light hover:opacity-80 transition-colors font-medium">
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

        {/* Archive vs. Delete dialog */}
        <AlertDialog
          open={pendingRemoveAcc !== null}
          onOpenChange={open => { if (!open && !removingAction) setPendingRemoveAcc(null); }}
        >
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitlePrimitive>Remove Account</AlertDialogTitlePrimitive>
              <AlertDialogDescription>
                What happened to{' '}
                <span className="font-medium text-foreground">{pendingRemoveAcc?.name}</span>?
                {' '}Choose how you want to handle your historical data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-3 mt-1">
              <Button
                variant="outline"
                disabled={removingAction !== null}
                onClick={handleAccountArchive}
                className="h-auto w-full justify-between px-4 py-3 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">I closed this account.</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Preserves your past net worth history.</p>
                </div>
                {removingAction === 'archive'
                  ? <Loader2 size={14} className="text-muted-foreground animate-spin shrink-0 ml-3" />
                  : <Archive  size={14} className="text-muted-foreground shrink-0 ml-3" />
                }
              </Button>
              <Button
                variant="outline"
                disabled={removingAction !== null}
                onClick={handleAccountDelete}
                className="h-auto w-full justify-between px-4 py-3 text-left border-destructive text-destructive hover:bg-destructive/5 hover:text-destructive focus-visible:ring-destructive"
              >
                <div>
                  <p className="text-sm font-medium">It was a mistake.</p>
                  <p className="text-xs text-destructive/70 mt-0.5">Permanently deletes this account and all its transactions.</p>
                </div>
                {removingAction === 'delete'
                  ? <Loader2 size={14} className="animate-spin shrink-0 ml-3" />
                  : <Trash2  size={14} className="shrink-0 ml-3" />
                }
              </Button>
              <AlertDialogCancel
                disabled={removingAction !== null}
                onClick={() => setPendingRemoveAcc(null)}
              >
                Cancel
              </AlertDialogCancel>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Widget>
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
  onOpenAdd: (t: ManualAsset['asset_type']) => void;
  onStartEdit: (a: ManualAsset) => void;
  onEditChange: (p: Partial<ManualAssetForm>) => void;
  onSaveEdit: () => void; onCancelEdit: () => void;
  onConfirmDelete: (id: string | null) => void;
  onDelete: (id: string) => void;
  onAddAccount?: () => void;
}

function ManualWidget({
  sectionType, label, icon, accentColor,
  manualAssets, loanAccounts,
  editingAssetId, editForm, editSaving, confirmDeleteId,
  onOpenAdd,
  onStartEdit, onEditChange, onSaveEdit, onCancelEdit,
  onConfirmDelete, onDelete,
  onAddAccount,
}: ManualWidgetProps) {
  const sectionTotal = manualAssets.reduce((s, a) => s + a.current_value, 0);
  const subtypeLabel = (a: ManualAsset) =>
    ASSET_SUBTYPES[a.asset_type]?.find(s => s.value === a.asset_subtype)?.label ?? a.asset_subtype ?? a.asset_type;

  return (
    <Widget>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: accentColor + '22', color: accentColor }}>
            {icon}
          </div>
          <span className="text-sm font-semibold text-foreground truncate">{label}</span>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground px-1.5 py-0 shrink-0">
            {manualAssets.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-2">
          {sectionTotal > 0 && (
            <span className="text-sm font-bold tabular text-foreground">{fmt(sectionTotal)}</span>
          )}
          {sectionType === 'stocks_bonds' && (
            <button onClick={onAddAccount}
              title="Link an institution"
              className="h-6 px-2 rounded-md flex items-center gap-1 border border-dashed border-violet-light/40 text-violet-light hover:opacity-80 transition-opacity text-[10px] font-medium">
              <Link2 size={10} />Link
            </button>
          )}
          <button onClick={() => onOpenAdd(sectionType)}
            className="w-6 h-6 rounded-md flex items-center justify-center border border-dashed border-violet-light/40 text-violet-light hover:opacity-80 transition-opacity">
            <Plus size={11} />
          </button>
        </div>
      </div>

      <div>
        {sectionType === 'stocks_bonds' && manualAssets.length > 1 && (
          <DistBar items={manualAssets.map((a, i) => ({
            label: a.name.split(' ')[0], value: a.current_value, color: DIST_PALETTE[i % DIST_PALETTE.length],
          }))} />
        )}

        {manualAssets.length === 0 && (
          sectionType === 'stocks_bonds' ? (
            <p className="text-[11px] text-muted-foreground py-6 text-center">
              No holdings yet.{' '}
              <button onClick={onAddAccount}
                className="text-violet-light hover:opacity-80 font-medium underline underline-offset-2">
                Link an institution
              </button>{' '}or{' '}
              <button onClick={onAddAccount}
                className="text-violet-light hover:opacity-80 font-medium underline underline-offset-2">
                add manually
              </button>.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground py-6 text-center">
              No {label.toLowerCase()} added yet.{' '}
              <button onClick={onAddAccount}
                className="text-violet-light hover:opacity-80 font-medium underline underline-offset-2">
                Add an asset
              </button>.
            </p>
          )
        )}

        <div className="flex flex-col gap-1">
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
                          className="text-[10px] text-violet-light hover:opacity-80 transition-colors font-medium">
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

      </div>
    </Widget>
  );
}
