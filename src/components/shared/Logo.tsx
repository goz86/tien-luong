export function Logo() {
  return (
    <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '62px', height: '62px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 14px rgba(39,82,255,0.18)' }}>
        <img src="/logo.png" alt="Duhoc Mate Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <span style={{
        fontSize: '26px',
        fontWeight: 900,
        letterSpacing: '-0.03em',
        color: '#0f172a',
        lineHeight: 1.2,
      }} className="logo-text">
        Duhoc Mate
      </span>
      <style>{`
        .dark .logo-text { color: #ffffff !important; }
      `}</style>
    </div>
  );
}
