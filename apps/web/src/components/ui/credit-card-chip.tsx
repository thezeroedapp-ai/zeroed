import { cn } from '@/lib/utils';
import { getInstitutionBrandColor, getInstitutionDomain, logoUrl } from '@/lib/institution-logos';
import { useState } from 'react';

interface CreditCardChipProps {
  /** The account name — e.g. "Chase Sapphire Preferred". Used as display label + logo fallback. */
  cardName: string;
  /** The Plaid institution name — e.g. "Chase". Primary source for brand color + logo. */
  institutionName?: string;
  /** Height in px. Width is auto-derived from standard card ratio (1.586 : 1). */
  size?: number;
  className?: string;
}

// Renders a miniature credit card chip with brand gradient + institution logo.
// Standard card ratio (85.6 × 53.98 mm → 1.586 : 1) scaled to the requested height.
export default function CreditCardChip({
  cardName,
  institutionName,
  size = 32,
  className,
}: CreditCardChipProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  const lookupName  = institutionName || cardName;
  const brandColor  = getInstitutionBrandColor(lookupName) ?? '#1C2B4A';
  const domain      = getInstitutionDomain(lookupName);
  const url         = domain ? logoUrl(domain) : null;

  const width    = Math.round(size * 1.586);
  const logoSize = Math.round(size * 0.52);

  return (
    <div
      className={cn('relative shrink-0 overflow-hidden', className)}
      style={{
        width,
        height:       size,
        borderRadius: Math.round(size * 0.14),
        background:   `linear-gradient(135deg, ${brandColor}EE 0%, ${brandColor} 100%)`,
      }}
    >
      {/* Top-left gloss */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(140deg, rgba(255,255,255,0.18) 0%, transparent 55%)' }}
      />

      {/* EMV chip — decorative, bottom-left */}
      <div
        className="absolute"
        style={{
          left:         Math.round(size * 0.22),
          bottom:       Math.round(size * 0.18),
          width:        Math.round(size * 0.28),
          height:       Math.round(size * 0.22),
          borderRadius: Math.round(size * 0.05),
          background:   'rgba(255,255,255,0.22)',
          border:       '1px solid rgba(255,255,255,0.30)',
        }}
      />

      {/* Institution logo — bottom-right */}
      {url && !logoFailed ? (
        <img
          src={url}
          alt={lookupName}
          width={logoSize}
          height={logoSize}
          className="absolute object-contain"
          style={{
            right:  Math.round(size * 0.12),
            bottom: Math.round(size * 0.10),
            filter: 'brightness(0) invert(1) opacity(0.90)',
          }}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span
          className="absolute font-bold tracking-tight select-none"
          style={{
            right:      Math.round(size * 0.12),
            bottom:     Math.round(size * 0.10),
            fontSize:   Math.round(size * 0.30),
            color:      'rgba(255,255,255,0.90)',
            lineHeight: 1,
          }}
        >
          {lookupName.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}
