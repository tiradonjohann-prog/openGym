// Circular gauge built from two SVG <circle> elements.
// The fill circle animates stroke-dashoffset on value change.
// Color state is applied via a CSS class so the transition stays in CSS.

function gaugeClass(pct) {
  if (pct > 1.15) return 'gauge-max'
  if (pct > 1.00) return 'gauge-over'
  if (pct >= 0.75) return 'gauge-ok'
  return ''   // below 75% → use the nutrient's own colour (--nut-*)
}

export default function NutriRing({ value, max, color, size = 120, label, unit = 'kcal' }) {
  const radius  = (size - 14) / 2    // 7px stroke on each side
  const circ    = 2 * Math.PI * radius
  const pct     = max > 0 ? Math.min(value / max, 1.5) : 0
  const offset  = circ * (1 - Math.min(pct, 1))
  const cls     = gaugeClass(value / (max || 1))

  const centerX = size / 2
  const centerY = size / 2

  return (
    <div className={'nring-wrap ' + cls} style={{ width: size }}>
      <div className="nring" style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="meter"
          aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}
          aria-label={`${label || unit}: ${Math.round(value)} of ${max}`}
        >
          {/* background track */}
          <circle
            className="nring-track"
            cx={centerX} cy={centerY} r={radius}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={8}
          />
          {/* animated fill */}
          <circle
            className="nring-fill"
            cx={centerX} cy={centerY} r={radius}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${centerX} ${centerY})`}
          />
        </svg>
        {/* center text */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: size * 0.175, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--label)' }}>
            {Math.round(value)}
          </span>
          <span style={{ fontSize: size * 0.1, color: 'var(--label-3)', lineHeight: 1.2, marginTop: 2 }}>
            {unit}
          </span>
        </div>
      </div>
      {label && <span className="nring-label">{label}</span>}
    </div>
  )
}
