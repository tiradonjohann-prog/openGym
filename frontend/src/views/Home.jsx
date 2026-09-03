import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW, setsDoneActive } from '../lib/history.js'
import { fmtNum, fmtDate, fmtDur, fmtVol, todayISO, isoOf, weekKey, DAYS } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor, programmeCreateSheet, cardioLogSheet, workoutDetailSheet, measurementsSheet } from '../sheets.jsx'
import { isCardioSport } from '../lib/sports.js'
import { dayTotals } from '../lib/foodSearch.js'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'
import ProgrammeCard from '../components/ProgrammeCard.jsx'

// ── Compact nutrition widget for home screen ──────────────────────────────────
function NutriWidget({ S, nav }) {
  const target = S.nutrition?.targetKcal
  const log = S.nutritionLog || {}
  const totals = dayTotals(log, todayISO())
  if (!target || totals.kcal === 0) return null
  const pct = Math.min(1, totals.kcal / target)
  const remaining = target - totals.kcal
  const over = remaining < 0
  const barColor = over ? 'var(--orange)' : pct > 0.85 ? 'var(--green)' : 'var(--acc)'
  return (
    <div
      className="card tap"
      style={{ padding: '12px 14px', marginBottom: 0 }}
      onClick={() => nav('/nutrition')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-2)' }}>
          <Icon name="flame" style={{ fontSize: 13, color: 'var(--nut-kcal)', marginRight: 5 }} />
          {t('Today')}
        </span>
        <span style={{ fontSize: 13, color: over ? 'var(--orange)' : 'var(--label-3)' }}>
          {over
            ? '+' + fmtNum(Math.abs(remaining)) + ' ' + t('over')
            : fmtNum(remaining) + ' ' + t('remaining')}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 22 }}>{fmtNum(totals.kcal)}</span>
        <span style={{ color: 'var(--label-3)', fontSize: 13 }}>/ {fmtNum(target)} kcal</span>
      </div>
      <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: (pct * 100) + '%', background: barColor, borderRadius: 4, transition: 'width .5s var(--ease)' }} />
      </div>
      {(totals.prot > 0 || totals.carbs > 0 || totals.fat > 0) && (
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {totals.prot  > 0 && <span className="small" style={{ color: 'var(--blue)'   }}>{totals.prot}g P</span>}
          {totals.carbs > 0 && <span className="small" style={{ color: 'var(--orange)' }}>{totals.carbs}g G</span>}
          {totals.fat   > 0 && <span className="small" style={{ color: 'var(--yellow)' }}>{totals.fat}g L</span>}
        </div>
      )}
    </div>
  )
}

// ── Quick-look card for the last completed workout ────────────────────────────
function LastWorkoutCard({ S }) {
  const last = S.workouts.length ? S.workouts[S.workouts.length - 1] : null
  if (!last) return null
  const dur = last.end && last.start ? fmtDur(last.end - last.start) : null
  return (
    <div className="card tap" onClick={() => workoutDetailSheet(last)}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--label-3)' }}>{t('Last workout')}</div>
        <Icon name="chevronRight" className="chev" />
      </div>
      <div className="row" style={{ gap: 10, marginBottom: 10, alignItems: 'center' }}>
        <span className="lrow-i" style={{ background: 'var(--surface-2)', flexShrink: 0 }}>
          <Icon name="dumbbell" />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last.name || t('Workout')}</div>
          <div className="small muted">{fmtDate(last.d, true)}</div>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {dur && <span className="tag nocap"><Icon name="timer" style={{ fontSize: 11 }} />{' '}{dur}</span>}
        {last.vol > 0 && <span className="tag nocap"><Icon name="weight" style={{ fontSize: 11 }} />{' '}{fmtVol(last.vol, S.unit)}</span>}
        {last.prs?.length > 0 && (
          <span className="tag nocap" style={{ background: 'color-mix(in srgb,var(--yellow) 16%,transparent)', color: 'var(--yellow)' }}>
            <Icon name="trophy" style={{ fontSize: 11 }} />{' '}{last.prs.length} PR{last.prs.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Smart in-app nudges ────────────────────────────────────────────────────────
function SmartNudge({ S }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('nudges_dismissed') || '{}') } catch { return {} }
  })
  const dismiss = key => {
    const next = { ...dismissed, [key]: true }
    setDismissed(next)
    sessionStorage.setItem('nudges_dismissed', JSON.stringify(next))
  }

  const today = todayISO()
  const lastW = S.workouts.length ? S.workouts[S.workouts.length - 1] : null
  const lastBWEntry = S.bodyweight.length ? S.bodyweight[S.bodyweight.length - 1] : null

  const nudges = []

  // Nudge 1 — poids du corps non noté depuis 5+ jours
  if (lastBWEntry) {
    const daysSinceBW = Math.round((new Date(today) - new Date(lastBWEntry.d)) / 86400000)
    if (daysSinceBW >= 5 && !dismissed['bw_' + lastBWEntry.d]) {
      nudges.push({
        key: 'bw_' + lastBWEntry.d,
        icon: 'scale',
        color: 'var(--blue)',
        text: t('No weight logged for {0} days — quick update?', daysSinceBW),
        action: () => bwSheet(),
        actionLabel: t('Log'),
      })
    }
  }

  // Nudge 2 — pas d'entraînement depuis 4+ jours
  if (lastW) {
    const daysSince = Math.round((new Date(today) - new Date(lastW.d)) / 86400000)
    if (daysSince >= 4 && !dismissed['wo_' + lastW.d]) {
      nudges.push({
        key: 'wo_' + lastW.d,
        icon: 'dumbbell',
        color: 'var(--acc)',
        text: t('Last workout was {0} days ago — time to get moving!', daysSince),
        action: null,
        actionLabel: null,
      })
    }
  }

  if (!nudges.length) return null

  return <>
    {nudges.slice(0, 1).map(n => (
      <div key={n.key} className="card" style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        border: `1.5px solid color-mix(in srgb,${n.color} 25%,transparent)`,
        background: `color-mix(in srgb,${n.color} 7%,var(--surface))`,
        position: 'relative',
      }}>
        <Icon name={n.icon} style={{ fontSize: 18, color: n.color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, flex: 1, lineHeight: 1.4 }}>{n.text}</span>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {n.action && <button className="chip on" style={{ fontSize: 12, padding: '4px 10px' }} onClick={n.action}>{n.actionLabel}</button>}
          <button className="iconbtn" style={{ width: 26, height: 26, fontSize: 12, color: 'var(--label-4)' }} onClick={() => dismiss(n.key)} aria-label={t('Dismiss')}>
            <Icon name="xmark" />
          </button>
        </div>
      </div>
    ))}
  </>
}

// Home = what to do now + a quick glance. Deep charts & history live in Stats.
export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const [weekOffset, setWeekOffset] = useState(0)

  const hasProgrammes = Array.isArray(S.programmes) && S.programmes.length > 0

  return hasProgrammes
    ? <ProgrammeHome S={S} user={user} nav={nav} />
    : <ClassicHome S={S} user={user} nav={nav} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
}

/* ── Programme-based home screen ── */
function ProgrammeHome({ S, user, nav }) {
  const today = new Date()
  const programmes = S.programmes || []

  return (
    <div className="narrow">
      <div className="hdr">
        <div>
          <h1>{user ? t('Hi {0}', user.name) : S.displayName ? t('Hi {0}', S.displayName) : 'openGym'}</h1>
          <div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div className="small" style={{
          textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700,
          marginBottom: 12, color: 'var(--acc)', fontSize: 11,
        }}>
          {t('My programmes')}
        </div>
        {programmes.map(prog => (
          <ProgrammeCard key={prog.id} prog={prog} />
        ))}
        <button
          className="add-dashed"
          onClick={programmeCreateSheet}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            background: 'var(--surface-2)', border: '1.5px dashed var(--surface-3)',
            borderRadius: 14, padding: '12px 16px', cursor: 'pointer',
            color: 'var(--label-3)', fontSize: 13, fontWeight: 600,
          }}
        >
          <Icon name="plus" style={{ fontSize: 15 }} />
          {t('New programme')}
        </button>
      </div>

      <SmartNudge S={S} />
      <LastWorkoutCard S={S} />

      {/* compact nutrition widget */}
      <NutriWidget S={S} nav={nav} />

      {/* compact body weight row */}
      <div
        className="card tap"
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}
        onClick={() => nav('/bodyweight')}
      >
        <Icon name="scale" style={{ fontSize: 20, color: 'var(--label-3)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="small muted" style={{ marginBottom: 1 }}>{t('Body weight')}</div>
          {lastBW(S)
            ? <div style={{ fontWeight: 600 }}>{fmtNum(lastBW(S).w)} <span className="muted" style={{ fontSize: '0.9em' }}>{S.unit}</span></div>
            : <div className="small muted">{t('Not logged yet')}</div>}
        </div>
        <Icon name="chevronRight" className="chev" />
      </div>

      {/* Log activity CTA */}
      <button
        className="lrow tap"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--orange)', borderRadius: 14, padding: '14px 16px',
          border: 'none', cursor: 'pointer', marginTop: 8,
        }}
        onClick={cardioLogSheet}
      >
        <Icon name="figureRun" style={{ fontSize: 20, color: '#fff', flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 15, color: '#fff' }}>{t('Log activity')}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,.75)', marginTop: 1 }}>{t('Running, cycling, swimming…')}</span>
        </span>
        <Icon name="chevronRight" style={{ color: 'rgba(255,255,255,.6)', fontSize: 16 }} />
      </button>
    </div>
  )
}

/* ── Classic home (no programmes) ── */
function ClassicHome({ S, user, nav, weekOffset, setWeekOffset }) {
  const today = new Date()
  const routine = effectiveRoutine(S, todayISO())
  const [bannerOff, setBannerOff] = useState(() => localStorage.getItem('banner_prog') === '1')
  const dismissBanner = () => { localStorage.setItem('banner_prog', '1'); setBannerOff(true) }
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null
  const firstBW = S.bodyweight.length > 1 ? S.bodyweight[0] : null
  const totalDelta = bw && firstBW ? Math.round((bw.w - firstBW.w) * 10) / 10 : null
  const trendDir = delta === null ? null : Math.abs(delta) < 0.3 ? 'stable' : delta > 0 ? 'up' : 'down'

  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineId(S, iso), ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    const dot = done ? ' done' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(<div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')} onClick={() => dayOverrideSheet(iso)}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
  }
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`

  const wThisWeek = S.workouts.filter(w => weekKey(w.d) === weekKey(todayISO())).length
  const plannedPerWeek = Object.keys(S.week).filter(k => S.week[k]).length
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))

  const activeRoute = S.active && isCardioSport(S.active.sport) ? '/cardio' : '/workout'
  const onToday = () => { if (S.active) nav(activeRoute); else if (routine) startFlow(routine.id); else dayOverrideSheet(todayISO()) }

  return <div className="narrow">
    <div className="hdr">
      <div><h1>{user ? t('Hi {0}', user.name) : S.displayName ? t('Hi {0}', S.displayName) : 'openGym'}</h1><div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>

    {/* ── Beginner mode: large "today" CTA ── */}
    {S.simpleMode && (
      <div className="card" style={{ padding: '24px 16px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <span className="lrow-i" style={{
            width: 60, height: 60, fontSize: 28, borderRadius: 18,
            background: S.active ? 'var(--orange)' : routine ? 'var(--acc)' : 'var(--surface-3)',
          }}>
            <Icon name={S.active ? 'timer' : routine ? glyphOf(routine.emoji) : 'moon'} />
          </span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 4 }}>
          {S.active ? t('{0} — in progress', S.active.name) : routine ? routine.name : t('Rest day')}
        </div>
        {!S.active && routine?.ex?.length > 0 && (
          <div className="muted small" style={{ marginBottom: 12 }}>
            {t('{0} exercises', routine.ex.length)}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          {S.active
            ? <Button variant="primary" style={{ width: '100%', padding: '13px', fontSize: 16 }} icon="timer" onClick={onToday}>{t('Resume workout')}</Button>
            : routine
              ? <Button variant="primary" style={{ width: '100%', padding: '13px', fontSize: 16 }} onClick={onToday}>{t('Start workout')}</Button>
              : <Button style={{ width: '100%' }} onClick={() => dayOverrideSheet(todayISO())}>{t('Pick a workout')}</Button>
          }
        </div>
      </div>
    )}

    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
        <div className="small muted" style={{ fontWeight: 500 }}>{wkLabel}</div>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
      </div>
      <div className="week">{strip}</div>
      <div className="today-row" onClick={onToday} style={S.active ? { background: 'color-mix(in srgb,var(--orange) 8%,var(--surface-2))' } : undefined}>
        <div className="row" style={{ gap: 9, minWidth: 0 }}>
          <span className="lrow-i" style={{ background: S.active ? 'var(--orange)' : routine ? 'var(--acc)' : 'var(--surface-3)' }}>
            <Icon name={S.active ? 'timer' : routine ? glyphOf(routine.emoji) : 'moon'} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="lbl2">{t('Today')}</div>
            <div className="ttl">{S.active ? t('{0} — in progress', S.active.name) : routine ? routine.name : t('Rest day')}{todayOvr && routine ? ' \xB7 ' + t('rescheduled') : ''}</div>
          </div>
        </div>
        {S.active ? <span className="tag resume pop">{t('Resume')}</span>
          : routine ? <span className="tag acc pop">{t('Start')}</span>
          : <Icon name="plus" className="chev" />}
      </div>
    </div>

    <SmartNudge S={S} />
    <LastWorkoutCard S={S} />

    {!S.routines.length && !S.active && (
      <div className="card">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span className="lrow-i"><Icon name="sparkles" /></span>
          <div className="big" style={{ fontSize: 22 }}>{t('Welcome!')}</div>
        </div>
        <div className="muted small" style={{ marginBottom: 12 }}>{t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}</div>
        <Button variant="primary" icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (PPL)')}</Button>
        <div style={{ height: 8 }} /><Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
      </div>
    )}


    {!bannerOff && (
      <div className="card" style={{ border: '1.5px solid var(--acc-line)', background: 'color-mix(in srgb,var(--acc) 7%,var(--surface))', padding: '12px 14px', position: 'relative' }}>
        <button className="iconbtn" style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, fontSize: 13, color: 'var(--label-4)' }} onClick={dismissBanner} aria-label={t('Dismiss')}>
          <Icon name="xmark" />
        </button>
        <div className="row" style={{ gap: 8, marginBottom: 4, marginRight: 32 }}>
          <span className="tag acc" style={{ fontSize: 10, fontWeight: 700 }}>{t('New')}</span>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-.015em' }}>{t('Training programmes')}</span>
        </div>
        <div className="muted small" style={{ marginBottom: 10, lineHeight: 1.5 }}>{t('Structure your training into multi-week plans.')}</div>
        <button className="chip on" style={{ fontSize: 13 }} onClick={() => { dismissBanner(); nav('/plan') }}>{t('Go to Plan')} →</button>
      </div>
    )}

    <NutriWidget S={S} nav={nav} />

    <div className="card tap" onClick={() => nav('/bodyweight')}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={e => { e.stopPropagation(); goalSheet() }}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
          <Button size="sm" icon="plus" onClick={e => { e.stopPropagation(); bwSheet() }}>{t('Log')}</Button>
        </div>
      </div>
      {bw ? <>
        {/* framed weight reading with direction indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="big">{fmtNum(bw.w)} <span className="muted" style={{ fontSize: '1rem' }}>{S.unit}</span></div>
            <div className="dim small" style={{ marginTop: 3 }}>{fmtDate(bw.d, true)}</div>
          </div>
          {trendDir !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: trendDir === 'stable' ? 'var(--surface-3)' : trendDir === 'up' ? 'color-mix(in srgb,var(--orange) 16%,transparent)' : 'color-mix(in srgb,var(--green) 16%,transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                color: trendDir === 'stable' ? 'var(--label-3)' : bwDeltaColor(delta, bw.w),
              }}>
                <Icon name={trendDir === 'up' ? 'arrowUp' : trendDir === 'down' ? 'arrowDown' : 'arrowRight'} />
              </div>
              {trendDir !== 'stable' && <span style={{ fontSize: 11, fontWeight: 600, color: bwDeltaColor(delta, bw.w) }}>{delta > 0 ? '+' : ''}{fmtNum(delta)}</span>}
            </div>
          )}
        </div>
        {/* delta from starting weight */}
        {totalDelta !== null && (
          <div className="small row" style={{ gap: 5, marginBottom: 4 }}>
            <Icon name="flag" style={{ fontSize: 12, color: 'var(--label-3)' }} />
            <span className="muted">{t('From start ({0} {1}):', fmtNum(firstBW.w), S.unit)}</span>
            <span style={{ fontWeight: 600, color: bwDeltaColor(totalDelta, bw.w) }}>{totalDelta > 0 ? '+' : ''}{fmtNum(totalDelta)} {S.unit}</span>
          </div>
        )}
        {S.targetW && (
          <div className="small row" style={{ color: 'var(--yellow)', gap: 5 }}>
            <Icon name="target" style={{ fontSize: 13 }} />
            <span>{t('Goal')} {fmtNum(S.targetW)} {S.unit}{' · '}{Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}</span>
          </div>
        )}
        <div className="chart" style={{ marginTop: 8 }}><LineChart points={bwPoints} h={130} unit={S.unit} goal={S.targetW} /></div>
      </> : <div className="muted small">{t("No entries yet — log your weight to start the curve. It's also asked before every workout.")}</div>}
    </div>

    {S.workouts.length > 0 && (
      <div className="card tappable" onClick={() => calendarSheet()}>
        <div className="row between">
          <div>
            <div className="row" style={{ gap: 7, fontSize: 22, fontWeight: 600, letterSpacing: '-.021em' }}>
              <Icon name="flame" style={{ color: 'var(--orange)' }} />
              {t('{0} week streak', streakWeeks(S))}
            </div>
            <div className="muted small" style={{ marginTop: 2 }}>{wThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')}{' · '}{t(S.workouts.length === 1 ? '{0} workout total' : '{0} workouts total', S.workouts.length)}</div>
          </div>
          <Icon name="calendar" className="chev" style={{ fontSize: 20 }} />
        </div>
      </div>
    )}

    {/* ── Log activity CTA ── */}
    <button
      className="lrow tap"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--orange)', borderRadius: 14, padding: '14px 16px',
        border: 'none', cursor: 'pointer',
      }}
      onClick={cardioLogSheet}
    >
      <Icon name="figureRun" style={{ fontSize: 20, color: '#fff', flexShrink: 0 }} />
      <span style={{ flex: 1, textAlign: 'left' }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 15, color: '#fff' }}>{t('Log activity')}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,.75)', marginTop: 1 }}>{t('Running, cycling, swimming…')}</span>
      </span>
      <Icon name="chevronRight" style={{ color: 'rgba(255,255,255,.6)', fontSize: 16 }} />
    </button>
  </div>
}
