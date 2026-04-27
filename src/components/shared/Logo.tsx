export function Logo() {
  return (
    <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
        <img src="/logo.png" alt="Duhoc Mate Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.15)' }} />
      </div>
      <span style={{
        fontSize: '22px',
        fontWeight: 900,
        letterSpacing: '-0.03em',
        background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }} className="dark-text-gradient">
        Duhoc Mate
      </span>
      <style>{`
        .dark .dark-text-gradient {
          background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
        }
      `}</style>
    </div>
  );
}
