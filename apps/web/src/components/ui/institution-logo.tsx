import { useState } from 'react';
import { cn } from '@/lib/utils';
import AvatarCircle from './avatar-circle';
import { getInstitutionDomain, getInstitutionBrandColor, logoUrl } from '@/lib/institution-logos';

interface InstitutionLogoProps {
  name: string;
  size?: number;
  className?: string;
}

// Fills the circle with the logo image. Logos that carry their own background (Toyota red,
// Chase blue, Honda dark) cover the circle naturally. Transparent logos (Citi, Marcus) sit
// on the brand color fill so they never float without context.
export default function InstitutionLogo({ name, size = 32, className }: InstitutionLogoProps) {
  const [failed, setFailed] = useState(false);
  const domain     = getInstitutionDomain(name);
  const brandColor = getInstitutionBrandColor(name);
  const url        = domain ? logoUrl(domain) : null;

  if (!url || failed) {
    return <AvatarCircle name={name} size={size} color={brandColor ?? undefined} />;
  }

  return (
    <div
      className={cn('rounded-full shrink-0 overflow-hidden', className)}
      style={{ width: size, height: size, background: brandColor ?? 'rgba(255,255,255,0.08)' }}>
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
