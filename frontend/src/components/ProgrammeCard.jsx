import { t } from '../lib/i18n.js'
import { isProgrammeComplete, completedWeekCount } from '../lib/programme.js'
import { programmeEditSheet, deleteProgramme } from '../sheets.jsx'
import Icon from './Icon.jsx'

export default function ProgrammeCard({ prog }) {
  const complete = isProgrammeComplete(prog)
  const doneWeeks = completedWeekCount(prog)
  const progressPct = prog.totalWeeks > 0 ? doneWeeks / prog.totalWeeks : 0
  const sessionCount = prog.routineIds.length
  const hasImg = !!prog.imageUrl

  return (
    <div
      onClick={() => programmeEditSheet(prog)}
      style={{
        position: 'relative',
        aspectRatio: '1',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        border: !complete
          ? '2px solid color-mix(in srgb,var(--acc) 60%,transparent)'
          : '2px solid var(--sep)',
        background: hasImg
          ? 'var(--surface-2)'
          : 'linear-gradient(135deg, color-mix(in srgb,var(--acc) 20%,var(--surface-2)), var(--surface-3))',
        opacity: complete ? 0.75 : 1,
      }}
    >
      {hasImg && (
        <img
          src={prog.imageUrl}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: 6, boxSizing: 'border-box' }}
        />
      )}

      {/* Bottom scrim so text stays readable */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.65) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Status badge */}
      <div style={{
        position: 'absolute', top: 8, left: 8,
        background: !complete ? 'var(--acc)' : 'rgba(100,100,100,0.55)',
        color: !complete ? 'var(--on-acc)' : '#fff',
        fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.09em',
        padding: '3px 7px', borderRadius: 5, backdropFilter: 'blur(4px)',
      }}>
        {complete ? t('Terminé') : t('Actif')}
      </div>

      {/* Delete button */}
      <button
        className="iconbtn"
        style={{
          position: 'absolute', top: 5, right: 5,
          width: 36, height: 36, fontSize: 13,
          color: hasImg ? 'rgba(255,255,255,0.85)' : 'var(--red)',
          background: hasImg ? 'rgba(0,0,0,0.35)' : 'transparent',
          borderRadius: 8,
        }}
        aria-label={t('Delete')}
        onClick={e => { e.stopPropagation(); deleteProgramme(prog.id) }}
      >
        <Icon name="trash" />
      </button>

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 }}>
        <div style={{
          fontWeight: 700, fontSize: 13, lineHeight: 1.3,
          color: '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-.01em',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}>
          {prog.name}
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: 'rgba(255,255,255,.75)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
          {complete
            ? t('{0} sem. — terminé', prog.totalWeeks)
            : `S${prog.currentWeek}/${prog.totalWeeks}`
          }{' · '}{sessionCount} {t('séances')}
        </div>
        {!complete && (
          <div style={{ height: 3, background: 'rgba(255,255,255,.25)', borderRadius: 99, marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--acc)', width: (Math.min(1, progressPct) * 100) + '%', borderRadius: 99 }} />
          </div>
        )}
      </div>
    </div>
  )
}
