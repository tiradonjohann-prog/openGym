import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { MONTHS_LONG, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { WorkoutRow, workoutDetailSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'

export default function History() {
  const nav = useNavigate()
  const S = useStore(s => s.S)

  const reversed = [...S.workouts].reverse()
  const monthKeys = []
  const byMonth = new Map()
  reversed.forEach(w => {
    const key = w.d.slice(0, 7)
    if (!byMonth.has(key)) { byMonth.set(key, []); monthKeys.push(key) }
    byMonth.get(key).push(w)
  })
  const fmtMonth = key => {
    const [y, m] = key.split('-')
    return t(MONTHS_LONG[parseInt(m, 10) - 1]) + ' ' + y
  }

  return <>
    <div className="hdr">
      <button className="iconbtn" onClick={() => window.history.state?.idx > 0 ? nav(-1) : nav('/stats', { replace: true })} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 12 }}>
        <h1>{t('History')}</h1>
        <div className="sub">{t('{0} workouts', S.workouts.length)}</div>
      </div>
    </div>

    {S.workouts.length ? (
      <div className="list">
        {monthKeys.map(key => {
          const ws = byMonth.get(key)
          const totalVol = ws.reduce((s, w) => s + (w.vol || 0), 0)
          const totalPRs = ws.reduce((s, w) => s + (w.prs?.length || 0), 0)
          return (
            <div key={key}>
              {/* Month header */}
              <div style={{ padding: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--label-2)' }}>
                  {fmtMonth(key)}
                </span>
                <span style={{ background: 'color-mix(in srgb,var(--acc) 14%,var(--surface-2))', color: 'var(--acc)', borderRadius: 99, padding: '1px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '.01em' }}>
                  {ws.length}
                </span>
                <div style={{ flex: 1 }} />
                {totalVol > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--label-3)', fontWeight: 500 }}>
                    {fmtNum(totalVol)} {S.unit}
                  </span>
                )}
                {totalPRs > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--yellow)', fontWeight: 700 }}>
                    <Icon name="trophy" style={{ fontSize: 10 }} />
                    {totalPRs}
                  </span>
                )}
              </div>
              {ws.map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />)}
            </div>
          )
        })}
      </div>
    ) : (
      <div className="empty"><div className="ico"><Icon name="history" /></div>{t('No workouts yet.')}</div>
    )}
  </>
}
