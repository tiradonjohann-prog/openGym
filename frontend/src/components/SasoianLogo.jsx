// Sasoian brand assets — mark, wordmark, and full lockup.
// Colors are hardcoded (brand values, not theme tokens).

const RED   = '#d0242f'
const GREEN = '#4a8f3c'
const INK   = '#181614'
const DARK  = '#201e1d'

// The custom "I" glyph: green pill top + red stem + green pill bottom
function ILettermark({ width, height }) {
  return (
    <svg width={width} height={height} viewBox="0 0 40 100" preserveAspectRatio="none" aria-hidden="true" style={{ display: 'inline-block', flexShrink: 0 }}>
      <rect x="2" y="2" width="36" height="22" rx="11" fill={GREEN} />
      <ellipse cx="14" cy="9" rx="8" ry="5" fill="#fff" opacity="0.22" />
      <rect x="15" y="24" width="10" height="52" rx="5" fill={RED} />
      <rect x="16.5" y="27" width="3" height="46" rx="1.5" fill="#fff" opacity="0.2" />
      <rect x="2" y="76" width="36" height="22" rx="11" fill={GREEN} />
      <ellipse cx="14" cy="83" rx="8" ry="5" fill="#fff" opacity="0.22" />
    </svg>
  )
}

// Square app icon mark
export function SasoianMark({ size = 64, style }) {
  const r = Math.round(size * 0.22)
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 100 100"
      style={{ borderRadius: r, display: 'block', flexShrink: 0, ...style }}
      role="img"
      aria-label="Sasoian"
    >
      <rect x="0" y="0" width="100" height="100" rx="20" fill={RED} />
      <rect x="-20" y="41" width="140" height="18" transform="rotate(45 50 50)" fill={GREEN} />
      <rect x="-20" y="41" width="140" height="18" transform="rotate(-45 50 50)" fill={GREEN} />
      <rect x="42" y="0" width="16" height="100" fill="#fff" />
      <rect x="0" y="42" width="100" height="16" fill="#fff" />
      <rect x="2.5" y="2.5" width="95" height="95" rx="18" fill="none" stroke={INK} strokeWidth="5" />
    </svg>
  )
}

// Text wordmark: SASO[I-mark]AN
export function SasoianWordmark({ fontSize = 36, color = 'var(--label)' }) {
  const markH = Math.round(fontSize * 0.8)
  const markW = Math.round(markH * 0.62)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: "'Archivo', system-ui, sans-serif",
      fontWeight: 900,
      fontSize,
      letterSpacing: '-0.01em',
      lineHeight: 1,
      color,
    }}>
      <span>SASO</span>
      <ILettermark width={markW} height={markH} />
      <span>AN</span>
    </span>
  )
}

// Full logo lockup: mark + wordmark + optional tagline
export function SasoianLockup({ markSize = 72, fontSize = 48, showTagline = false }) {
  const markH = Math.round(fontSize * 0.8)
  const markW = Math.round(markH * 0.62)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <SasoianMark size={markSize} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          fontFamily: "'Archivo', system-ui, sans-serif",
          fontWeight: 900,
          fontSize,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          color: 'var(--label)',
        }}>
          <span>SASO</span>
          <ILettermark width={markW} height={markH} />
          <span>AN</span>
        </span>
        {showTagline && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <div style={{ height: 4, width: 28, borderRadius: 3, background: GREEN, flexShrink: 0 }} />
            <span style={{
              fontFamily: "'Archivo', system-ui, sans-serif",
              fontWeight: 600, fontSize: 13,
              letterSpacing: '0.01em', color: 'var(--label-2)',
            }}>
              Sois en forme, reste en forme
            </span>
            <div style={{ height: 4, width: 28, borderRadius: 3, background: RED, flexShrink: 0 }} />
          </div>
        )}
      </div>
    </div>
  )
}
