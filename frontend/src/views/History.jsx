import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { MONTHS_LONG } from '../lib/format.js'
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
    <div className="hdr"><button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 12 }}><h1>{t('History')}</h1><div className="sub">{t('{0} workouts', S.workouts.length)}</div></div></div>
    {S.workouts.length ? (
      <div className="list">
        {monthKeys.map(key => (
          <div key={key}>
            <div className="month-hd">{fmtMonth(key)} <span className="month-hd-count">{byMonth.get(key).length}</span></div>
            {byMonth.get(key).map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />)}
          </div>
        ))}
      </div>
    ) : <div className="empty"><div className="ico"><Icon name="history" /></div>{t('No workouts yet.')}</div>}
  </>
}
