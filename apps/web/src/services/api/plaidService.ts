import { apiFetch } from '@/lib/api';

// ─── Raw server response shapes ───────────────────────────────────────────────
// These mirror what our Express /api/plaid/* endpoints return from Firestore.

export interface RawPlaidAccount {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  balance_current: number;
  balance_available: number | null;
  apr: number | null;
  minimum_payment: number | null;
  credit_limit: number | null;
  payment_due_date: string | null;
  institution_name: string;
  plaid_item_id?: string;
  archived_at?: string | null;
}

// Extends RawPlaidAccount with fields populated by Plaid's liabilities product
export interface RawPlaidLiability extends RawPlaidAccount {
  original_balance?: number;
  property_address?: string;    // present on mortgage accounts
  vehicle_description?: string; // present on auto loan accounts
}

export interface LinkTokenResponse {
  link_token: string;
}

// ─── Link flow ────────────────────────────────────────────────────────────────

export async function createLinkToken(): Promise<LinkTokenResponse> {
  const r = await apiFetch('/api/plaid/create-link-token', { method: 'POST' });
  if (!r.ok) throw new Error(`create-link-token failed: ${r.status}`);
  return r.json();
}

export async function createUpdateLinkToken(itemId: string): Promise<LinkTokenResponse> {
  const r = await apiFetch('/api/plaid/create-link-token/update', {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId }),
  });
  if (!r.ok) throw new Error(`create-update-link-token failed: ${r.status}`);
  return r.json();
}

export async function exchangePublicToken(
  publicToken: string,
  institutionName: string | null,
): Promise<void> {
  const r = await apiFetch('/api/plaid/exchange-token', {
    method: 'POST',
    body: JSON.stringify({ public_token: publicToken, institution_name: institutionName }),
  });
  if (!r.ok) throw new Error(`exchange-token failed: ${r.status}`);
}

export async function syncAll(): Promise<void> {
  const r = await apiFetch('/api/plaid/sync', { method: 'POST' });
  if (!r.ok) throw new Error(`sync failed: ${r.status}`);
}

// ─── Data fetching ────────────────────────────────────────────────────────────

export async function fetchAccounts(
  opts: { includeArchived?: boolean } = {},
): Promise<{ accounts: RawPlaidAccount[] }> {
  const qs = opts.includeArchived ? '?includeArchived=true' : '';
  const r  = await apiFetch(`/api/plaid/accounts${qs}`);
  if (!r.ok) throw new Error(`fetch-accounts failed: ${r.status}`);
  return r.json();
}

export async function fetchLiabilities(): Promise<{ liabilities: RawPlaidLiability[] }> {
  const r = await apiFetch('/api/plaid/liabilities');
  if (!r.ok) throw new Error(`fetch-liabilities failed: ${r.status}`);
  return r.json();
}

export async function archiveInstitution(itemId: string): Promise<void> {
  const r = await apiFetch(`/api/plaid/items/${encodeURIComponent(itemId)}/archive`, {
    method: 'PUT',
  });
  if (!r.ok) throw new Error(`Archive institution failed: ${r.status}`);
}

export async function unlinkInstitution(itemId: string): Promise<void> {
  const r = await apiFetch(`/api/plaid/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(`unlink institution failed: ${r.status}`);
}
