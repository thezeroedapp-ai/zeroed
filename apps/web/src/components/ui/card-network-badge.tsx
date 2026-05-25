import type { CardNetwork } from '@/lib/card-designs';

interface CardNetworkBadgeProps {
  network: CardNetwork;
  /** Height in px — width is derived per-network to maintain correct proportions */
  size?: number;
  /** Render in dark mode (for light-background cards like Apple Card) */
  dark?: boolean;
}

// Inline network logos — no external CDN, no package dependency, scales cleanly.
// Sizes are calibrated for the card chip component (typical range: 14–22px height).
export default function CardNetworkBadge({ network, size = 18, dark = false }: CardNetworkBadgeProps) {
  if (network === 'mastercard') {
    // Two overlapping circles — the most recognisable payment logo at any size
    const w = Math.round(size * 1.6);
    const r = Math.round(size * 0.48);
    const cy = size / 2;
    const lx = Math.round(size * 0.44);
    const rx = Math.round(size * 1.16);
    return (
      <svg
        width={w}
        height={size}
        viewBox={`0 0 ${w} ${size}`}
        aria-label="Mastercard"
        role="img"
        style={{ display: 'block', flexShrink: 0 }}
      >
        <circle cx={lx} cy={cy} r={r} fill="#EB001B" />
        <circle cx={rx} cy={cy} r={r} fill="#F79E1B" opacity={0.92} />
      </svg>
    );
  }

  if (network === 'visa') {
    return (
      <span
        aria-label="Visa"
        style={{
          display:     'block',
          fontFamily:  '"Arial Black", "Helvetica Neue", Arial, sans-serif',
          fontWeight:  900,
          fontStyle:   'italic',
          fontSize:    Math.round(size * 0.72),
          lineHeight:  1,
          color:       dark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.95)',
          letterSpacing: '-0.03em',
          textShadow:  dark ? 'none' : '0 1px 3px rgba(0,0,0,0.4)',
          userSelect:  'none',
        }}
      >
        VISA
      </span>
    );
  }

  if (network === 'amex') {
    return (
      <span
        aria-label="American Express"
        style={{
          display:       'block',
          fontFamily:    'Arial, sans-serif',
          fontWeight:    700,
          fontSize:      Math.round(size * 0.58),
          lineHeight:    1,
          color:         dark ? 'rgba(0,0,0,0.70)' : 'rgba(255,255,255,0.92)',
          letterSpacing: '0.06em',
          textShadow:    dark ? 'none' : '0 1px 2px rgba(0,0,0,0.35)',
          userSelect:    'none',
        }}
      >
        AMEX
      </span>
    );
  }

  if (network === 'discover') {
    // "DISC" + signature orange dot — compact enough for chip sizes
    const dotSize = Math.round(size * 0.52);
    return (
      <span
        aria-label="Discover"
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        Math.round(size * 0.12),
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily:    'Arial, sans-serif',
            fontWeight:    700,
            fontSize:      Math.round(size * 0.52),
            lineHeight:    1,
            color:         dark ? 'rgba(0,0,0,0.70)' : 'rgba(255,255,255,0.92)',
            letterSpacing: '0.04em',
            textShadow:    dark ? 'none' : '0 1px 2px rgba(0,0,0,0.35)',
          }}
        >
          DISC
        </span>
        <span
          style={{
            display:      'block',
            width:        dotSize,
            height:       dotSize,
            borderRadius: '50%',
            background:   'linear-gradient(135deg, #F76B1C, #F5A020)',
            flexShrink:   0,
          }}
        />
      </span>
    );
  }
}
