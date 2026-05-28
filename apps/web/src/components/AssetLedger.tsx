import { useState } from 'react';
import {
  Home, Car, TrendingUp, Landmark, AlertTriangle,
  MoreVertical, Trash2, Unlink, Archive, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge }  from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn }     from '@/lib/utils';
import { fmt, fmtD } from '@/lib/api';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type {
  NetWorthResult, EquityPairing,
  PhysicalAsset, LiquidAsset, Liability,
  ValuationSource,
} from '@/types/domain';
import InstitutionLogo from '@/components/ui/institution-logo';

// ─── Pending action state ─────────────────────────────────────────────────────

type PendingRemove =
  | { kind: 'asset'; id: string; name: string }
  | { kind: 'institution'; plaidItemId: string; institutionName: string };

type DeletingAction = 'archive' | 'delete' | null;

// ─── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_STYLES: Record<ValuationSource, { label: string; className: string }> = {
  plaid_sync:      { label: 'Plaid Sync',   className: 'border-green/25  text-green/80  bg-green-dim/40'  },
  api_automated:   { label: 'API: RentCast', className: 'border-[var(--violet-light)]/25 text-violet-light/80 bg-violet-dim/40' },
  manual_override: { label: 'Manual',        className: 'border-amber/25  text-amber     bg-amber-dim/40'  },
};

function SourceBadge({ source }: { source: ValuationSource }) {
  const s = SOURCE_STYLES[source];
  return (
    <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 font-medium shrink-0', s.className)}>
      {s.label}
    </Badge>
  );
}

// ─── Asset type icon ──────────────────────────────────────────────────────────

function AssetIcon({ type, size = 13 }: { type: PhysicalAsset['assetType']; size?: number }) {
  const cls = 'text-muted-foreground shrink-0';
  if (type === 'real_estate')  return <Home       size={size} className={cls} />;
  if (type === 'vehicle')      return <Car        size={size} className={cls} />;
  if (type === 'stocks_bonds') return <TrendingUp size={size} className={cls} />;
  return <Landmark size={size} className={cls} />;
}

// ─── Row ellipsis menu ────────────────────────────────────────────────────────

interface EllipsisMenuProps {
  onRemove: () => void;
  label: string;
  icon: React.ReactNode;
}

function EllipsisMenu({ onRemove, label, icon }: EllipsisMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-0.5 rounded opacity-0 group-hover/row:opacity-40 hover:!opacity-100 transition-opacity focus:opacity-100 focus:outline-none"
          aria-label="Row actions"
        >
          <MoreVertical size={13} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={onRemove}
        >
          {icon}
          {label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Equity pairing row ───────────────────────────────────────────────────────

interface EquityPairingRowProps {
  pairing: EquityPairing;
  onRequestRemove?: (item: PendingRemove) => void;
}

function EquityPairingRow({ pairing, onRequestRemove }: EquityPairingRowProps) {
  const { asset, liability, grossValue, outstandingDebt, netEquity, equityPercent, ltvPercent } = pairing;
  const equityPositive = netEquity >= 0;
  const canRemove = onRequestRemove && asset.valuationSource === 'manual_override';

  return (
    <div className="py-4 border-b border-border last:border-0 group/row">
      {/* Asset header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <AssetIcon type={asset.assetType} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{asset.name}</p>
            {asset.metadata?.address && (
              <p className="text-[10px] text-muted-foreground truncate">{asset.metadata.address}</p>
            )}
          </div>
          <SourceBadge source={asset.valuationSource} />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-sm font-bold tabular text-foreground">{fmt(grossValue)}</span>
          {canRemove && (
            <EllipsisMenu
              label="Remove Asset"
              icon={<Trash2 size={13} />}
              onRemove={() => onRequestRemove({ kind: 'asset', id: asset.id, name: asset.name })}
            />
          )}
        </div>
      </div>

      {/* Debt row */}
      <div className="flex items-center justify-between gap-3 pl-5 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3 h-px bg-border shrink-0" />
          <p className="text-[11px] text-muted-foreground truncate">{liability.name}</p>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-green/25 text-green/80 bg-green-dim/40 shrink-0">
            Plaid Sync
          </Badge>
        </div>
        <span className="text-[11px] tabular text-muted-foreground shrink-0">
          −{fmt(outstandingDebt)}
        </span>
      </div>

      {/* Separator */}
      <div className="pl-5 my-2">
        <div className="h-px bg-border/60" />
      </div>

      {/* Net equity */}
      <div className="flex items-center justify-between gap-3 pl-5">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold text-foreground">Net Equity</p>
          <span className={cn(
            'text-[10px] font-medium tabular',
            equityPositive ? 'text-green' : 'text-muted-foreground',
          )}>
            {equityPercent}% equity · {ltvPercent}% LTV
          </span>
        </div>
        <span className={cn(
          'text-sm font-bold tabular shrink-0',
          equityPositive ? 'text-green' : 'text-foreground',
        )}>
          {equityPositive ? '' : '−'}{fmt(Math.abs(netEquity))}
        </span>
      </div>

      {/* Mini LTV bar */}
      <div className="pl-5 mt-2.5">
        <div className="flex h-1 rounded-full overflow-hidden bg-surface-2">
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.min(100, equityPercent)}%`,
              background: equityPercent >= 20 ? 'var(--green)' : 'var(--amber)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Unlinked physical asset row ──────────────────────────────────────────────

interface UnlinkedAssetRowProps {
  asset: PhysicalAsset;
  onRequestRemove?: (item: PendingRemove) => void;
}

function UnlinkedAssetRow({ asset, onRequestRemove }: UnlinkedAssetRowProps) {
  const canRemove = onRequestRemove && asset.valuationSource === 'manual_override';

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0 group/row">
      <div className="flex items-center gap-2 min-w-0">
        <AssetIcon type={asset.assetType} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{asset.name}</p>
          <p className="text-[10px] text-muted-foreground">Fully owned · no linked debt</p>
        </div>
        <SourceBadge source={asset.valuationSource} />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-sm font-bold tabular text-foreground">{fmt(asset.currentValue)}</span>
        {canRemove && (
          <EllipsisMenu
            label="Remove Asset"
            icon={<Trash2 size={13} />}
            onRemove={() => onRequestRemove({ kind: 'asset', id: asset.id, name: asset.name })}
          />
        )}
      </div>
    </div>
  );
}

// ─── Liquid asset row ─────────────────────────────────────────────────────────

interface LiquidAssetRowProps {
  asset: LiquidAsset;
  onRequestRemove?: (item: PendingRemove) => void;
}

function LiquidAssetRow({ asset, onRequestRemove }: LiquidAssetRowProps) {
  const canRemove = onRequestRemove && !!asset.plaidItemId;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0 group/row">
      <InstitutionLogo name={asset.institutionName || asset.name} size={28} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{asset.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {asset.institutionName}
          {asset.availableBalance != null && (
            <span> · {fmtD(asset.availableBalance)} avail.</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold tabular text-foreground">{fmtD(asset.currentBalance)}</p>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-green/25 text-green/80 bg-green-dim/40">
            Plaid Sync
          </Badge>
        </div>
        {canRemove && (
          <EllipsisMenu
            label="Remove Institution"
            icon={<Unlink size={13} />}
            onRemove={() => onRequestRemove({
              kind: 'institution',
              plaidItemId: asset.plaidItemId!,
              institutionName: asset.institutionName || asset.name,
            })}
          />
        )}
      </div>
    </div>
  );
}

// ─── Unlinked liability row ───────────────────────────────────────────────────

function UnlinkedLiabilityRow({ liability }: { liability: Liability }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-surface-2">
        <AlertTriangle size={13} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{liability.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {liability.institutionName}
          {liability.interestRate != null && (
            <span> · {(liability.interestRate * 100).toFixed(2)}% APR</span>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular text-foreground">{fmtD(liability.currentBalance)}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">no asset linked</p>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function LedgerSection({
  title,
  total,
  totalColor = 'text-foreground',
  count,
  children,
}: {
  title: string;
  total: number;
  totalColor?: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground px-1.5 py-0">
              {count}
            </Badge>
          </div>
          <span className={cn('text-sm font-bold tabular shrink-0', totalColor)}>
            {fmt(total)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-1">
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Remove dialog ────────────────────────────────────────────────────────────

interface RemoveDialogProps {
  pending: PendingRemove | null;
  deletingAction: DeletingAction;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function RemoveDialog({ pending, deletingAction, onArchive, onDelete, onClose }: RemoveDialogProps) {
  const isAsset       = pending?.kind === 'asset';
  const entityName    = isAsset ? (pending as { name: string }).name : (pending as { institutionName: string } | null)?.institutionName ?? '';
  const busy          = deletingAction !== null;

  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={open => { if (!open && !busy) onClose(); }}
    >
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isAsset ? 'Remove Asset' : 'Remove Institution'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            What happened to <span className="font-medium text-foreground">{entityName}</span>? Choose how you want to handle your historical data.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-3 mt-1">
          {/* Archive — soft delete, preserves history */}
          <Button
            variant="outline"
            disabled={busy}
            onClick={onArchive}
            className="h-auto w-full justify-between px-4 py-3 text-left"
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {isAsset ? 'I sold or closed it.' : 'I closed this account.'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Preserves your past net worth history.
              </p>
            </div>
            {deletingAction === 'archive'
              ? <Loader2 size={14} className="text-muted-foreground animate-spin shrink-0 ml-3" />
              : <Archive  size={14} className="text-muted-foreground shrink-0 ml-3" />
            }
          </Button>

          {/* Hard delete — rewrites history */}
          <Button
            variant="outline"
            disabled={busy}
            onClick={onDelete}
            className="h-auto w-full justify-between px-4 py-3 text-left border-destructive text-destructive hover:bg-destructive/5 hover:text-destructive focus-visible:ring-destructive"
          >
            <div>
              <p className="text-sm font-medium">It was a mistake.</p>
              <p className="text-xs text-destructive/70 mt-0.5">
                {isAsset
                  ? 'Permanently deletes this asset and rewrites history.'
                  : 'Permanently disconnects and deletes all linked data.'}
              </p>
            </div>
            {deletingAction === 'delete'
              ? <Loader2 size={14} className="animate-spin shrink-0 ml-3" />
              : <Trash2  size={14} className="shrink-0 ml-3" />
            }
          </Button>

          <AlertDialogCancel disabled={busy} onClick={onClose}>
            Cancel
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── AssetLedger ──────────────────────────────────────────────────────────────

interface AssetLedgerProps {
  result: NetWorthResult;
  liquidAssets: LiquidAsset[];
  onRemoveAsset?: (assetId: string) => Promise<void>;
  onRemoveInstitution?: (plaidItemId: string) => Promise<void>;
  onArchiveAsset?: (assetId: string) => Promise<void>;
  onArchiveInstitution?: (plaidItemId: string) => Promise<void>;
}

export default function AssetLedger({
  result,
  liquidAssets,
  onRemoveAsset,
  onRemoveInstitution,
  onArchiveAsset,
  onArchiveInstitution,
}: AssetLedgerProps) {
  const {
    equityPairings,
    unlinkedPhysicalAssets,
    unlinkedLiabilities,
    totalLiquidAssets,
    totalPhysicalAssets,
    totalLiabilities,
    netWorth,
  } = result;

  const [pendingRemove,  setPendingRemove]  = useState<PendingRemove | null>(null);
  const [deletingAction, setDeletingAction] = useState<DeletingAction>(null);

  const pairedAssetsTotal   = equityPairings.reduce((s, p) => s + p.grossValue, 0);
  const unlinkedAssetsTotal = unlinkedPhysicalAssets.reduce((s, a) => s + a.currentValue, 0);
  const unlinkedDebtTotal   = unlinkedLiabilities.reduce((s, l) => s + l.currentBalance, 0);

  const hasActionCallbacks = !!(onRemoveAsset || onRemoveInstitution || onArchiveAsset || onArchiveInstitution);

  async function handleArchive() {
    if (!pendingRemove) return;
    setDeletingAction('archive');
    try {
      if (pendingRemove.kind === 'asset' && onArchiveAsset) {
        await onArchiveAsset(pendingRemove.id);
      } else if (pendingRemove.kind === 'institution' && onArchiveInstitution) {
        await onArchiveInstitution(pendingRemove.plaidItemId);
      }
      setPendingRemove(null);
    } finally {
      setDeletingAction(null);
    }
  }

  async function handleDelete() {
    if (!pendingRemove) return;
    setDeletingAction('delete');
    try {
      if (pendingRemove.kind === 'asset' && onRemoveAsset) {
        await onRemoveAsset(pendingRemove.id);
      } else if (pendingRemove.kind === 'institution' && onRemoveInstitution) {
        await onRemoveInstitution(pendingRemove.plaidItemId);
      }
      setPendingRemove(null);
    } finally {
      setDeletingAction(null);
    }
  }

  return (
    <div className="space-y-4">

      {/* Net Worth Summary Strip */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-5">
          <div className="grid grid-cols-3 gap-4 divide-x divide-border">
            {[
              { label: 'Gross Assets',  value: fmt(totalLiquidAssets + totalPhysicalAssets), color: 'text-foreground' },
              { label: 'Total Debt',    value: fmt(totalLiabilities),                         color: 'text-foreground' },
              { label: 'Net Worth',     value: `${netWorth < 0 ? '−' : ''}${fmt(Math.abs(netWorth))}`, color: netWorth >= 0 ? 'text-green' : 'text-foreground' },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-4 first:pl-0 last:pr-0 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className={cn('text-xl font-extrabold tabular mt-1', color)}>{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Equity Pairings */}
      <LedgerSection
        title="Equity Pairings"
        total={pairedAssetsTotal}
        count={equityPairings.length}>
        {equityPairings.map(p => (
          <EquityPairingRow
            key={p.asset.id}
            pairing={p}
            onRequestRemove={hasActionCallbacks ? setPendingRemove : undefined}
          />
        ))}
      </LedgerSection>

      {/* Fully-owned physical assets */}
      <LedgerSection
        title="Owned Assets"
        total={unlinkedAssetsTotal}
        count={unlinkedPhysicalAssets.length}>
        {unlinkedPhysicalAssets.map(a => (
          <UnlinkedAssetRow
            key={a.id}
            asset={a}
            onRequestRemove={hasActionCallbacks ? setPendingRemove : undefined}
          />
        ))}
      </LedgerSection>

      {/* Liquid accounts */}
      <LedgerSection
        title="Cash & Liquid"
        total={totalLiquidAssets}
        count={liquidAssets.length}>
        {liquidAssets.map(a => (
          <LiquidAssetRow
            key={a.id}
            asset={a}
            onRequestRemove={hasActionCallbacks ? setPendingRemove : undefined}
          />
        ))}
      </LedgerSection>

      {/* Liabilities with no linked asset */}
      {unlinkedLiabilities.length > 0 && (
        <LedgerSection
          title="Unlinked Debt"
          total={unlinkedDebtTotal}
          count={unlinkedLiabilities.length}>
          {unlinkedLiabilities.map(l => (
            <UnlinkedLiabilityRow key={l.id} liability={l} />
          ))}
        </LedgerSection>
      )}

      {/* Archive vs. Delete dialog */}
      <RemoveDialog
        pending={pendingRemove}
        deletingAction={deletingAction}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onClose={() => setPendingRemove(null)}
      />

    </div>
  );
}
