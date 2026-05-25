import { useState } from 'react';
import { cn } from '@/lib/utils';
import { resolveCardDesign } from '@/lib/card-designs';
import { getInstitutionBrandColor, getInstitutionDomain, logoUrl } from '@/lib/institution-logos';
import CardNetworkBadge from './card-network-badge';

interface CreditCardChipProps {
  /** Account name from Plaid — e.g. "Chase Sapphire Preferred® Card" */
  cardName: string;
  /** Institution name from Plaid — e.g. "Chase". Used as secondary matching signal. */
  institutionName?: string;
  /** Card height in px. Width is auto-derived from standard 1.586:1 card ratio. */
  size?: number;
  className?: string;
}

// Standard credit card aspect ratio: 85.6 × 53.98 mm
const CARD_RATIO = 1.586;

export default function CreditCardChip({
  cardName,
  institutionName,
  size = 32,
  className,
}: CreditCardChipProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  const design  = resolveCardDesign(cardName, institutionName);
  const width   = Math.round(size * CARD_RATIO);
  const radius  = Math.round(size * 0.14);

  // Fallback brand color + logo — used when no specific card design is matched
  const lookupName   = institutionName ?? cardName;
  const brandColor   = getInstitutionBrandColor(lookupName) ?? '#1C2B4A';
  const domain       = getInstitutionDomain(lookupName);
  const fallbackUrl  = domain ? logoUrl(domain) : null;
  const fallbackLogo = fallbackUrl && !logoFailed;

  const gradient = design?.gradient
    ?? `linear-gradient(135deg, ${brandColor}EE 0%, ${brandColor} 100%)`;

  const isDark = design?.darkText ?? false;

  // Chip + text decoration colors
  const chipBg     = isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.22)';
  const chipBorder = isDark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.30)';

  // Network badge height — proportional to card height
  const badgeSize = Math.round(size * 0.46);

  return (
    <div
      className={cn('relative shrink-0 overflow-hidden select-none', className)}
      style={{ width, height: size, borderRadius: radius, background: gradient }}
    >
      {/* ── Sheen overlay ───────────────────────────────────────────────── */}
      {design?.shimmer === 'brushed' ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'linear-gradient(140deg, rgba(255,255,255,0.13) 0%, transparent 50%)',
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.028) 2px, rgba(255,255,255,0.028) 3px)',
            ].join(', '),
          }}
        />
      ) : (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(140deg, rgba(255,255,255,0.20) 0%, transparent 55%)' }}
        />
      )}

      {/* ── EMV chip (decorative) ────────────────────────────────────────── */}
      <div
        className="absolute"
        style={{
          left:         Math.round(size * 0.20),
          bottom:       Math.round(size * 0.20),
          width:        Math.round(size * 0.28),
          height:       Math.round(size * 0.22),
          borderRadius: Math.round(size * 0.05),
          background:   chipBg,
          border:       `1px solid ${chipBorder}`,
        }}
      />

      {/* ── Bottom-right: network badge (matched) or institution logo (fallback) ── */}
      <div
        className="absolute"
        style={{
          right:  Math.round(size * 0.10),
          bottom: Math.round(size * 0.12),
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {design?.network ? (
          <CardNetworkBadge network={design.network} size={badgeSize} dark={isDark} />
        ) : fallbackLogo ? (
          <img
            src={fallbackUrl}
            alt={lookupName}
            width={Math.round(size * 0.46)}
            height={Math.round(size * 0.46)}
            className="object-contain"
            style={{ filter: 'brightness(0) invert(1) opacity(0.85)' }}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          // Last-resort text initials
          <span
            style={{
              fontFamily: 'Arial, sans-serif',
              fontWeight: 700,
              fontSize:   Math.round(size * 0.32),
              lineHeight: 1,
              color:      isDark ? 'rgba(0,0,0,0.60)' : 'rgba(255,255,255,0.80)',
              letterSpacing: '0.02em',
              userSelect: 'none',
            }}
          >
            {lookupName.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}
