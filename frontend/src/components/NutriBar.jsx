// Horizontal macro progress bar.
// Shows name + value/target and a filled track colored by the nutrient token.
// Picks up gauge-over / gauge-max classes for over-target states.

function gaugeClass(pct) {
  if (pct > 1.15) return 'gauge-max'
  if (pct > 1.00) return 'gauge-over'
  return ''
}

export default function NutriBar({ label, value, max, color, unit = 'g', important = false }) {
  const pct    = max > 0 ? Math.min(value / max, 1) : 0
  const pctRaw = max > 0 ? value / max : 0
  const cls    = gaugeClass(pctRaw)

  const val  = unit === 'g'
    ? (Math.round(value * 10) / 10) + ' g'
    : Math.round(value) + ' ' + unit
  const tgt  = unit === 'g'
    ? (Math.round(max * 10) / 10) + ' g'
    : Math.round(max) + ' ' + unit

  return (
    <div className={'nbar ' + cls} role="meter"
      aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}
      aria-label={`${label}: ${val} of ${tgt}`}
    >
      <div className="nbar-head">
        <span className="nbar-title" style={important ? { color: 'var(--label)' } : undefined}>
          {label}
        </span>
        <span className="nbar-value">{val} / {tgt}</span>
      </div>
      <div className="nbar-track">
        <div
          className="nbar-fill"
          style={{ width: (pct * 100).toFixed(1) + '%', background: color }}
        />
      </div>
    </div>
  )
}
