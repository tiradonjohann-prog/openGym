// Segmented donut ring: protein → carbs → fat, clockwise from top.
// Each arc is proportional to its calorie contribution vs daily target.
// Gaps between segments are 2° so adjacent colours stay visually distinct.

import { t } from '../lib/i18n.js'
import { fmtNum } from '../lib/format.js'

const GAP_DEG = 2

function arc({ pct, circ, startDeg, color, cx, cy, r }) {
  if (pct <= 0) return null
  const gapArc  = (GAP_DEG / 360) * circ
  const fullArc = pct * circ
  const drawLen = Math.max(0, fullArc - gapArc)
  if (drawLen < 1) return null
  return (
    <circle
      cx={cx} cy={cy} r={r}
      fill="none" stroke={color} strokeWidth={8} strokeLinecap="butt"
      strokeDasharray={`${drawLen} ${circ - drawLen}`}
      transform={`rotate(${startDeg} ${cx} ${cy})`}
      style={{ transition: 'stroke-dasharray 400ms ease' }}
    />
  )
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--label-2)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} aria-hidden="true" />
      {label}
    </span>
  )
}

export default function MacroDonut({ kcal = 0, target, prot = 0, carbs = 0, fat = 0, size = 148 }) {
  const r    = (size - 14) / 2
  const circ = 2 * Math.PI * r
  const cx   = size / 2
  const cy   = size / 2

  const protKcal  = Math.round((prot  || 0) * 4)
  const carbsKcal = Math.round((carbs || 0) * 4)
  const fatKcal   = Math.round((fat   || 0) * 9)

  // Scale relative to target (or actual if no target or over target)
  const cap = Math.max(target || 2000, kcal, 1)

  // Clamp segments so they never exceed the ring
  const pPct = Math.min(protKcal  / cap, 1)
  const cPct = Math.min(carbsKcal / cap, 1 - pPct)
  const fPct = Math.min(fatKcal   / cap, 1 - pPct - cPct)

  // Rotation offsets (degrees), starting from the top (-90°)
  const pStart = -90
  const cStart = -90 + pPct * 360
  const fStart = -90 + (pPct + cPct) * 360

  const hasMacros = protKcal + carbsKcal + fatKcal > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{ position: 'relative', width: size, height: size }}
        role="img"
        aria-label={`${Math.round(kcal)} kcal — ${t('Protein')} ${Math.round(prot)}g, ${t('Carbohydrates')} ${Math.round(carbs)}g, ${t('Fat')} ${Math.round(fat)}g`}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          {/* background track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={8} />
          {/* macro segments */}
          {arc({ pct: pPct, circ, startDeg: pStart, color: 'var(--nut-prot)',  cx, cy, r })}
          {arc({ pct: cPct, circ, startDeg: cStart, color: 'var(--nut-carbs)', cx, cy, r })}
          {arc({ pct: fPct, circ, startDeg: fStart, color: 'var(--nut-fat)',   cx, cy, r })}
        </svg>

        {/* center: total kcal */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: size * 0.175, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--label)' }}>
            {Math.round(kcal)}
          </span>
          <span style={{ fontSize: size * 0.09, color: 'var(--label-3)', lineHeight: 1.4, marginTop: 2 }}>
            kcal
          </span>
          {target > 0 && (
            <span style={{ fontSize: size * 0.083, color: 'var(--label-4)', lineHeight: 1.3 }}>
              / {fmtNum(target)}
            </span>
          )}
        </div>
      </div>

      {/* macro legend */}
      {hasMacros && (
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {protKcal  > 0 && <LegendDot color="var(--nut-prot)"  label={`${Math.round(prot)}g P`} />}
          {carbsKcal > 0 && <LegendDot color="var(--nut-carbs)" label={`${Math.round(carbs)}g C`} />}
          {fatKcal   > 0 && <LegendDot color="var(--nut-fat)"   label={`${Math.round(fat)}g F`} />}
        </div>
      )}

      {/* remaining kcal */}
      {target > 0 && (
        <p style={{ marginTop: 6, fontSize: 13, color: kcal > target ? 'var(--orange)' : 'var(--label-3)' }}>
          {kcal > target
            ? `+${fmtNum(Math.round(kcal - target))} kcal ${t('over target')}`
            : `${fmtNum(Math.max(0, Math.round(target - kcal)))} kcal ${t('remaining')}`
          }
        </p>
      )}
    </div>
  )
}
