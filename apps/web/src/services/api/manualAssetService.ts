import { apiFetch } from '@/lib/api';

export async function deleteManualAsset(assetId: string): Promise<void> {
  const r = await apiFetch(`/api/manual-assets/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(`Delete manual asset failed: ${r.status}`);
}
