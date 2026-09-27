import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW, bwTrend, setsDoneActive } from '../lib/history.js'
import { calcMacros } from '../lib/macros.js'
import { fmtNum, fmtDate, fmtDur, fmtVol, todayISO, isoOf, weekKey, DAYS } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor, cardioLogSheet, workoutDetailSheet, measurementsSheet, startFlowForProgramme, confirmStartSheet, resumeWorkout } from '../sheets.jsx'
import { isCardioSport } from '../lib/sports.js'
import { activeProgramme, nextSession, sessionStates, workoutForProgSession } from '../lib/programme.js'
import { dayTotals } from '../lib/foodSearch.js'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { SasoianMark, SasoianWordmark } from '../components/SasoianLogo.jsx'
import { bwReminderDue, measReminderDue } from '../lib/reminders.js'
import { TutorialButton } from '../components/TutorialOverlay.jsx'
import { HOME_STEPS } from '../lib/tutorials.js'

// ── Compact nutrition widget for home screen ──────────────────────────────────
function NutriWidget({ S, nav, withHeader }) {
  const target = S.nutrition?.targetKcal
  const log = S.nutritionLog || {}
  const totals = dayTotals(log, todayISO())
  if (!target || totals.kcal === 0) return null
  const pct = Math.min(1, totals.kcal / target)
  const remaining = target - totals.kcal
  const over = remaining < 0
  const barColor = over ? 'var(--orange)' : pct > 0.85 ? 'var(--green)' : 'var(--acc)'
  const n = S.nutrition || {}
  const bw = lastBW(S)
  const weightKg = bw ? (S.unit === 'lb' ? bw.w / 2.2046 : bw.w) : null
  const macros = n.macros?.protG ? n.macros : calcMacros(target, weightKg, n.goal, n.workoutsPerWeek)
  const widget = (
    <div
      className="card tap"
      style={{ padding: '14px' }}
      onClick={() => nav('/nutrition')}
    >
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 22, lineHeight: 1.2 }}>
            {fmtNum(totals.kcal)} <span style={{ color: 'var(--label-3)', fontWeight: 600, fontSize: 17 }}>/ {fmtNum(target)}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 3 }}>
            {t('kcal consommées')} · {over
              ? '+' + fmtNum(Math.abs(remaining)) + ' ' + t('over')
              : fmtNum(remaining) + ' ' + t('restantes')}
          </div>
        </div>
        <Icon name="utensils" style={{ fontSize: 17, color: 'var(--acc)', flexShrink: 0, marginTop: 2 }} />
      </div>
      <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden', marginTop: 10 }}>
        <div style={{ height: '100%', width: (pct * 100) + '%', background: barColor, borderRadius: 4, transition: 'width .5s var(--ease)' }} />
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 9 }}>
        <span className="small" style={{ color: 'var(--nut-prot)', fontWeight: 600 }}>P {totals.prot}{macros ? '/' + macros.protG : ''} g</span>
        <span className="small" style={{ color: 'var(--nut-carbs)', fontWeight: 600 }}>G {totals.carbs}{macros ? '/' + macros.carbsG : ''} g</span>
        <span className="small" style={{ color: 'var(--nut-fat)', fontWeight: 600 }}>L {totals.fat}{macros ? '/' + macros.fatG : ''} g</span>
      </div>
    </div>
  )
  if (!withHeader) return widget
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <SectionHead title={t('Nutrition')} action={t('Ajouter')} onAction={() => nav('/nutrition')} />
      {widget}
    </div>
  )
}

// ── Quick-look card for the last completed workout ────────────────────────────
function LastWorkoutCard({ S }) {
  const last = S.workouts.length ? S.workouts[S.workouts.length - 1] : null
  if (!last) return null
  const dur = last.end && last.start ? fmtDur(last.end - last.start) : null
  const routine = S.routines.find(r => r.id === last.routineId)
  const hasPRs = last.prs?.length > 0
  const iconColor = hasPRs ? 'var(--yellow)' : 'var(--acc)'
  return (
    <div className="card tap" onClick={() => workoutDetailSheet(last)}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--label-3)' }}>{t('Last workout')}</div>
        <Icon name="chevronRight" className="chev" />
      </div>
      <div className="row" style={{ gap: 10, marginBottom: 10, alignItems: 'center' }}>
        <span className="lrow-i" style={{
          background: `color-mix(in srgb,${iconColor} 18%,var(--surface-3))`,
          color: iconColor,
          flexShrink: 0,
        }}>
          <Icon name={routine ? glyphOf(routine.emoji) : 'dumbbell'} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last.name || t('Workout')}</div>
          <div className="small muted">{fmtDate(last.d, true)}</div>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {dur && <span className="tag nocap"><Icon name="timer" style={{ fontSize: 11 }} />{' '}{dur}</span>}
        {last.vol > 0 && <span className="tag nocap"><Icon name="weight" style={{ fontSize: 11 }} />{' '}{fmtVol(last.vol, S.unit)}</span>}
        {hasPRs && (
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
  const today = todayISO()

  // Dismissals are keyed by date — resets automatically next day.
  const [dismissed, setDismissed] = useState(() => {
    try {
      const raw = JSON.parse(sessionStorage.getItem('nudge_dismiss') || '{}')
      return Object.fromEntries(Object.entries(raw).filter(([, d]) => d === today))
    } catch { return {} }
  })
  const dismiss = key => {
    const next = { ...dismissed, [key]: today }
    setDismissed(next)
    sessionStorage.setItem('nudge_dismiss', JSON.stringify(next))
  }

  const lastW = S.workouts.length ? S.workouts[S.workouts.length - 1] : null

  // Reminder banners (only when configured by user)
  const showBW   = bwReminderDue(S)   && !dismissed['bw']
  const showMeas = measReminderDue(S) && !dismissed['meas']

  // Fallback nudge — no reminders configured, been 5+ days since last log
  const lastBWEntry = S.bodyweight.length ? S.bodyweight[S.bodyweight.length - 1] : null
  const daysSinceBW = lastBWEntry ? Math.round((new Date(today) - new Date(lastBWEntry.d)) / 86400000) : null
  const showFallbackBW = !S.reminderBW?.on && daysSinceBW !== null && daysSinceBW >= 5 && !dismissed['bw_fallback']

  // Workout absence nudge
  const lastWDays = lastW ? Math.round((new Date(today) - new Date(lastW.d)) / 86400000) : null
  const showWO = lastW && lastWDays >= 4 && !dismissed['wo_' + lastW.d]

  const ReminderBanner = ({ id, icon, color, title, tip, onLog, onSkip }) => (
    <div className="card" style={{
      padding: '12px 14px',
      border: `1.5px solid color-mix(in srgb,${color} 22%,transparent)`,
      background: `color-mix(in srgb,${color} 6%,var(--surface))`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <Icon name={icon} style={{ fontSize: 19, color, flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, marginBottom: tip ? 4 : 0 }}>{title}</div>
          {tip && <div style={{ fontSize: 12, color: 'var(--label-3)', lineHeight: 1.5 }}>{tip}</div>}
        </div>
        <button className="iconbtn" style={{ width: 26, height: 26, fontSize: 12, color: 'var(--label-4)', flexShrink: 0 }}
          onClick={() => dismiss(id)} aria-label={t('Dismiss')}>
          <Icon name="xmark" />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="chip on" style={{ fontSize: 13, padding: '6px 14px' }} onClick={onLog}>{t('Log now')}</button>
        <button className="chip" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--label-3)' }}
          onClick={() => { onSkip?.(); dismiss(id) }}>{t('Skip')}</button>
        <span style={{ fontSize: 11, color: 'var(--label-4)', lineHeight: 1.35, flex: 1 }}>
          {t('The more regular, the more accurate.')}
        </span>
      </div>
    </div>
  )

  return <>
    {/* ── Configured BW reminder ── */}
    {showBW && (
      <ReminderBanner
        id="bw"
        icon="scale"
        color="var(--blue)"
        title={t('Time to weigh yourself')}
        tip={t('Weigh fasted, after using the toilet — for consistent readings.')}
        onLog={() => { dismiss('bw'); bwSheet() }}
      />
    )}

    {/* ── Configured measurements reminder ── */}
    {showMeas && (
      <ReminderBanner
        id="meas"
        icon="ruler"
        color="var(--teal)"
        title={t('Time to take your measurements')}
        tip={null}
        onLog={() => { dismiss('meas'); measurementsSheet() }}
      />
    )}

    {/* ── Fallback BW nudge (no reminder configured, 5+ days gap) ── */}
    {showFallbackBW && (
      <div className="card" style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        border: '1.5px solid color-mix(in srgb,var(--blue) 20%,transparent)',
        background: 'color-mix(in srgb,var(--blue) 5%,var(--surface))',
      }}>
        <Icon name="scale" style={{ fontSize: 17, color: 'var(--blue)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, flex: 1, lineHeight: 1.4 }}>
          {t('No weight logged for {0} days — quick update?', daysSinceBW)}
        </span>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="chip on" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { dismiss('bw_fallback'); bwSheet() }}>{t('Log')}</button>
          <button className="iconbtn" style={{ width: 26, height: 26, fontSize: 12, color: 'var(--label-4)' }}
            onClick={() => dismiss('bw_fallback')} aria-label={t('Dismiss')}><Icon name="xmark" /></button>
        </div>
      </div>
    )}

    {/* ── Workout absence nudge ── */}
    {showWO && (
      <div className="card" style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        border: '1.5px solid color-mix(in srgb,var(--acc) 20%,transparent)',
        background: 'color-mix(in srgb,var(--acc) 5%,var(--surface))',
      }}>
        <Icon name="dumbbell" style={{ fontSize: 17, color: 'var(--acc)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, flex: 1, lineHeight: 1.4 }}>
          {t('Last workout was {0} days ago — time to get moving!', lastWDays)}
        </span>
        <button className="iconbtn" style={{ width: 26, height: 26, fontSize: 12, color: 'var(--label-4)' }}
          onClick={() => dismiss('wo_' + lastW.d)} aria-label={t('Dismiss')}><Icon name="xmark" /></button>
      </div>
    )}
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

// ── Mockup-style section header: title + a small right-aligned action ──
// Matches h4.sec's established 22px/8px rhythm (index.css) — this component
// previously had no top margin and only 2px below, reading as glued to the
// card above and the one below it.
function SectionHead({ title, action, onAction }) {
  return (
    <div className="row between" style={{ marginTop: 22, marginBottom: 8 }}>
      <h3 className="font-display" style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '.002em' }}>{title}</h3>
      {action && (
        <button
          type="button"
          style={{
            background: 'none', border: 'none', width: 'auto', height: 'auto',
            padding: '8px 4px', margin: '-8px -4px', fontSize: 11, fontWeight: 600,
            color: 'var(--acc)', cursor: 'pointer',
          }}
          onClick={onAction}
        >
          {action}
        </button>
      )}
    </div>
  )
}

/* ── Swipeable per-week session carousel for the active programme ── */
function ProgrammeWeekCarousel({ S, prog }) {
  const nav = useNavigate()
  const scrollerRef = useRef(null)
  const [viewedWeek, setViewedWeek] = useState(prog.currentWeek)
  const trackedWeek = useRef(prog.currentWeek)
  // Set right before a programmatic scroll starts, cleared once the scroll
  // settles on it — while set, onScroll's intermediate events (a smooth
  // scroll fires many) are ignored instead of bouncing viewedWeek back to
  // wherever the scroll started from.
  const scrollTarget = useRef(null)

  // Follow prog.currentWeek's auto-advance only if the user hadn't
  // manually scrolled away from the week that just got completed.
  useEffect(() => {
    if (prog.currentWeek !== trackedWeek.current) {
      setViewedWeek(v => (v === trackedWeek.current ? prog.currentWeek : v))
      trackedWeek.current = prog.currentWeek
    }
  }, [prog.currentWeek])

  const scrollToWeek = (wk, behavior) => {
    const el = scrollerRef.current
    if (!el) return
    scrollTarget.current = wk
    el.scrollTo({ left: (wk - 1) * el.clientWidth, behavior })
  }
  const mounted = useRef(false)
  useEffect(() => {
    scrollToWeek(viewedWeek, mounted.current ? 'smooth' : 'auto')
    mounted.current = true
  }, [viewedWeek])

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el || !el.clientWidth) return
    const wk = Math.round(el.scrollLeft / el.clientWidth) + 1
    if (scrollTarget.current != null) {
      if (wk === scrollTarget.current) scrollTarget.current = null
      return
    }
    if (wk !== viewedWeek) setViewedWeek(wk)
  }

  const activeRoute = S.active && isCardioSport(S.active.sport) ? '/cardio' : '/workout'
  // sessionStates() marks the first non-done slot 'next' independently for
  // every week — only the programme's one true next session (across all
  // weeks) should wear the "Prochaine" badge; every other week's own
  // first-incomplete slot is just another 'upcoming' (grey) tile.
  const trueNext = nextSession(prog, S.routines)

  const tileClick = (routine, weekNum, sessionIdx, state) => {
    if (state === 'done') {
      const w = workoutForProgSession(S.workouts, prog.id, weekNum, sessionIdx)
      if (w) workoutDetailSheet(w)
      else useUI.getState().toast(t('Séance non retrouvée dans l\'historique'))
      return
    }
    if (S.active) { nav(activeRoute); return }
    if (!routine) return
    confirmStartSheet(routine, () => startFlowForProgramme(prog.id, weekNum, sessionIdx))
  }

  return (
    <div className="card" style={{
      border: '1.5px solid color-mix(in srgb,var(--acc) 22%,transparent)',
      background: 'linear-gradient(165deg,color-mix(in srgb,var(--acc) 6%,var(--glass-fill)),var(--glass-fill))',
      padding: '14px 0 14px 14px',
    }}>
      <div className="row between" style={{ marginBottom: 8, paddingRight: 14 }}>
        <div className="small" style={{ textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, color: 'var(--acc)', fontSize: 11 }}>
          {prog.name}
        </div>
        <span className="tag acc" style={{ fontSize: 10, fontWeight: 700 }}>{t('Semaine {0}/{1}', viewedWeek, prog.totalWeeks)}</span>
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="no-scrollbar"
        style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {Array.from({ length: prog.totalWeeks }, (_, i) => i + 1).map(wk => {
          const states = sessionStates(prog, wk)
          const adHocThisWeek = S.workouts.filter(w => w.programmeId === prog.id && w.progWeek === wk && w.adHoc)
          return (
            <div key={wk} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', paddingRight: 14, boxSizing: 'border-box' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 140px))', justifyContent: 'center', gap: 10 }}>
                {prog.routineIds.map((routineId, i) => {
                  const routine = S.routines.find(r => r.id === routineId)
                  const isTrueNext = trueNext && trueNext.weekNum === wk && trueNext.sessionIdx === i
                  const state = states[i] === 'done' ? 'done' : isTrueNext ? 'next' : 'upcoming'
                  const color = state === 'done' ? 'var(--green)' : state === 'next' ? 'var(--yellow)' : 'var(--label-4)'
                  const hasImg = !!routine?.imageUrl
                  return (
                    <div
                      key={i}
                      className="tap"
                      style={{
                        position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                        border: `2px solid color-mix(in srgb,${color} 45%,transparent)`,
                        background: hasImg ? 'var(--surface-2)' : `linear-gradient(135deg,color-mix(in srgb,${color} 22%,var(--surface-2)),var(--surface-3))`,
                      }}
                      onClick={() => tileClick(routine, wk, i, state)}
                    >
                      {hasImg ? (
                        <img src={routine.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 8, boxSizing: 'border-box' }} />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name={routine ? glyphOf(routine.emoji) : 'dumbbell'} style={{ fontSize: 30, color, opacity: .45 }} />
                        </div>
                      )}
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 45%,rgba(0,0,0,.65) 100%)', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 9px' }}>
                        <div className="capitalize" style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.25, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>
                          {routine ? routine.name : t('Séance')}
                        </div>
                        {state === 'next' && <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--yellow)', marginTop: 2, textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{t('Prochaine')}</div>}
                      </div>
                      {state === 'done' && (
                        <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="check" style={{ fontSize: 11, color: '#06110E' }} />
                        </div>
                      )}
                    </div>
                  )
                })}
                {adHocThisWeek.map(w => (
                  <div
                    key={w.id}
                    className="tap"
                    style={{
                      position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                      border: '2px solid color-mix(in srgb,var(--green) 45%,transparent)',
                      background: 'linear-gradient(135deg,color-mix(in srgb,var(--green) 22%,var(--surface-2)),var(--surface-3))',
                    }}
                    onClick={() => workoutDetailSheet(w)}
                  >
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="figureRun" style={{ fontSize: 30, color: 'var(--green)', opacity: .45 }} />
                    </div>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 45%,rgba(0,0,0,.65) 100%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 9px' }}>
                      <div className="capitalize" style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.25, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>
                        {w.name}
                      </div>
                    </div>
                    <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="check" style={{ fontSize: 11, color: '#06110E' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginTop: 10, paddingRight: 14 }}>
        {Array.from({ length: prog.totalWeeks }, (_, i) => i + 1).map(wk => (
          <button
            key={wk}
            onClick={() => setViewedWeek(wk)}
            aria-label={t('Semaine {0}', wk)}
            style={{
              width: 6, height: 6, borderRadius: '50%', border: 'none', padding: 0,
              background: wk === viewedWeek ? 'var(--acc)' : 'var(--surface-3)', flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* ── Programme-based home screen ── */
function ProgrammeHome({ S, user, nav }) {
  const today = new Date()
  const [weekBrowserOpen, setWeekBrowserOpen] = useState(false)

  return (
    <div className="narrow">
      <div className="hdr" data-tuto="home-header">
        <div>
          <h1>{user ? t('Hi {0}', user.name) : S.displayName ? t('Hi {0}', S.displayName) : <SasoianWordmark fontSize={28} />}</h1>
          <div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div style={{ fontSize: 11, color: 'var(--label-4)', fontStyle: 'italic', marginTop: 1, letterSpacing: '.01em' }}>Sois en forme, reste en forme</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TutorialButton steps={HOME_STEPS} />
          <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
        </div>
      </div>

      {(() => {
        const prog = activeProgramme(S)
        const wk = prog ? sessionStates(prog, prog.currentWeek) : []
        const doneThisWeek = wk.filter(s => s === 'done').length
        const totalThisWeek = wk.length
        const pct = totalThisWeek ? Math.round((doneThisWeek / totalThisWeek) * 100) : 0
        const { bw, trendDir, delta } = bwTrend(S)
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div className="card" style={{ padding: '11px 12px', marginBottom: 0 }}>
              <div className="small" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.6px', color: 'var(--label-3)', textTransform: 'uppercase' }}>{t('Cette semaine')}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
                <span className="font-display" style={{ fontSize: 21, fontWeight: 700 }}>{doneThisWeek}</span>
                {totalThisWeek > 0 && <span style={{ fontSize: 12, color: 'var(--label-3)', fontWeight: 600 }}>/ {totalThisWeek}</span>}
              </div>
              <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: 'var(--acc)' }} />
              </div>
            </div>
            <div className="card tap" style={{ padding: '11px 12px', marginBottom: 0 }} onClick={() => bwSheet()}>
              <div className="small" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.6px', color: 'var(--label-3)', textTransform: 'uppercase' }}>{t('Poids')}</div>
              {bw ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 6 }}>
                    <span className="font-display" style={{ fontSize: 21, fontWeight: 700 }}>{fmtNum(bw.w)}</span>
                    <span style={{ fontSize: 10, color: 'var(--label-3)', fontWeight: 600 }}>{S.unit}</span>
                    {trendDir && trendDir !== 'stable' && (
                      <Icon name={trendDir === 'up' ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 10, marginLeft: 1, color: bwDeltaColor(delta, bw.w) }} />
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--label-3)', marginTop: 5 }}>{t('Enregistrer')}</div>
                </>
              ) : (
                <>
                  <div className="font-display" style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{t('Aucune pesée')}</div>
                  <div style={{ fontSize: 9, color: 'var(--label-3)', marginTop: 5 }}>{t('Enregistrer')}</div>
                </>
              )}
            </div>
            <div className="card tap" style={{ padding: '11px 12px', marginBottom: 0 }} onClick={measurementsSheet}>
              <div className="small" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.6px', color: 'var(--label-3)', textTransform: 'uppercase' }}>{t('Measurements')}</div>
              <div className="font-display" style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{t('Log')}</div>
              <div style={{ fontSize: 9, color: 'var(--label-3)', marginTop: 5 }}>{t('Enregistrer')}</div>
            </div>
          </div>
        )
      })()}

      {(() => {
        const prog = activeProgramme(S)
        if (!prog) {
          // Every programme is paused or complete — reachable whenever
          // programmes.length > 0 (the only way ProgrammeHome renders at
          // all), unlike the "Programme terminé" branch below which needs
          // a mid-programme prog with no sessions left, in practice unreachable.
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <SectionHead title={t('Prochaine séance')} />
              <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                <div className="font-display" style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t('Aucun programme actif')}</div>
                <div className="muted small">{t('Reprends un programme en pause ou choisis-en un nouveau ci-dessus.')}</div>
              </div>
            </div>
          )
        }
        const ns = nextSession(prog, S.routines)
        const activeRoute = S.active && isCardioSport(S.active.sport) ? '/cardio' : '/workout'
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <SectionHead title={t('Prochaine séance')} action={weekBrowserOpen ? t('Masquer') : t('Voir les semaines')} onAction={() => setWeekBrowserOpen(o => !o)} />
            {S.active ? (
              <div className="card" style={{
                position: 'relative', overflow: 'hidden',
                border: '1.5px solid color-mix(in srgb,var(--orange) 32%,transparent)',
                background: 'linear-gradient(165deg,color-mix(in srgb,var(--orange) 7%,var(--glass-fill)),var(--glass-fill))',
                padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div className="hairline" />
                <div style={{ position: 'relative', fontSize: 10, fontWeight: 700, letterSpacing: '.6px', color: 'var(--orange)', textTransform: 'uppercase' }}>
                  {S.active.pausedAt ? t('En pause') : t('Séance en cours')}
                </div>
                <div className="font-display" style={{ position: 'relative', fontWeight: 700, fontSize: 19 }}>{S.active.name}</div>
                <button className="btn cta" style={{ position: 'relative' }} onClick={() => { if (S.active.pausedAt) { resumeWorkout(); nav(activeRoute) } else nav(activeRoute) }}>
                  <Icon name={S.active.pausedAt ? 'play' : 'timer'} />
                  <span>{S.active.pausedAt ? t('Reprendre') : t('Continuer')}</span>
                </button>
              </div>
            ) : ns && ns.routine ? (
              <div style={{
                position: 'relative', overflow: 'hidden', border: '1px solid color-mix(in srgb,var(--acc) 32%,transparent)', borderRadius: 18,
                background: 'linear-gradient(165deg,color-mix(in srgb,var(--acc) 7%,var(--glass-fill)),var(--glass-fill))',
                padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
                boxShadow: 'inset 0 1px 0 var(--glass-highlight)',
              }}>
                <div className="hairline" />
                <div className="row between" style={{ position: 'relative' }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acc)', display: 'inline-block' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', color: 'var(--acc)', textTransform: 'uppercase' }}>
                      {t('Prochaine')} · {ns.routine.name}
                    </span>
                  </div>
                </div>
                <div style={{ position: 'relative' }}>
                  <div className="font-display" style={{ fontWeight: 700, fontSize: 19 }}>{ns.routine.name}</div>
                  {ns.routine.ex?.length > 0 && (
                    <div style={{ fontSize: 11.5, color: 'var(--label-2)', marginTop: 2 }}>{t('{0} exercises', ns.routine.ex.length)}</div>
                  )}
                </div>
                <button className="btn cta" style={{ position: 'relative' }} onClick={() => confirmStartSheet(ns.routine, () => startFlowForProgramme(prog.id, ns.weekNum, ns.sessionIdx))}>
                  <Icon name="play" />
                  <span>{t('Démarrer la séance')}</span>
                </button>
              </div>
            ) : (
              <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                <div className="font-display" style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{t('Programme terminé')}</div>
                <div className="muted small">{t('Toutes les séances de ce programme ont été complétées.')}</div>
              </div>
            )}
            {weekBrowserOpen && <ProgrammeWeekCarousel S={S} prog={prog} />}
          </div>
        )
      })()}

      {/* Ad-hoc activity CTA — same .btn.cta shimmer family as "Démarrer la séance", in
          the orange accent so the two calls-to-action read as visually distinct, plus
          the mockup's hairline texture on the surrounding card. */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 18,
        border: '1px solid color-mix(in srgb,var(--orange) 32%,transparent)',
        background: 'linear-gradient(165deg,color-mix(in srgb,var(--orange) 9%,var(--glass-fill)),var(--glass-fill))',
        padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        boxShadow: 'inset 0 1px 0 var(--glass-highlight)',
      }}>
        <div className="hairline" />
        <div style={{ position: 'relative' }}>
          <div className="font-display" style={{ fontWeight: 700, fontSize: 16 }}>{t('Activité supplémentaire')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--label-2)', marginTop: 2 }}>{t('Running, cycling, swimming…')}</div>
        </div>
        <button className="btn cta orange" style={{ position: 'relative' }} onClick={cardioLogSheet}>
          <Icon name="figureRun" />
          <span>{t('Log activity')}</span>
        </button>
      </div>

      <NutriWidget S={S} nav={nav} withHeader />

      <SmartNudge S={S} />
      <LastWorkoutCard S={S} />
    </div>
  )
}

/* ── Classic home (no programmes) ── */
function ClassicHome({ S, user, nav, weekOffset, setWeekOffset }) {
  const today = new Date()
  const routine = effectiveRoutine(S, todayISO())
  const [bannerOff, setBannerOff] = useState(() => localStorage.getItem('banner_prog') === '1')
  const [weekViewOpen, setWeekViewOpen] = useState(false)
  const dismissBanner = () => { localStorage.setItem('banner_prog', '1'); setBannerOff(true) }
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const { bw, delta, trendDir, totalDelta, firstBW } = bwTrend(S)

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
  const onToday = () => { if (S.active) nav(activeRoute); else if (routine) confirmStartSheet(routine, () => startFlow(routine.id)); else dayOverrideSheet(todayISO()) }

  return <div className="narrow">
    <div className="hdr" data-tuto="home-header">
      <div>
        <h1>{user ? t('Hi {0}', user.name) : S.displayName ? t('Hi {0}', S.displayName) : 'openGym'}</h1>
        <div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div style={{ fontSize: 11, color: 'var(--label-4)', fontStyle: 'italic', marginTop: 1, letterSpacing: '.01em' }}>Sois en forme, reste en forme</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TutorialButton steps={HOME_STEPS} />
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
      </div>
    </div>

    {!S.simpleMode && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div className="card" style={{ padding: '11px 12px', marginBottom: 0 }}>
          <div className="small" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.6px', color: 'var(--label-3)', textTransform: 'uppercase' }}>{t('Cette semaine')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
            <span className="font-display" style={{ fontSize: 21, fontWeight: 700 }}>{wThisWeek}</span>
            {plannedPerWeek > 0 && <span style={{ fontSize: 12, color: 'var(--label-3)', fontWeight: 600 }}>/ {plannedPerWeek}</span>}
          </div>
          <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: (plannedPerWeek ? Math.min(100, Math.round((wThisWeek / plannedPerWeek) * 100)) : 0) + '%', height: '100%', background: 'var(--acc)' }} />
          </div>
        </div>
        <div className="card tap" style={{ padding: '11px 12px', marginBottom: 0 }} onClick={() => bwSheet()}>
          <div className="small" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.6px', color: 'var(--label-3)', textTransform: 'uppercase' }}>{t('Poids')}</div>
          {bw ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 6 }}>
                <span className="font-display" style={{ fontSize: 21, fontWeight: 700 }}>{fmtNum(bw.w)}</span>
                <span style={{ fontSize: 10, color: 'var(--label-3)', fontWeight: 600 }}>{S.unit}</span>
                {trendDir && trendDir !== 'stable' && (
                  <Icon name={trendDir === 'up' ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 10, marginLeft: 1, color: bwDeltaColor(delta, bw.w) }} />
                )}
              </div>
              <div style={{ fontSize: 9, color: 'var(--label-3)', marginTop: 5 }}>{t('Enregistrer')}</div>
            </>
          ) : (
            <>
              <div className="font-display" style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{t('Aucune pesée')}</div>
              <div style={{ fontSize: 9, color: 'var(--label-3)', marginTop: 5 }}>{t('Enregistrer')}</div>
            </>
          )}
        </div>
        <div className="card tap" style={{ padding: '11px 12px', marginBottom: 0 }} onClick={measurementsSheet}>
          <div className="small" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.6px', color: 'var(--label-3)', textTransform: 'uppercase' }}>{t('Measurements')}</div>
          <div className="font-display" style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{t('Log')}</div>
          <div style={{ fontSize: 9, color: 'var(--label-3)', marginTop: 5 }}>{t('Enregistrer')}</div>
        </div>
      </div>
    )}

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

    <SectionHead title={t('Cette semaine')} action={weekViewOpen ? t('Masquer') : t('Voir les semaines')} onAction={() => setWeekViewOpen(o => !o)} />
    <div data-tuto="home-week">
      {weekViewOpen && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 8 }}>
            <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
            <div className="small muted" style={{ fontWeight: 500 }}>{wkLabel}</div>
            <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
          </div>
          <div className="week">{strip}</div>
        </div>
      )}
      <div className="card tap" data-tuto="home-today" onClick={onToday} style={S.active ? { background: 'color-mix(in srgb,var(--orange) 8%,var(--surface-2))' } : undefined}>
        <div className="row" style={{ gap: 9, minWidth: 0 }}>
          <span className="lrow-i" style={{ background: S.active ? 'var(--orange)' : routine ? 'var(--acc)' : 'var(--surface-3)' }}>
            <Icon name={S.active ? 'timer' : routine ? glyphOf(routine.emoji) : 'moon'} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="lbl2">{t('Today')}</div>
            <div className="ttl">{S.active ? t('{0} — in progress', S.active.name) : routine ? routine.name : t('Rest day')}{todayOvr && routine ? ' \xB7 ' + t('rescheduled') : ''}</div>
          </div>
        </div>
        {S.active ? <span className="tag resume pop">{S.active.pausedAt ? t('En pause') : t('Resume')}</span>
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
        <div className="muted small" style={{ marginBottom: 12 }}>{t('Créez votre planning hebdomadaire pour démarrer — ou chargez un plan Push / Pull / Legs prêt à l\'emploi.')}</div>
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

    <div className="card tap" data-tuto="home-bw" onClick={() => nav('/bodyweight')}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={e => { e.stopPropagation(); goalSheet() }}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
          <Button size="sm" icon="plus" onClick={e => { e.stopPropagation(); bwSheet() }}>{t('Log')}</Button>
        </div>
      </div>
      {bw ? <>
        {/* framed weight reading with direction indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg,color-mix(in srgb,var(--blue) 8%,var(--surface-2)),var(--surface-2))', border: '1px solid color-mix(in srgb,var(--blue) 14%,transparent)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
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
      <div
        className="card tappable"
        data-tuto="home-streak"
        onClick={() => calendarSheet()}
        style={{
          background: 'linear-gradient(135deg,color-mix(in srgb,var(--orange) 12%,var(--surface)),color-mix(in srgb,var(--orange) 4%,var(--surface)))',
          border: '1px solid color-mix(in srgb,var(--orange) 28%,transparent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, background: 'color-mix(in srgb,var(--orange) 18%,transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: 'var(--orange)', flexShrink: 0 }}>
            <Icon name="flame" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--orange)', lineHeight: 1.2 }}>
              {t('{0} week streak', streakWeeks(S))}
            </div>
            <div className="muted small" style={{ marginTop: 3 }}>
              {wThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')}{' · '}{t(S.workouts.length === 1 ? '{0} workout total' : '{0} workouts total', S.workouts.length)}
            </div>
            {plannedPerWeek > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                {Array.from({ length: Math.min(plannedPerWeek, 7) }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 99,
                    background: i < wThisWeek ? 'var(--orange)' : 'color-mix(in srgb,var(--orange) 22%,var(--surface-3))',
                  }} />
                ))}
              </div>
            )}
          </div>
          <Icon name="chevronRight" className="chev" style={{ fontSize: 16, color: 'var(--orange)', opacity: 0.55, flexShrink: 0 }} />
        </div>
      </div>
    )}

    {/* ── Ad-hoc activity CTA — same .btn.cta shimmer family as the workout
         start flow, orange accent + hairline texture, matching ProgrammeHome ── */}
    <div data-tuto="home-activity" style={{
      position: 'relative', overflow: 'hidden', borderRadius: 18,
      border: '1px solid color-mix(in srgb,var(--orange) 32%,transparent)',
      background: 'linear-gradient(165deg,color-mix(in srgb,var(--orange) 9%,var(--glass-fill)),var(--glass-fill))',
      padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
      boxShadow: 'inset 0 1px 0 var(--glass-highlight)',
    }}>
      <div className="hairline" />
      <div style={{ position: 'relative' }}>
        <div className="font-display" style={{ fontWeight: 700, fontSize: 16 }}>{t('Activité supplémentaire')}</div>
        <div style={{ fontSize: 11.5, color: 'var(--label-2)', marginTop: 2 }}>{t('Running, cycling, swimming…')}</div>
      </div>
      <button className="btn cta orange" style={{ position: 'relative' }} onClick={cardioLogSheet}>
        <Icon name="figureRun" />
        <span>{t('Log activity')}</span>
      </button>
    </div>
  </div>
}
