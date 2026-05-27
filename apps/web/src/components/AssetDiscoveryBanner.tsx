import { useState } from 'react';
import { Car, X } from 'lucide-react';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Badge }   from '@/components/ui/badge';
import { cn }      from '@/lib/utils';
import { fmtD }    from '@/lib/api';

import type { PendingAutoLoan }    from '@/hooks/useWealthAggregator';
import type { VehicleSpecsPayload } from '@/services/api/valuationService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AssetDiscoveryBannerProps {
  loans: PendingAutoLoan[];
  onLink: (liabilityId: string, specs: VehicleSpecsPayload) => Promise<void>;
  onDismiss: (liabilityId: string) => void;
}

// ─── Single loan row ──────────────────────────────────────────────────────────

function VINInputRow({
  loan,
  onLink,
  onDismiss,
}: {
  loan: PendingAutoLoan;
  onLink: (liabilityId: string, specs: VehicleSpecsPayload) => Promise<void>;
  onDismiss: (id: string) => void;
}) {
  const [input,   setInput]   = useState(loan.vehicleHint ?? '');
  const [linking, setLinking] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleLink() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLinking(true);
    setError(null);
    try {
      // Accept a raw VIN (17 chars, alphanumeric) or free-text description
      const isVIN = /^[A-HJ-NPR-Z0-9]{17}$/i.test(trimmed);
      const specs: VehicleSpecsPayload = isVIN
        ? { vin: trimmed.toUpperCase() }
        : { make: trimmed }; // server will do best-effort parse
      await onLink(loan.liabilityId, specs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Valuation failed — try a different VIN');
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 py-3 border-b border-border/50 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 bg-amber-dim">
            <Car size={12} className="text-amber" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{loan.liabilityName}</p>
            {loan.vehicleHint && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{loan.vehicleHint}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {fmtD(loan.balance)} outstanding · no asset linked
            </p>
          </div>
        </div>
        <button
          onClick={() => onDismiss(loan.liabilityId)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5">
          <X size={12} />
        </button>
      </div>

      <div className="flex gap-2 pl-8">
        <Input
          placeholder="Enter VIN or e.g. 2021 Toyota Camry LE"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLink()}
          className="h-7 text-xs bg-input border-border text-foreground focus-visible:ring-[var(--primary)]/50 flex-1"
        />
        <Button
          size="sm"
          onClick={handleLink}
          disabled={linking || !input.trim()}
          className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 px-3">
          {linking ? '…' : 'Value It'}
        </Button>
      </div>

      {error && (
        <p className="text-[10px] text-red pl-8">{error}</p>
      )}
    </div>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────────

export default function AssetDiscoveryBanner({
  loans,
  onLink,
  onDismiss,
}: AssetDiscoveryBannerProps) {
  if (loans.length === 0) return null;

  return (
    <div className={cn(
      'rounded-xl border border-amber/25 bg-amber-dim/25 px-4 py-1',
    )}>
      <div className="flex items-center gap-2 py-3 border-b border-border/50">
        <Badge variant="outline" className="text-[10px] border-amber/30 text-amber px-1.5 py-0 shrink-0">
          {loans.length} unlinked
        </Badge>
        <p className="text-xs font-semibold text-foreground">
          Auto loan{loans.length > 1 ? 's' : ''} detected
        </p>
        <p className="text-[10px] text-muted-foreground hidden sm:block">
          Link a vehicle to calculate true equity.
        </p>
      </div>

      <div>
        {loans.map(loan => (
          <VINInputRow
            key={loan.liabilityId}
            loan={loan}
            onLink={onLink}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}
