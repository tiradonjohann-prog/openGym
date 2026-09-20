// Body measurement diagram — each gender has its own reference image (front +
// back view side by side), picked from the profile's sex, not a manual toggle.
// The silhouette column is fluid (CSS aspect-ratio, no fixed pixel width) so it
// fills the available sheet width on any screen — bigger on desktop, still
// unclipped on a narrow phone — and is never cropped or stretched: its box
// always matches the source image's own ratio exactly.

import { useStore } from '../store/useStore.js'
import { MEASURE_COLORS } from '../lib/measurements.js'

const SRC = {
  male:   { url: '/mensurations-homme.png', w: 577, h: 433 },
  female: { url: '/mensurations-femme.png', w: 438, h: 570 },
}

// ── Measurement field definitions ────────────────────────────────────────────
// xSide: which side the label appears on — order within a side is top-to-bottom.
const FIELDS = [
  { key: 'chest', label: 'Poitrine', xSide: 'left'  },
  { key: 'arm',   label: 'Bras',     xSide: 'left'  },
  { key: 'thigh', label: 'Cuisse',   xSide: 'left'  },
  { key: 'hips',  label: 'Hanches',  xSide: 'right' },
  { key: 'calf',  label: 'Mollet',   xSide: 'right' },
]

// Fixed width for each input column; the silhouette takes the rest of the row.
const SIDE_W = 96
// Fixed silhouette height — kept constant regardless of screen width so the
// gap between fields (and thus overlap risk) never depends on viewport size.
// Width follows from the source image's own aspect ratio (no crop, no stretch).
const DISP_H = 300

// ── Silhouette image ─────────────────────────────────────────────────────────
function BodySilhouette({ gender }) {
  const src = SRC[gender]
  return (
    <div style={{ flex: '0 0 auto', height: DISP_H, aspectRatio: `${src.w} / ${src.h}`, borderRadius: 12, overflow: 'hidden' }}>
      <img
        src={src.url}
        alt={gender === 'female' ? 'Femme' : 'Homme'}
        draggable={false}
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', userSelect: 'none', WebkitUserDrag: 'none' }}
      />
    </div>
  )
}

// ── Input column ─────────────────────────────────────────────────────────────
// Evenly distributed top-to-bottom — no overlay line to align with anymore,
// so a plain, harmonious spacing (equal gaps, generous padding) reads better
// than cramming fields toward an anatomical height.
function InputColumn({ side, values, onChange }) {
  const colFields = FIELDS.filter(f => f.xSide === side)
  const isLeft    = side === 'left'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly',
      flex: `0 0 ${SIDE_W}px`, width: SIDE_W, alignSelf: 'stretch', padding: '8px 0',
    }}>
      {colFields.map(f => {
        const color  = MEASURE_COLORS[f.key] || 'var(--acc)'
        const active = values[f.key] != null && values[f.key] !== ''

        return (
          <div key={f.key} style={{ padding: isLeft ? '0 12px 0 0' : '0 0 0 12px' }}>
            <div style={{
              fontSize: 12, fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '.05em', color, lineHeight: 1,
              marginBottom: 6, whiteSpace: 'nowrap',
              textAlign: isLeft ? 'right' : 'left',
            }}>
              {f.label}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              flexDirection: isLeft ? 'row-reverse' : 'row',
            }}>
              <span style={{ fontSize: 12, color: 'var(--label-4)', flexShrink: 0 }}>cm</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={values[f.key] ?? ''}
                onChange={e => onChange(f.key, e.target.value)}
                placeholder="—"
                style={{
                  width: '100%', minWidth: 0,
                  background: active
                    ? `color-mix(in srgb,${color} 18%,var(--surface))`
                    : `color-mix(in srgb,${color} 8%,var(--surface))`,
                  border: `1.5px solid color-mix(in srgb,${color} ${active ? 55 : 22}%,transparent)`,
                  borderRadius: 8, padding: '8px 6px',
                  fontSize: 16, fontWeight: 700, color: 'var(--label)',
                  textAlign: 'center', outline: 'none',
                  transition: 'background .2s, border-color .2s',
                  WebkitAppearance: 'none', MozAppearance: 'textfield',
                  pointerEvents: 'auto',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BodyMeasureMap({ values, onChange }) {
  const S      = useStore(s => s.S)
  const gender = S.nutrition?.sex === 'female' ? 'female' : 'male'

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 0, width: 'fit-content', margin: '0 auto' }}>
        <InputColumn side="left" values={values} onChange={onChange} />
        <BodySilhouette gender={gender} />
        <InputColumn side="right" values={values} onChange={onChange} />
      </div>
    </div>
  )
}
