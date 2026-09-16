import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { isCardioSport, SPORTS, routineTotalDuration } from '../lib/sports.js'
import { glyphOf } from '../lib/glyphs.js'
import Icon from './Icon.jsx'

function subtitle(r) {
  if (isCardioSport(r.sport)) {
    const min = routineTotalDuration(r.blocks || [])
    const label = t(SPORTS[r.sport]?.label || r.sport)
    return min ? `${label} · ${min} min` : label
  }
  const n = r.ex?.length || r.items?.filter(i => i.kind === 'ex').length || 0
  const b = r.items?.filter(i => i.kind === 'block').length || 0
  if (b) return `${n} exos + ${b} cardio`
  return `${n} ${t('exercices')}`
}

export default function RoutineCard({ routine: r }) {
  const nav = useNavigate()
  const isCardio = isCardioSport(r.sport)
  const color = isCardio ? 'var(--teal)' : 'var(--acc)'
  const icon = isCardio ? (SPORTS[r.sport]?.icon || 'bolt') : glyphOf(r.emoji)
  const hasImg = !!r.imageUrl

  return (
    <div
      onClick={() => nav('/plan/r/' + r.id)}
      style={{
        position: 'relative',
        aspectRatio: '1',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        border: `2px solid color-mix(in srgb,${color} 40%,transparent)`,
        background: hasImg
          ? 'var(--surface-2)'
          : `linear-gradient(135deg, color-mix(in srgb,${color} 22%,var(--surface-2)), var(--surface-3))`,
      }}
    >
      {hasImg ? (
        <img
          src={r.imageUrl}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: 6, boxSizing: 'border-box' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} style={{ fontSize: 42, color, opacity: 0.45 }} />
        </div>
      )}

      {/* Bottom scrim */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 }}>
        <div style={{
          fontWeight: 700, fontSize: 13, lineHeight: 1.3,
          color: '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-.01em',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}>
          {r.name}
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: 'rgba(255,255,255,.75)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
          {subtitle(r)}
        </div>
      </div>
    </div>
  )
}
