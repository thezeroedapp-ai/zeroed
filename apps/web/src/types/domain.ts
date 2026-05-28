// ─── Valuation & Classification Enums ────────────────────────────────────────

export type ValuationSource   = 'plaid_sync' | 'api_automated' | 'manual_override';
export type PhysicalAssetType = 'real_estate' | 'vehicle' | 'stocks_bonds' | 'other';
export type LiquidAccountType = 'checking' | 'savings' | 'investment' | 'brokerage' | 'retirement' | 'other';
export type LiabilityType     = 'mortgage' | 'auto_loan' | 'credit_card' | 'student_loan' | 'personal_loan' | 'other';

// ─── Core Domain Types ────────────────────────────────────────────────────────

export interface PhysicalAsset {
  id: string;
  name: string;
  assetType: PhysicalAssetType;
  assetSubtype?: string;
  currentValue: number;
  /** Determines badge + auto-valuation refresh cadence. */
  valuationSource: ValuationSource;
  /** ID of the Liability this asset is paired against (null = fully owned). */
  linkedLiabilityId: string | null;
  /** Annual appreciation/depreciation as a decimal. e.g. 0.05 = +5%, -0.12 = −12%. */
  annualGrowthCoefficient: number;
  lastValuedAt: string; // ISO 8601
  archivedAt?: string | null;
  metadata?: {
    address?: string;
    vin?: string;
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
  };
}

export interface LiquidAsset {
  id: string;
  name: string;
  institutionName: string;
  accountType: LiquidAccountType;
  currentBalance: number;
  availableBalance: number | null;
  plaidItemId?: string;
  archivedAt?: string | null;
  lastSyncedAt: string; // ISO 8601
}

export interface Liability {
  id: string;
  name: string;
  institutionName: string;
  liabilityType: LiabilityType;
  currentBalance: number;
  originalBalance?: number;
  /** As a decimal. e.g. 0.065 = 6.5% APR. null = unknown. */
  interestRate: number | null;
  minimumPayment: number | null;
  paymentDueDate: string | null; // ISO 8601
  plaidItemId?: string;
  /** Populated after asset-pairing in the aggregator hook. */
  linkedAssetId: string | null;
  metadata?: {
    propertyAddress?: string;    // mortgages — triggers AVM Workflow A
    vehicleDescription?: string; // auto loans — triggers VIN Workflow B
  };
}

// ─── Computed Output Types ────────────────────────────────────────────────────

export interface EquityPairing {
  asset: PhysicalAsset;
  liability: Liability;
  grossValue: number;
  outstandingDebt: number;
  netEquity: number;
  equityPercent: number;
  ltvPercent: number;
}

export interface NetWorthResult {
  totalLiquidAssets: number;
  totalPhysicalAssets: number;
  totalLiabilities: number;
  grossAssets: number;
  netWorth: number;
  equityPairings: EquityPairing[];
  /** Liabilities with no paired PhysicalAsset — surface in AssetDiscoveryBanner. */
  unlinkedLiabilities: Liability[];
  /** PhysicalAssets with no linked Liability — fully owned. */
  unlinkedPhysicalAssets: PhysicalAsset[];
}
