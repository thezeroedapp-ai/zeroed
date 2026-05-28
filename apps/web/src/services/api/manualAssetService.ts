import { apiFetch } from '@/lib/api';

export async function archiveManualAsset(assetId: string): Promise<void> {
  const r = await apiFetch(`/api/manual-assets/${encodeURIComponent(assetId)}/archive`, {
    method: 'PUT',
  });
  if (!r.ok) throw new Error(`Archive manual asset failed: ${r.status}`);
}

export async function deleteManualAsset(assetId: string): Promise<void> {
  const r = await apiFetch(`/api/manual-assets/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(`Delete manual asset failed: ${r.status}`);
}
