const PALETTE = [
  '#3b82f6', '#7c3aed', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#f97316', '#8b5cf6',
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function AvatarCircle({
  name,
  size = 36,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const bg = color ?? PALETTE[hashName(name) % PALETTE.length];
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: Math.round(size * 0.40),
        color: 'white',
        flexShrink: 0,
        letterSpacing: '-0.01em',
        userSelect: 'none',
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
