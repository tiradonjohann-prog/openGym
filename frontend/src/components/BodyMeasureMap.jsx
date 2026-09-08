// Body measurement diagram — uses anatomy-ref.png for realistic silhouettes.
// Crops front-view (male or female) from the reference sheet.
// Image layout: 1536×1024 — top half = light mode, bottom half = dark mode.
// Each half has 4 male views then 4 female views across the width.

import { useStore } from '../store/useStore.js'
import { MEASURE_COLORS } from '../lib/measurements.js'

// ── Crop positions in the source image (1536×1024) ───────────────────────────
// Layout: 8 equal slots (1536/8 = 192px) — 4 male views then 4 female views.
// FACE = slot 1 (male, x=0) and slot 5 (female, x=768).
const IMG_SRC_W = 1536
const IMG_SRC_H = 1024

const CROP = {
  male:   { x: 0,   w: 185 },   // slot 1: male FACE view
  female: { x: 768, w: 185 },   // slot 5: female FACE view
  light:  { y: 52,  h: 430 },   // below "MODE CLAIR" header
  dark:   { y: 564, h: 430 },   // below "MODE SOMBRE" header
}

// ── Measurement field definitions ────────────────────────────────────────────
// yPct: position of the measurement line as % of the silhouette height (displayed)
// xSide: which side the label appears on
const FIELDS = [
  { key: 'chest', label: 'Poitrine', yPct: 22, xSide: 'left'  },
  { key: 'waist', label: 'Taille',   yPct: 37, xSide: 'right' },
  { key: 'hips',  label: 'Hanches',  yPct: 51, xSide: 'right' },
  { key: 'arm',   label: 'Bras',     yPct: 35, xSide: 'left'  },
  { key: 'thigh', label: 'Cuisse',   yPct: 63, xSide: 'left'  },
  { key: 'calf',  label: 'Mollet',   yPct: 79, xSide: 'right' },
]

// Displayed silhouette dimensions
const DISP_W = 130   // rendered width of the silhouette
const DISP_H = 330   // rendered height

// ── Silhouette image crop ────────────────────────────────────────────────────
function BodySilhouette({ gender, isDark }) {
  const cropX = CROP[gender].x
  const cropY = isDark ? CROP.dark.y : CROP.light.y
  const cropW = CROP[gender].w
  const cropH = isDark ? CROP.dark.h : CROP.light.h

  // Scale factor to fit cropped figure into DISP_W × DISP_H
  const scaleX = DISP_W / cropW
  const scaleY = DISP_H / cropH
  // Use the smaller scale so the figure fits within the display box
  const scale  = Math.min(scaleX, scaleY)

  const displayedW = cropW * scale
  const displayedH = cropH * scale

  // Position the full image so the crop window aligns with the container origin
  const imgW = IMG_SRC_W * scale
  const imgH = IMG_SRC_H * scale
  const imgLeft = -(cropX * scale) + (DISP_W - displayedW) / 2
  const imgTop  = -(cropY * scale) + (DISP_H - displayedH) / 2

  return (
    <div style={{
      width: DISP_W, height: DISP_H,
      overflow: 'hidden', position: 'relative', flexShrink: 0,
      borderRadius: 10,
    }}>
      <img
        src="/anatomy-ref.png"
        alt={gender === 'female' ? 'Femme' : 'Homme'}
        draggable={false}
        style={{
          position: 'absolute',
          width: imgW,
          height: imgH,
          top: imgTop,
          left: imgLeft,
          userSelect: 'none',
          WebkitUserDrag: 'none',
        }}
      />
    </div>
  )
}

// ── Gender selector ──────────────────────────────────────────────────────────
function GenderPicker({ gender, onChange, isDark }) {
  const options = ['male', 'female']
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
      {options.map(g => {
        const isSelected = gender === g
        return (
          <button
            key={g}
            onClick={() => onChange(g)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}
            aria-pressed={isSelected}
            aria-label={g === 'male' ? 'Homme' : 'Femme'}
          >
            {/* Mini silhouette thumbnail */}
            <div style={{
              borderRadius: 10,
              border: isSelected
                ? '2.5px solid var(--acc)'
                : '2px solid transparent',
              overflow: 'hidden',
              transition: 'border-color .18s',
              boxShadow: isSelected
                ? '0 0 0 3px color-mix(in srgb,var(--acc) 22%,transparent)'
                : 'none',
            }}>
              <SmallSilhouette gender={g} isDark={isDark} />
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '.05em',
              textTransform: 'uppercase',
              color: isSelected ? 'var(--acc)' : 'var(--label-3)',
              transition: 'color .18s',
            }}>
              {g === 'male' ? 'Homme' : 'Femme'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Small thumbnail (60×76) for the gender picker buttons
function SmallSilhouette({ gender, isDark }) {
  const THUMB_W = 60
  const THUMB_H = 76

  const cropX = CROP[gender].x
  const cropY = isDark ? CROP.dark.y : CROP.light.y
  const cropW = CROP[gender].w
  const cropH = isDark ? CROP.dark.h : CROP.light.h

  const scale  = Math.min(THUMB_W / cropW, THUMB_H / cropH)
  const displayedW = cropW * scale
  const displayedH = cropH * scale
  const imgW = IMG_SRC_W * scale
  const imgH = IMG_SRC_H * scale
  const imgLeft = -(cropX * scale) + (THUMB_W - displayedW) / 2
  const imgTop  = -(cropY * scale) + (THUMB_H - displayedH) / 2

  return (
    <div style={{ width: THUMB_W, height: THUMB_H, overflow: 'hidden', position: 'relative' }}>
      <img
        src="/anatomy-ref.png"
        alt=""
        draggable={false}
        style={{
          position: 'absolute', width: imgW, height: imgH,
          top: imgTop, left: imgLeft, userSelect: 'none', WebkitUserDrag: 'none',
        }}
      />
    </div>
  )
}

// ── Measurement overlay ──────────────────────────────────────────────────────
function MeasurementOverlay({ values, onChange }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {FIELDS.map(f => {
        const color   = MEASURE_COLORS[f.key] || 'var(--acc)'
        const active  = values[f.key] != null && values[f.key] !== ''
        const topPx   = f.yPct / 100 * DISP_H
        const isLeft  = f.xSide === 'left'

        return (
          <div key={f.key} style={{
            position: 'absolute',
            top: topPx,
            transform: 'translateY(-50%)',
            left: 0, right: 0,
            display: 'flex', alignItems: 'center',
            pointerEvents: 'none',
          }}>
            {/* Dashed line across full width */}
            <div style={{
              position: 'absolute', left: 0, right: 0,
              borderTop: `${active ? 1.5 : 0.8}px dashed ${color}`,
              opacity: active ? 0.75 : 0.25,
            }} />
            {/* Central dot */}
            <div style={{
              position: 'absolute',
              left: '50%', transform: 'translateX(-50%)',
              width: active ? 8 : 5, height: active ? 8 : 5,
              borderRadius: '50%', background: color,
              opacity: active ? 1 : 0.4,
              boxShadow: active ? `0 0 0 3px color-mix(in srgb,${color} 28%,transparent)` : 'none',
              transition: 'all .2s',
            }} />
          </div>
        )
      })}
    </div>
  )
}

// ── Input column ─────────────────────────────────────────────────────────────
const SIDE_W = 72

function InputColumn({ side, values, onChange }) {
  const colFields = FIELDS.filter(f => f.xSide === side)
  const isLeft    = side === 'left'

  return (
    <div style={{ position: 'relative', width: SIDE_W, height: DISP_H, flexShrink: 0 }}>
      {colFields.map(f => {
        const color  = MEASURE_COLORS[f.key] || 'var(--acc)'
        const active = values[f.key] != null && values[f.key] !== ''
        const topPx  = f.yPct / 100 * DISP_H

        return (
          <div key={f.key} style={{
            position: 'absolute',
            top: topPx,
            left: 0, right: 0,
            transform: 'translateY(-50%)',
            padding: isLeft ? '0 6px 0 0' : '0 0 0 6px',
          }}>
            <div style={{
              fontSize: 7.5, fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '.07em', color, lineHeight: 1,
              marginBottom: 2, whiteSpace: 'nowrap',
              textAlign: isLeft ? 'right' : 'left',
            }}>
              {f.label}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2,
              flexDirection: isLeft ? 'row-reverse' : 'row',
            }}>
              <span style={{ fontSize: 8.5, color: 'var(--label-4)', flexShrink: 0 }}>cm</span>
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
                  borderRadius: 6, padding: '4px 3px',
                  fontSize: 12.5, fontWeight: 700, color: 'var(--label)',
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
  const S        = useStore(s => s.S)
  const update   = useStore(s => s.update)
  const isDark   = S.theme !== 'light'
  const gender   = S.body === 'female' ? 'female' : 'male'

  const setGender = g => update(s => { s.body = g })

  return (
    <div>
      {/* Gender picker with visual thumbnails */}
      <GenderPicker gender={gender} onChange={setGender} isDark={isDark} />

      {/* Main diagram row: [left inputs] [silhouette + overlay] [right inputs] */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0 }}>
        <InputColumn side="left" values={values} onChange={onChange} />
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <BodySilhouette gender={gender} isDark={isDark} />
          <MeasurementOverlay values={values} onChange={onChange} />
        </div>
        <InputColumn side="right" values={values} onChange={onChange} />
      </div>
    </div>
  )
}
