interface SubNavTab { id: string; label: string; }

export default function SubNav({ tabs, active, onChange }: {
  tabs: SubNavTab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="pills" style={{ marginBottom: 16 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          className={`pill ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
