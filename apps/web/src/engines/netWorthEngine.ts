// Pure TypeScript — zero React, zero I/O, zero side effects.
// Every function is deterministic: same inputs → same output, always.

import type {
  PhysicalAsset, LiquidAsset, Liability,
  EquityPairing, NetWorthResult,
} from '@/types/domain';

// ─── Per-asset helpers ────────────────────────────────────────────────────────

/**
 * Pair one PhysicalAsset against its linked Liability and compute all equity
 * metrics. Caller must guarantee the pairing is valid (IDs match).
 */
export function calculateTrueEquity(
  asset: PhysicalAsset,
  liability: Liability,
): EquityPairing {
  const grossValue      = asset.currentValue;
  const outstandingDebt = liability.currentBalance;
  const netEquity       = grossValue - outstandingDebt;
  const equityPercent   = grossValue > 0
    ? Math.round((netEquity      / grossValue) * 100) : 0;
  const ltvPercent      = grossValue > 0
    ? Math.round((outstandingDebt / grossValue) * 100) : 0;

  return { asset, liability, grossValue, outstandingDebt, netEquity, equityPercent, ltvPercent };
}

/**
 * Project an asset's future value N years from now using its
 * annualGrowthCoefficient (supports negative values for depreciation).
 */
export function projectAssetValue(asset: PhysicalAsset, yearsAhead: number): number {
  return Math.round(
    asset.currentValue * Math.pow(1 + asset.annualGrowthCoefficient, yearsAhead),
  );
}

/** Monthly interest cost for a liability. Rate is stored as a decimal (0.065 = 6.5%). */
export function monthlyInterestCost(liability: Liability): number {
  if (!liability.interestRate || liability.currentBalance <= 0) return 0;
  return liability.currentBalance * (liability.interestRate / 12);
}

// ─── Full aggregation ─────────────────────────────────────────────────────────

/**
 * Aggregate all assets and liabilities into a single structured NetWorthResult.
 *
 * Pairing strategy: iterate PhysicalAssets — each asset that declares a
 * linkedLiabilityId is paired with the matching Liability. Unmatched IDs on
 * either side surface in their respective `unlinked*` arrays.
 */
export function aggregateNetWorth(
  liquidAssets: LiquidAsset[],
  physicalAssets: PhysicalAsset[],
  liabilities: Liability[],
): NetWorthResult {
  const totalLiquidAssets   = liquidAssets.reduce((s, a) => s + a.currentBalance, 0);
  const totalPhysicalAssets = physicalAssets.reduce((s, a) => s + a.currentValue, 0);
  const totalLiabilities    = liabilities.reduce((s, l) => s + l.currentBalance, 0);
  const grossAssets         = totalLiquidAssets + totalPhysicalAssets;
  const netWorth            = grossAssets - totalLiabilities;

  const pairedLiabilityIds = new Set<string>();
  const pairedAssetIds     = new Set<string>();
  const equityPairings: EquityPairing[] = [];

  for (const asset of physicalAssets) {
    if (!asset.linkedLiabilityId) continue;
    const liability = liabilities.find(l => l.id === asset.linkedLiabilityId);
    if (!liability) continue;
    equityPairings.push(calculateTrueEquity(asset, liability));
    pairedLiabilityIds.add(liability.id);
    pairedAssetIds.add(asset.id);
  }

  return {
    totalLiquidAssets,
    totalPhysicalAssets,
    totalLiabilities,
    grossAssets,
    netWorth,
    equityPairings,
    unlinkedLiabilities:    liabilities.filter(l => !pairedLiabilityIds.has(l.id)),
    unlinkedPhysicalAssets: physicalAssets.filter(a => !pairedAssetIds.has(a.id)),
  };
}
