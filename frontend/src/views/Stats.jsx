import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { EXIDX } from '../lib/exercises.js'
import { lastBW, streakWeeks, setLabel, modeOf, effortOf } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, weekKey, isoOf } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { bwSheet, goalSheet, calendarSheet, workoutDetailSheet, WorkoutRow, bwDeltaColor } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Heatmap from '../components/Heatmap.jsx'
import Icon from '../components/Icon.jsx'
import BodyMap, { BodyMapLegend } from '../components/BodyMap.jsx'
import { loadOfWorkouts, rankOf, MUSCLE_NAME } from '../lib/muscles.js'
import { e1rmSeries, best1RM } from '../lib/onerm.js'
import { allTimePRs } from '../lib/prs.js'
import {
  hasEffort, displayScale, scaleName, toScale, avgRir, effortSummary, effortWeeks,
  effortHistogram, isHardSet, HARD_RIR
} from '../lib/effort.js'
import { dayCardioKcal } from '../lib/cardio.js'
import { dayTotals } from '../lib/foodSearch.js'
import { Button, Segmented, SelectRow } from '../components/ui.jsx'

/* ── colorful metric card ─────────────────────────────────────────── */
function MetricCard({ icon, label, value, sub, color, onClick }) {
  return (
    <div className={'stat-card' + (onClick ? ' tappable' : '')} style={{ '--card-color': color }} onClick={onClick}>
      <div className="stat-card__icon"><Icon name={icon} /></div>
      <div className="stat-card__val">{value}</div>
      <div className="stat-card__label">{label}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  )
}

/* ── streak ring with progress arc ───────────────────────────────── */
function StreakBadge({ weeks, thisWeek, planned }) {
  const pct = planned > 0 ? Math.min(1, thisWeek / planned) : (thisWeek > 0 ? 1 : 0)
  const r = 32, circ = 2 * Math.PI * r
  return (
    <div className="streak-badge" onClick={calendarSheet}>
      <div className="streak-badge__ring">
        <svg width={80} height={80}>
          <defs>
            <linearGradient id="streak-grad" x1="0" y1="1" x2="1" y2="0" gradientUnits="objectBoundingBox">
              <stop offset="0%" style={{ stopColor: 'var(--orange)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--yellow)' }} />
            </linearGradient>
          </defs>
          <circle cx={40} cy={40} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={6} />
          <circle cx={40} cy={40} r={r} fill="none" stroke="url(#streak-grad)" strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            transform="rotate(-90 40 40)"
            style={{ transition: 'stroke-dashoffset .7s var(--ease)', filter: pct > 0.7 ? 'drop-shadow(0 0 4px color-mix(in srgb,var(--orange) 60%,transparent))' : undefined }}
          />
        </svg>
        <div className="streak-badge__center">
          <span className="streak-badge__num">{weeks}</span>
          <span className="streak-badge__lbl">{t('wk')}</span>
        </div>
      </div>
      <div className="streak-badge__info">
        <div className="streak-badge__title">
          <Icon name="flame" style={{ color: 'var(--orange)', fontSize: 14 }} />
          {t('{0} week streak', weeks)}
        </div>
        <div className="muted small" style={{ marginTop: 3 }}>
          {thisWeek}{planned ? ' / ' + planned : ''} {t('this week')}
        </div>
        <div className="muted small" style={{ marginTop: 2 }}>
          {t('Tap to see calendar')}
        </div>
      </div>
    </div>
  )
}

/* ── muscle balance ───────────────────────────────────────────────── */
function MuscleBalance({ S }) {
  const [win, setWin] = useState(7)
  const [hard, setHard] = useState(false)
  const [sel, setSel] = useState(null)
  const now = Date.now()
  const inWin = S.workouts.filter(w =>
    win === 0 ? true
      : win === 7 ? weekKey(w.d) === weekKey(todayISO())
        : (w.start || new Date(w.d).getTime()) > now - win * 86400000)
  const rated = inWin.some(w => w.entries.some(e => e.sets.some(s => s.done && isHardSet(s))))
  const on = hard && rated
  const load = loadOfWorkouts(inWin, on ? isHardSet : null)
  const { worked, missed } = rankOf(load)
  const top = worked.slice(0, 4)
  const max = worked.length ? load[worked[0]] : 0
  const sets = m => Math.round((load[m] || 0) * 10) / 10

  return <div className="card">
    <div className="row between" style={{ marginBottom: 8 }}>
      <h2 style={{ margin: 0 }}>{t('Muscle balance')}{' '}<span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>{on ? t('by hard sets') : t('by sets worked')}</span></h2>
      {rated && <Button size="sm" icon="flame" style={on ? { color: 'var(--yellow)' } : undefined}
        onClick={() => { setHard(h => !h); setSel(null) }}>{on ? t('Hard') : t('All')}</Button>}
    </div>
    <Segmented className="seg-range" value={win} onChange={v => { setWin(v); setSel(null) }}
      options={[{ value: 7, label: t('Week') }, { value: 30, label: '30j' }, { value: 90, label: '90j' }, { value: 0, label: t('All') }]} />
    {inWin.length ? <>
      <BodyMap className="tappable" load={load} body={S.body} selected={sel}
        onMuscle={m => setSel(s => (s === m ? null : m))} />
      <BodyMapLegend />
      {sel && <div className="mrow" style={{ borderTop: 'var(--hair) solid var(--sep)', marginTop: 4, paddingTop: 10 }}>
        <span className="nm"><b>{t(MUSCLE_NAME[sel])}</b></span>
        <span className="v">{sets(sel) ? t('{0} sets', sets(sel)) : on ? t('no hard sets') : t('not trained')}</span>
      </div>}
      {!sel && top.map(m => <div key={m} className="mrow">
        <span className="nm">{t(MUSCLE_NAME[m])}</span>
        <span className="bar"><i style={{ width: Math.round(load[m] / max * 100) + '%', background: on ? 'var(--yellow)' : undefined }} /></span>
        <span className="v">{t('{0} sets', sets(m))}</span>
      </div>)}
      {missed.length > 0 && <>
        <h4 className="sec" style={{ marginTop: 12 }}>{on ? t('No hard sets in this period') : t('Not trained in this period')}</h4>
        <div className="mchips">{missed.map(m => <span key={m} className="mchip miss">{t(MUSCLE_NAME[m])}</span>)}</div>
      </>}
      {!missed.length && worked.length > 0 &&
        <div className="muted small" style={{ marginTop: 10 }}>{on
          ? t('Every muscle group got at least one hard set in this period.')
          : t('Every muscle group got some work in this period.')}</div>}
    </> : <div className="muted small">{t('No workouts in this period yet.')}</div>}
  </div>
}

/* ── effort card ──────────────────────────────────────────────────── */
function EffortCard({ S }) {
  const [win, setWin] = useState(90)
  const kind = displayScale(S)
  const hd = scaleName(kind)
  const sum = effortSummary(S, win)
  const weeks = effortWeeks(S, win)
  const hist = effortHistogram(S, win)
  const maxBin = Math.max(1, ...hist.map(b => b.n))
  const pts = weeks.map(w => ({ t: w.t, y: toScale(kind, w.rir), note: t('{0} sets', w.sets) }))
  const binLabel = b => kind === 'rpe' ? (b.tail ? '≤ 6' : String(10 - b.rir)) : (b.tail ? b.rir + '+' : String(b.rir))

  return <div className="card">
    <h2>{t('Effort')}{' '}<span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>{t('how close to failure')}</span></h2>
    <Segmented className="seg-range" value={win} onChange={setWin}
      options={[{ value: 30, label: '30j' }, { value: 90, label: '90j' }, { value: 365, label: '1A' }, { value: 0, label: t('All') }]} />
    {sum.rated === 0 ? <div className="muted small">{t('No rated sets in this period.')}</div> : <>
      <div className="row between" style={{ alignItems: 'flex-end', gap: 12 }}>
        <div>
          <div className="stat-v">{sum.avg == null ? '—' : fmtNum(toScale(kind, sum.avg)) + ' ' + hd}</div>
          <div className="small dim">{t('average effort')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="stat-v" style={{ color: 'var(--yellow)' }}>{sum.hardPct == null ? '—' : Math.round(sum.hardPct * 100) + '%'}</div>
          <div className="small dim">{t('at {0} {1} or harder', hd, fmtNum(toScale(kind, HARD_RIR)))}</div>
        </div>
      </div>
      <div className="small dim" style={{ marginTop: 8 }}>{t('{0} of {1} finished sets rated', sum.rated, sum.done)}</div>
      {effortOf(S) === 'none' && <div className="small" style={{ color: 'var(--yellow)', marginTop: 4 }}>
        {t('Effort per set is switched off — turn it on in Settings to keep rating.')}
      </div>}
      {pts.length > 1 && <>
        <h4 className="sec" style={{ marginTop: 12 }}>{t('Week by week')}</h4>
        <div className="chart"><LineChart points={pts} h={140} unit={hd} color="var(--yellow)" invert={kind === 'rir'} /></div>
      </>}
      <h4 className="sec" style={{ marginTop: 12 }}>{t('Where the sets land')}</h4>
      {hist.map(b => <div key={b.rir} className="mrow">
        <span className="nm">{hd} {binLabel(b)}</span>
        <span className="bar"><i style={{ width: Math.round(b.n / maxBin * 100) + '%', background: b.rir <= HARD_RIR ? 'var(--yellow)' : 'var(--label-3)' }} /></span>
        <span className="v">{b.n ? b.n + ' · ' + Math.round(b.pct * 100) + '%' : '—'}</span>
      </div>)}
      <div className="small dim" style={{ marginTop: 8 }}>
        {t('Most working sets belong close to failure without living there — half at the floor and half at the top average out to a healthy-looking middle.')}
      </div>
    </>}
  </div>
}

/* ── Weekly cardio activity summary ─────────────────────────────── */
function CardioSummary({ S }) {
  const log = S.nutritionLog || {}
  const today = todayISO()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() - (6 - i))
    const iso = isoOf(d)
    return { iso, kcal: dayCardioKcal(log, iso), isToday: iso === today,
      label: d.toLocaleDateString(undefined, { weekday: 'narrow' }) }
  })
  const weekTotal = days.reduce((s, d) => s + d.kcal, 0)
  const sessions  = days.filter(d => d.kcal > 0).length
  if (weekTotal === 0) return null
  const maxKcal = Math.max(...days.map(d => d.kcal), 1)
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>
          {t('Cardio')}{' '}<span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>{t('this week')}</span>
        </h2>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: 'var(--orange)' }}>{fmtNum(weekTotal)} kcal</div>
          <div className="small muted">{t('{0} sessions', sessions)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48 }}>
        {days.map(({ iso, kcal, isToday, label }) => {
          const h = kcal > 0 ? Math.max(4, Math.round((kcal / maxKcal) * 48)) : 2
          return (
            <div key={iso} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div className="ws-bar" style={{
                height: h, width: '100%',
                background: kcal > 0 ? 'var(--orange)' : 'var(--surface-3)',
                opacity: isToday ? 1 : 0.7, borderRadius: '3px 3px 0 0',
              }} />
              <span style={{ fontSize: 10, color: isToday ? 'var(--label-2)' : 'var(--label-4)' }}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Weekly calorie intake trend ─────────────────────────────────── */
function CalorieTrendChart({ S }) {
  const log      = S.nutritionLog || {}
  const target   = S.nutrition?.targetKcal
  const today    = todayISO()

  // Build 12 weeks of data (most recent week last)
  const weeks = []
  for (let wk = 11; wk >= 0; wk--) {
    const days = []
    for (let day = 0; day < 7; day++) {
      const d = new Date(today + 'T12:00:00')
      d.setDate(d.getDate() - wk * 7 - (6 - day))
      const iso = isoOf(d)
      const tot = dayTotals(log, iso)
      if (tot.kcal > 0) days.push(tot.kcal)
    }
    if (days.length > 0) {
      const avg = Math.round(days.reduce((s, k) => s + k, 0) / days.length)
      const d = new Date(today + 'T12:00:00')
      d.setDate(d.getDate() - wk * 7)
      weeks.push({ avg, label: fmtDate(isoOf(d)).replace(/\d{4}/, '').trim(), logged: days.length })
    } else {
      weeks.push(null)
    }
  }

  const nonEmpty = weeks.filter(Boolean)
  if (nonEmpty.length < 3) return null

  const maxKcal = Math.max(...nonEmpty.map(w => w.avg), target || 0, 1)
  const avgAll  = Math.round(nonEmpty.reduce((s, w) => s + w.avg, 0) / nonEmpty.length)

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{t('Calorie intake')}</h2>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: 'var(--nut-carbs)' }}>{fmtNum(avgAll)} kcal</div>
          <div className="small muted">{t('12-week average / day')}</div>
        </div>
      </div>

      {/* Target reference line */}
      {target && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--label-3)' }}>
            {t('Target')}: {fmtNum(target)} kcal
          </span>
        </div>
      )}

      {/* Bar chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64, position: 'relative' }}>
        {/* Target line */}
        {target && (
          <div style={{
            position: 'absolute', left: 0, right: 0,
            bottom: (target / maxKcal * 64),
            borderTop: '1px dashed var(--label-4)',
            pointerEvents: 'none',
          }} />
        )}
        {weeks.map((wk, i) => {
          if (!wk) {
            return <div key={i} style={{ flex: 1, height: 2, background: 'var(--surface-3)', borderRadius: 2, alignSelf: 'flex-end' }} />
          }
          const h   = Math.max(4, Math.round((wk.avg / maxKcal) * 64))
          const pct = target ? wk.avg / target : 0.9
          const color = pct > 1.05 ? 'var(--orange)' : pct < 0.85 ? 'var(--blue)' : 'var(--nut-carbs)'
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ height: h, width: '100%', background: color, borderRadius: '3px 3px 0 0',
                opacity: i === weeks.length - 1 ? 1 : 0.75 }} />
            </div>
          )
        })}
      </div>

      {/* Week labels (first + last) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {nonEmpty.length > 0 && (
          <>
            <span style={{ fontSize: 10, color: 'var(--label-4)' }}>{nonEmpty[0]?.label}</span>
            <span style={{ fontSize: 10, color: 'var(--label-4)' }}>{t('Now')}</span>
          </>
        )}
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--label-3)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--nut-carbs)', display: 'inline-block', marginRight: 4 }} />
          {t('On target')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--label-3)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--orange)', display: 'inline-block', marginRight: 4 }} />
          {t('Over target')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--label-3)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--blue)', display: 'inline-block', marginRight: 4 }} />
          {t('Under target')}
        </span>
      </div>
    </div>
  )
}

/* ── Weekly training volume ──────────────────────────────────────── */
function VolumeChart({ S }) {
  const weekMap = {}
  S.workouts.forEach(w => {
    const vol = w.entries.reduce((v, e) => {
      if (modeOf({ ...(e.target || {}), id: e.id }) !== 'reps') return v
      return v + e.sets.filter(s => s.done && s.w > 0 && s.r > 0).reduce((sv, s) => sv + s.w * s.r, 0)
    }, 0)
    if (vol > 0) {
      const key = weekKey(w.d)
      if (!weekMap[key]) weekMap[key] = { vol: 0, t: w.start || new Date(w.d).getTime(), d: w.d }
      weekMap[key].vol += vol
    }
  })
  const pts = Object.values(weekMap)
    .sort((a, b) => a.t - b.t)
    .slice(-12)
    .map(v => ({ t: v.t, y: Math.round(v.vol), d: v.d }))
  if (pts.length < 2) return null
  const avgVol = Math.round(pts.reduce((s, p) => s + p.y, 0) / pts.length)
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>
          {t('Volume')}{' '}<span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>{t('weekly kg lifted')}</span>
        </h2>
      </div>
      <div className="chart"><LineChart points={pts} h={140} unit={S.unit} color="var(--blue)" /></div>
      <div className="row between small" style={{ marginTop: 8, color: 'var(--label-2)' }}>
        <span>{t('Avg/week')}: <b style={{ color: 'var(--label)' }}>{fmtNum(avgVol)} {S.unit}</b></span>
        <span>{t('Last')}: <b style={{ color: 'var(--blue)' }}>{fmtNum(pts[pts.length - 1].y)} {S.unit}</b></span>
      </div>
    </div>
  )
}

/* ── personal records board ──────────────────────────────────────── */
function PRBoard({ S }) {
  const [showAll, setShowAll] = useState(false)
  const prs = allTimePRs(S)
  if (!prs.length) return null
  const visible = showAll ? prs : prs.slice(0, 8)
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>{t('Personal records')}</h2>
        <span className="tag nocap" style={{ background: 'color-mix(in srgb,var(--yellow) 16%,transparent)', color: 'var(--yellow)' }}>
          {prs.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visible.map(({ exId, weight, weightDate, e1rm, e1rmDate }) => {
          const ex = EXIDX[exId]
          if (!ex) return null
          const latestDate = [weightDate, e1rmDate].filter(Boolean).sort().pop()
          return (
            <div key={exId} className="row between" style={{ padding: '9px 0', borderBottom: 'var(--hair) solid var(--sep)', gap: 8, alignItems: 'center' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.n}</div>
                {latestDate && <div style={{ fontSize: 11, color: 'var(--label-4)', marginTop: 1 }}>{fmtDate(latestDate, true)}</div>}
              </div>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
                {e1rm > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--yellow)', lineHeight: 1.1 }}>{fmtNum(e1rm)}</div>
                    <div style={{ fontSize: 10, color: 'var(--label-4)' }}>{t('Est. 1RM')}</div>
                  </div>
                )}
                {weight > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--acc)', lineHeight: 1.1 }}>{fmtNum(weight)}</div>
                    <div style={{ fontSize: 10, color: 'var(--label-4)' }}>{S.unit}</div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {prs.length > 8 && (
        <button className="btn ghost" style={{ marginTop: 12, width: '100%', fontSize: 14 }} onClick={() => setShowAll(v => !v)}>
          {showAll ? t('Show less') : t('Show all {0}', prs.length)}
        </button>
      )}
    </div>
  )
}

/* ── main Stats view ──────────────────────────────────────────────── */
export default function Stats() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [range, setRange] = useState(90)
  const [exId, setExId] = useState(null)
  const [exMetric, setExMetric] = useState('top')
  const now = Date.now()
  const anyEffort = hasEffort(S)
  const kind = displayScale(S)
  const hd = scaleName(kind)

  const bwPts = S.bodyweight.filter(b => range === 0 || (b.t || new Date(b.d).getTime()) > now - range * 86400000)
    .map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))
  const bw30 = S.bodyweight.filter(b => (b.t || new Date(b.d).getTime()) > now - 30 * 86400000)
  const bwDelta30 = bw30.length > 1 ? bw30[bw30.length - 1].w - bw30[0].w : null
  const monthW = S.workouts.filter(w => w.d.slice(0, 7) === todayISO().slice(0, 7)).length
  const wThisWeek = S.workouts.filter(w => weekKey(w.d) === weekKey(todayISO())).length
  const plannedPerWeek = Object.keys(S.week).filter(k => S.week[k]).length
  const currentBW = lastBW(S)

  const exHist = [...new Set(S.workouts.flatMap(w => w.entries.map(e => e.id)))].filter(id => EXIDX[id]).sort((a, b) => EXIDX[a].n < EXIDX[b].n ? -1 : 1)
  const curEx = exId && exHist.includes(exId) ? exId : exHist[0] || null
  const curMode = curEx ? (() => {
    for (let i = S.workouts.length - 1; i >= 0; i--) {
      const en = S.workouts[i].entries.find(e => e.id === curEx)
      if (en) return modeOf({ ...(en.target || {}), id: curEx })
    }
    return modeOf({ id: curEx })
  })() : 'reps'
  const curCardio = curMode === 'cardio'
  const curTimed = curMode === 'time'
  const metric = s => curCardio ? (s.speed || 0) : curTimed ? (s.sec || 0) : (s.w || 0)
  const exUnit = curCardio ? 'km/h' : curTimed ? 's' : S.unit
  let exPts = [], exList = [], exBest = 0
  if (curEx) {
    S.workouts.forEach(w => {
      const en = w.entries.find(e => e.id === curEx)
      if (en) { const mx = Math.max(0, ...en.sets.filter(s => s.done).map(metric), curCardio || curTimed ? 0 : (en.topW || 0)); if (mx > 0) { exPts.push({ t: w.start, y: mx, d: w.d, sets: en.sets.filter(s => s.done), target: en.target }); if (mx > exBest) exBest = mx } }
    })
    exList = exPts.slice(-5).reverse()
  }
  const e1Pts = curEx ? e1rmSeries(S, curEx) : []
  const e1Best = curEx ? best1RM(S, curEx) : null
  const showE1 = e1Pts.length > 0
  const exRir = exPts.map(p => avgRir(p.sets))
  const showEff = exRir.filter(v => v != null).length >= 3
  const effPts = exPts.map((p, i) => (exRir[i] == null ? null : { t: p.t, y: toScale(kind, exRir[i]), d: p.d })).filter(Boolean)
  const onE1 = showE1 && exMetric === 'e1rm'
  const onEff = showEff && exMetric === 'effort'
  const topPts = exPts.map((p, i) => ({
    t: p.t, y: p.y, d: p.d,
    m: exRir[i] == null ? null : 1 - Math.min(4, Math.max(0, exRir[i])) / 4,
    note: exRir[i] == null ? undefined : hd + ' ' + fmtNum(toScale(kind, exRir[i]))
  }))
  const exOpts = [{ value: 'top', label: t('Top set') }]
  if (showE1) exOpts.push({ value: 'e1rm', label: t('Est. 1RM') })
  if (showEff) exOpts.push({ value: 'effort', label: t('Effort') })

  return <>
    {/* ── header ── */}
    <div className="hdr">
      <div><h1>{t('Stats')}</h1><div className="sub">{t('Progress & history')}</div></div>
      <button className="iconbtn" onClick={() => nav('/history')} aria-label={t('History')}><Icon name="history" /></button>
    </div>

    {/* ── streak badge (only when there's data) ── */}
    {S.workouts.length > 0 && (
      <div className="card tap" onClick={calendarSheet}>
        <StreakBadge weeks={streakWeeks(S)} thisWeek={wThisWeek} planned={plannedPerWeek} />
      </div>
    )}

    {/* ── 4-tile metric grid ── */}
    <div className="stat-grid">
      <MetricCard icon="dumbbell" label={t('Workouts')} value={S.workouts.length}
        sub={monthW > 0 ? t('{0} this month', monthW) : null}
        color="var(--acc)" onClick={() => nav('/history')} />
      <MetricCard icon="calendar" label={t('This month')} value={monthW}
        sub={null} color="var(--blue)" onClick={() => nav('/history')} />
      <MetricCard icon="flame" label={t('Week streak')} value={streakWeeks(S)}
        sub={t('{0} this week', wThisWeek)} color="var(--orange)" onClick={calendarSheet} />
      <MetricCard icon="scale" label={t('Weight 30d')}
        value={bwDelta30 === null ? '—' : (bwDelta30 > 0 ? '+' : '') + fmtNum(bwDelta30)}
        sub={bwDelta30 !== null ? S.unit : (currentBW ? fmtNum(currentBW.w) + ' ' + S.unit : null)}
        color={bwDelta30 === null ? 'var(--label-3)' : bwDeltaColor(bwDelta30, (currentBW || {}).w || 0)}
        onClick={() => nav('/bodyweight')} />
    </div>

    {/* ── activity calendar ── */}
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>{t('Training calendar')}</h2>
      <Heatmap S={S} onDay={iso => { const ws = S.workouts.filter(w => w.d === iso); if (ws.length === 1) workoutDetailSheet(ws[0]); else if (ws.length) calendarSheet(iso) }} />
    </div>

    {/* ── cardio activity summary ── */}
    <CardioSummary S={S} />

    {/* ── calorie intake trend ── */}
    <CalorieTrendChart S={S} />

    {/* ── weekly training volume ── */}
    {S.workouts.length >= 2 && <VolumeChart S={S} />}

    {/* ── muscle balance ── */}
    {S.workouts.length > 0 && <MuscleBalance S={S} />}
    {anyEffort && <EffortCard S={S} />}

    {/* ── body weight + exercise progress ── */}
    <div className="cols">
      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
          <div className="row" style={{ gap: 8 }}>
            <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
            <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
          </div>
        </div>
        <Segmented className="seg-range" value={range} onChange={setRange}
          options={[{ value: 30, label: '1M' }, { value: 90, label: '3M' }, { value: 365, label: '1A' }, { value: 0, label: t('All') }]} />
        <div className="chart"><LineChart points={bwPts} h={160} unit={S.unit} goal={S.targetW} /></div>
        {currentBW && (
          <div className="row between small" style={{ marginTop: 8, color: 'var(--label-2)' }}>
            <span>{t('Last')}{' '}<b style={{ color: 'var(--label)' }}>{fmtNum(currentBW.w)} {S.unit}</b></span>
            {bwDelta30 !== null && (
              <span style={{ color: bwDeltaColor(bwDelta30, currentBW.w), fontWeight: 600 }}>
                {bwDelta30 > 0 ? '+' : ''}{fmtNum(bwDelta30)} {t('30d')}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h2>{t('Exercise progress')}</h2>
        {exHist.length ? <>
          <div className="sect-b" style={{ marginBottom: 10 }}>
            <SelectRow title={t('Exercise')} sheetTitle={t('Exercise progress')} value={curEx} onChange={setExId}
              options={exHist.map(id => ({ value: id, label: EXIDX[id].n }))} />
          </div>
          {exOpts.length > 1 && <Segmented className="seg-range" value={onEff ? 'effort' : onE1 ? 'e1rm' : 'top'} onChange={setExMetric} options={exOpts} />}
          <div className="chart">
            {onEff
              ? <LineChart points={effPts} h={150} unit={hd} color="var(--yellow)" invert={kind === 'rir'} />
              : <LineChart points={onE1 ? e1Pts.map(p => ({ t: p.t, y: p.y, d: p.d })) : topPts} h={150} unit={exUnit} color="var(--blue)" />}
          </div>
          <div style={{ marginTop: 8 }}>{exList.map((p, i) => <div key={i} className="row between small" style={{ padding: '6px 0', borderBottom: 'var(--hair) solid var(--sep)' }}>
            <span className="muted">{fmtDate(p.d, true)}</span><span>{p.sets.map(s => setLabel(curEx, s, p.target)).join('  ')}</span></div>)}</div>
          <div className="small dim" style={{ marginTop: 8 }}>
            {onEff ? t('Average effort per workout') : onE1 ? t('Estimated 1RM per workout') : curCardio ? t('Top speed per workout') : curTimed ? t('Longest hold per workout') : t('Best set weight per workout')}
            {onEff ? '' : <>{' · '}{t('Best:')}{' '}<b className="accent">{fmtNum(onE1 ? e1Best.est : exBest)} {onE1 ? S.unit : exUnit}</b></>}
          </div>
          {onE1 && <div className="small dim" style={{ marginTop: 4 }}>
            {t('Best estimate from {0} on {1} — an estimate, not a tested max.', fmtNum(e1Best.w) + ' ' + S.unit + ' × ' + e1Best.r, fmtDate(e1Best.d, true))}
          </div>}
          {!onEff && !onE1 && showEff && <div className="small dim" style={{ marginTop: 4 }}>
            {t('A fuller dot means less left in the tank — the same weight at a lower {0} is progress the line alone does not show.', hd)}
          </div>}
        </> : <div className="muted small">{t('Finish your first workout to see progress curves here.')}</div>}
      </div>
    </div>

    <PRBoard S={S} />

    {/* ── recent workouts ── */}
    {S.workouts.length > 0 && <>
      <div className="row between" style={{ marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Recent workouts')}</h4>
        <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={() => nav('/history')}>{t('All')} {S.workouts.length}</Button>
      </div>
      <div className="list">{[...S.workouts].reverse().slice(0, 6).map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />)}</div>
    </>}
  </>
}
