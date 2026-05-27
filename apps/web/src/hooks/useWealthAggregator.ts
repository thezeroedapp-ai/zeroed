import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  PhysicalAsset, LiquidAsset, Liability,
  NetWorthResult, LiquidAccountType,
} from '@/types/domain';
import * as plaidSvc      from '@/services/api/plaidService';
import * as valuationSvc  from '@/services/api/valuationService';
import type { VehicleSpecsPayload } from '@/services/api/valuationService';
import { aggregateNetWorth }        from '@/engines/netWorthEngine';
import { apiFetch }                 from '@/lib/api';

// ─── Public types ─────────────────────────────────────────────────────────────

export type AggregatorStatus = 'idle' | 'loading' | 'error' | 'ready';

export interface PendingAutoLoan {
  liabilityId: string;
  liabilityName: string;
  balance: number;
  vehicleHint?: string; // e.g. "2021 Toyota Camry" from Plaid metadata
}

export interface UseWealthAggregatorReturn {
  status: AggregatorStatus;
  error: string | null;
  result: NetWorthResult | null;
  liquidAssets: LiquidAsset[];
  pendingAutoLoans: PendingAutoLoan[];
  /** Workflow B resolution — user submits VIN/specs, we value + persist + re-aggregate. */
  linkVehicleToLoan: (liabilityId: string, specs: VehicleSpecsPayload) => Promise<void>;
  refresh: () => void;
}

// ─── Data mappers (raw API shape → domain types) ──────────────────────────────

function toLiquidAssets(raw: plaidSvc.RawPlaidAccount[]): LiquidAsset[] {
  return raw
    .filter(a => ['depository', 'investment', 'brokerage'].includes(a.type))
    .map(a => ({
      id:               a.id,
      name:             a.name,
      institutionName:  a.institution_name,
      accountType:      (a.subtype ?? 'other') as LiquidAccountType,
      currentBalance:   a.balance_current  ?? 0,
      availableBalance: a.balance_available ?? null,
      plaidItemId:      a.plaid_item_id,
      lastSyncedAt:     new Date().toISOString(),
    }));
}

function toLiabilities(raw: plaidSvc.RawPlaidAccount[]): Liability[] {
  return raw
    .filter(a => ['credit', 'loan', 'mortgage'].includes(a.type))
    .map(a => {
      const ext = a as plaidSvc.RawPlaidLiability;

      const liabilityType: Liability['liabilityType'] =
        a.type === 'mortgage'              ? 'mortgage'
        : a.subtype?.includes('auto')      ? 'auto_loan'
        : a.subtype?.includes('student')   ? 'student_loan'
        : a.type === 'credit'              ? 'credit_card'
        : 'other';

      return {
        id:               a.id,
        name:             a.name,
        institutionName:  a.institution_name,
        liabilityType,
        currentBalance:   a.balance_current ?? 0,
        interestRate:     a.apr != null ? a.apr / 100 : null, // % → decimal
        minimumPayment:   a.minimum_payment,
        paymentDueDate:   a.payment_due_date,
        plaidItemId:      a.plaid_item_id,
        linkedAssetId:    null,
        metadata: {
          propertyAddress:    ext.property_address    ?? undefined,
          vehicleDescription: ext.vehicle_description ?? undefined,
        },
      };
    });
}

interface RawManualAsset {
  id: string; name: string; asset_type: string;
  asset_subtype?: string; current_value: number; linked_loan_id?: string | null;
}

const GROWTH_RATES: Record<string, number> = {
  real_estate:  0.05,
  vehicle:     -0.12,
  stocks_bonds: 0.07,
  other:        0.03,
};

function toPhysicalAssets(raw: RawManualAsset[]): PhysicalAsset[] {
  return raw.map(a => ({
    id:                      a.id,
    name:                    a.name,
    assetType:               a.asset_type as PhysicalAsset['assetType'],
    assetSubtype:            a.asset_subtype,
    currentValue:            a.current_value,
    valuationSource:         'manual_override' as const,
    linkedLiabilityId:       a.linked_loan_id ?? null,
    annualGrowthCoefficient: GROWTH_RATES[a.asset_type] ?? 0.03,
    lastValuedAt:            new Date().toISOString(),
  }));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWealthAggregator(): UseWealthAggregatorReturn {
  const [status,           setStatus]           = useState<AggregatorStatus>('idle');
  const [error,            setError]            = useState<string | null>(null);
  const [result,           setResult]           = useState<NetWorthResult | null>(null);
  const [liquidAssets,     setLiquidAssets]     = useState<LiquidAsset[]>([]);
  const [pendingAutoLoans, setPendingAutoLoans] = useState<PendingAutoLoan[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setStatus('loading');
    setError(null);

    try {
      // ── 1. Parallel fetch: Plaid accounts + manual assets ─────────────────
      const [accountsRes, manualRes] = await Promise.all([
        plaidSvc.fetchAccounts(),
        apiFetch('/api/manual-assets')
          .then(r => r.ok ? r.json() : { assets: [] })
          .catch(() => ({ assets: [] })),
      ]);

      const liquidAssets:   LiquidAsset[]   = toLiquidAssets(accountsRes.accounts ?? []);
      const liabilities:    Liability[]     = toLiabilities(accountsRes.accounts ?? []);
      const manualPhysical: PhysicalAsset[] = toPhysicalAssets(manualRes.assets ?? []);

      // ── 2. Workflow A — Zero-Touch Mortgage AVM ───────────────────────────
      // Mortgages that carry a property_address but have no manual asset yet
      // automatically get an AVM-valued PhysicalAsset created and linked.
      const autoValuedAssets: PhysicalAsset[] = [];
      const mortgagesWithAddress = liabilities.filter(
        l =>
          l.liabilityType === 'mortgage' &&
          l.metadata?.propertyAddress &&
          !manualPhysical.some(a => a.linkedLiabilityId === l.id),
      );

      await Promise.allSettled(
        mortgagesWithAddress.map(async mortgage => {
          try {
            const avm = await valuationSvc.fetchRealEstateAVM(
              mortgage.metadata!.propertyAddress!,
            );
            const assetId = `avm_${mortgage.id}`;
            autoValuedAssets.push({
              id:                      assetId,
              name:                    `Property · ${avm.address}`,
              assetType:               'real_estate',
              currentValue:            avm.estimatedValue,
              valuationSource:         'api_automated',
              linkedLiabilityId:       mortgage.id,
              annualGrowthCoefficient: 0.05,
              lastValuedAt:            avm.valuationDate,
              metadata:                { address: avm.address },
            });
            mortgage.linkedAssetId = assetId;
          } catch {
            // AVM unavailable — mortgage surfaces as unlinked, no crash
          }
        }),
      );

      // ── 3. Workflow B — Smart-Friction Auto Loans ─────────────────────────
      // Flag unlinked auto loans for AssetDiscoveryBanner; do not block render.
      const allPhysicalSoFar = [...manualPhysical, ...autoValuedAssets];
      const pendingLoans = liabilities.filter(
        l =>
          l.liabilityType === 'auto_loan' &&
          !allPhysicalSoFar.some(a => a.linkedLiabilityId === l.id),
      );
      setPendingAutoLoans(
        pendingLoans.map(l => ({
          liabilityId:   l.id,
          liabilityName: l.name,
          balance:       l.currentBalance,
          vehicleHint:   l.metadata?.vehicleDescription,
        })),
      );

      // ── 4. Back-fill linkedAssetId on liabilities from asset side ─────────
      for (const asset of allPhysicalSoFar) {
        if (asset.linkedLiabilityId) {
          const liability = liabilities.find(l => l.id === asset.linkedLiabilityId);
          if (liability) liability.linkedAssetId = asset.id;
        }
      }

      // ── 5. Run pure math engine ───────────────────────────────────────────
      setLiquidAssets(liquidAssets);
      setResult(aggregateNetWorth(liquidAssets, allPhysicalSoFar, liabilities));
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to aggregate wealth data');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const linkVehicleToLoan = useCallback(async (
    liabilityId: string,
    specs: VehicleSpecsPayload,
  ) => {
    const valuation = await valuationSvc.fetchVehicleValue(specs);
    await apiFetch('/api/manual-assets', {
      method: 'POST',
      body: JSON.stringify({
        name:           `${valuation.year} ${valuation.make} ${valuation.model}`,
        asset_type:     'vehicle',
        asset_subtype:  'car',
        current_value:  valuation.estimatedValue,
        linked_loan_id: liabilityId,
      }),
    });
    load();
  }, [load]);

  return { status, error, result, liquidAssets, pendingAutoLoans, linkVehicleToLoan, refresh: load };
}
