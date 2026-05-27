import { apiFetch } from '@/lib/api';

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface RealEstateValuation {
  address: string;
  estimatedValue: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  confidenceScore: number; // 0–1
  valuationDate: string;   // ISO 8601 date (YYYY-MM-DD)
  source: 'rentcast';
}

export interface VehicleValuation {
  vin?: string;
  make: string;
  model: string;
  year: number;
  mileage?: number;
  estimatedValue: number;
  tradeInValue: number;
  retailValue: number;
  valuationDate: string; // ISO 8601 date (YYYY-MM-DD)
  source: 'marketcheck';
}

export interface VehicleSpecsPayload {
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  trim?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchRealEstateAVM(address: string): Promise<RealEstateValuation> {
  const r = await apiFetch(
    `/api/valuations/real-estate?address=${encodeURIComponent(address)}`,
  );
  if (!r.ok) throw new Error(`AVM lookup failed (${r.status}) for: ${address}`);
  return r.json();
}

export async function fetchVehicleValue(
  specs: VehicleSpecsPayload,
): Promise<VehicleValuation> {
  const r = await apiFetch('/api/valuations/vehicle', {
    method: 'POST',
    body: JSON.stringify(specs),
  });
  if (!r.ok) throw new Error(`Vehicle valuation failed: ${r.status}`);
  return r.json();
}
