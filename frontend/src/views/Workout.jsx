import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { effectiveRoutine, lastEntryFor, bestWeightFor, buildSets, setsDoneActive, supersetUnits, unitOf, setLabel, modeOf, isBw, isPerSide, sideReps, repStep, EFFORT, effortOf, stepEffort, capEffort } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, exCount, DAYN } from '../lib/format.js'
import { beep, vibrate } from '../lib/sound.js'
import { t } from '../lib/i18n.js'
import { api } from '../lib/api.js'
import Media from '../components/Media.jsx'
import { startFlow, exercisePicker, exConfigSheet, exerciseDetailSheet, topWeightSheet, finishWorkout, workoutCompleteSheet, confirmSheet, swapExerciseSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Check, NumberField } from '../components/ui.jsx'
import { nextPrescription, applyPrescription } from '../lib/progression.js'
import { historicalBests, prKindOf } from '../lib/prs.js'
import { estimate1RM } from '../lib/onerm.js'
import { glyphOf } from '../lib/glyphs.js'

/* Muscle-group accent colors — drives card left-border + tag tint */
const BP_COLOR = {
  chest:         'var(--acc)',
  back:          'var(--blue)',
  shoulders:     'var(--purple)',
  'upper arms':  'var(--orange)',
  'lower arms':  'var(--yellow)',
  waist:         'var(--teal)',
  'upper legs':  'var(--pink)',
  'lower legs':  'var(--teal)',
  neck:          'var(--label-3)',
  cardio:        'var(--orange)',
}
const bpColorOf = ex => BP_COLOR[ex.bp] || 'var(--label-3)'

/* ---------- start chooser (no active workout) ---------- */
function StartChooser() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const todayRaw = effectiveRoutine(S, todayISO())
  const todayR = todayRaw && ((todayRaw.ex?.length ?? 0) > 0 || (todayRaw.blocks?.length ?? 0) > 0) ? todayRaw : null
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const others = S.routines.filter(r => r !== todayRaw && ((r.ex?.length ?? 0) > 0 || (r.blocks?.length ?? 0) > 0))
  return <div className="narrow">
    <div className="hdr">
      <div><h1>{t("Start workout")}</h1><div className="sub">{t(DAYN[new Date().getDay()])} — {todayR ? t("today is {0}", todayR.name) : t("rest day, but no one's stopping you")}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>
    {todayR && (() => {
      const exSlice = (todayR.ex || []).slice(0, 4)
      return (
        <div className="card" style={{
          borderColor: 'color-mix(in srgb,var(--acc) 45%,transparent)',
          borderWidth: 1.5,
          background: 'linear-gradient(145deg,color-mix(in srgb,var(--acc) 13%,var(--surface)),color-mix(in srgb,var(--acc) 4%,var(--surface)))',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* accent glow orb */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle,color-mix(in srgb,var(--acc) 22%,transparent),transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--acc)', marginBottom: 3 }}>
                {t("Today's plan")}{todayOvr ? ' · ' + t('rescheduled') : ''}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.15 }}>{todayR.name}</div>
              <div className="muted small" style={{ marginTop: 2 }}>{exCount(todayR.ex?.length ?? 0)}</div>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 14, fontSize: 26, flexShrink: 0, background: 'var(--acc)', color: 'var(--on-acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px -2px color-mix(in srgb,var(--acc) 50%,transparent)' }}>
              <Icon name={glyphOf(todayR.emoji)} />
            </div>
          </div>
          {/* Exercise preview chips */}
          {exSlice.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
              {exSlice.map(e => {
                const ex = exOr(e.id || e)
                const col = bpColorOf(ex)
                return (
                  <span key={e.id || e} style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                    background: `color-mix(in srgb,${col} 14%,var(--surface-2))`,
                    color: col,
                    border: `1px solid color-mix(in srgb,${col} 22%,transparent)`,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120,
                  }}>{ex.n}</span>
                )
              })}
              {(todayR.ex?.length ?? 0) > 4 && (
                <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--label-3)' }}>
                  +{(todayR.ex?.length ?? 0) - 4}
                </span>
              )}
            </div>
          )}
          <Button variant="primary" icon="play" onClick={() => startFlow(todayR.id)}>{t('Start {0}', todayR.name)}</Button>
        </div>
      )
    })()}
    {others.length > 0 && <><h4 className="sec">{t('Other routines')}</h4>
      <div className="list">{others.map(r => {
        const isCardio = r.sport && r.sport !== 'strength'
        const col = isCardio ? 'var(--teal)' : 'var(--acc)'
        return (
          <div key={r.id} className="item" onClick={() => startFlow(r.id)}>
            <span className="lrow-i" style={{ background: `color-mix(in srgb,${col} 18%,var(--surface-3))`, color: col }}>
              <Icon name={glyphOf(r.emoji)} />
            </span>
            <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex?.length ?? r.blocks?.length ?? 0)}</div></div>
            <span className="tag nocap" style={{ background: `color-mix(in srgb,${col} 14%,transparent)`, color: col, fontSize: 11, fontWeight: 700 }}>{t('Start')}</span>
          </div>
        )
      })}</div></>}
    <div style={{ height: 14 }} />
    <Button icon="shuffle" onClick={() => startFlow(null)}>{t('Freestyle workout (pick as you go)')}</Button>
    {!S.routines.length && <><div style={{ height: 10 }} /><Button variant="primary" onClick={() => nav('/plan')}>{t('Build a plan first')}</Button></>}
  </div>
}

/* ---------- elapsed clock (isolated so the workout tree doesn't re-render every second) ---------- */
function Elapsed({ start }) {
  const [t, setT] = useState('0:00')
  useEffect(() => {
    const tick = () => { const s = Math.floor((Date.now() - start) / 1000); setT(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')) }
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv)
  }, [start])
  return <span>{t}</span>
}

/* ---------- one exercise block (reps: weight×reps · time: a held duration · cardio: duration+speed) ---------- */
function ExerciseBlock({ entryIdx, compact, onToggle, onField, onAddSet, onRemoveSet, onStartTimed, onSwap }) {
  const S = useStore(s => s.S)
  const working = useUI(s => s.work)
  const entry = S.active.entries[entryIdx]
  const ex = exOr(entry.id)
  const mode = modeOf({ ...(entry.target || {}), id: entry.id })
  const cardio = mode === 'cardio'
  const timed = mode === 'time'
  const last = lastEntryFor(S, entry.id)
  // The same number the "confirm your working weight" sheet calls your best, so the two
  // never disagree inside one session: heaviest logged set, or the working weight you kept.
  const best = cardio ? 0 : Math.max(bestWeightFor(S, entry.id), (S.exWeights[entry.id] || {}).w || 0)
  // What the progression policy decided for this session, and why (issue #17). Computed when
  // the session was built so the reason matches the numbers already in the rows.
  const plan = entry.plan
  // A bodyweight set has no weight to type, so the column is not there (issue #32) — one
  // stepper instead of two, which is the whole point of the flag. Adding a belt weight in the
  // config brings it back, now labelled as the addition it is.
  const cfg = { ...(entry.target || {}), id: entry.id }
  const bw = !cardio && isBw(cfg)
  const added = bw && entry.sets.some(s => s.w > 0)
  const loadCol = { f: 'w', step: 2.5, dec: true, hd: bw ? t('Added ({0})', S.unit) : t('Weight ({0})', S.unit) }
  // The reps column is the total in every mode, unilateral included — the stepper walks in
  // twos there so the number you land on is one you can actually split evenly.
  const repCol = { f: 'r', step: repStep(cfg), dec: false, hd: t('Reps') }
  const col1 = cardio ? { f: 'min', step: 1, dec: false, hd: t('Duration (min)') }
    : timed ? { f: 'sec', step: 5, dec: false, hd: t('Seconds') }
      : (bw && !added) ? repCol : loadCol
  const col2 = cardio ? { f: 'speed', step: 0.5, dec: true, hd: t('Speed (km/h)') }
    : timed ? ((bw && !added) ? null : loadCol)
      : (bw && !added) ? null : repCol
  // Effort (RIR or RPE, whichever the profile logs) only makes sense for weighted rep sets,
  // not cardio/timed holds, and is opt-in since it adds a third stepper to every row. `opt`
  // because an unlogged effort is not the same as 0 — RIR 0 says the set went to failure.
  const kind = effortOf(S)
  const eff = EFFORT[kind]
  const col3 = mode === 'reps' && eff ? { ...eff, eff: kind, dec: true, opt: true, hd: t(eff.hd) } : null
  // The effort column walks its own scale — see stepEffort. Weight and reps step up from 0
  // with no ceiling, as they always did.
  const bump = (s, i, col, dir) => {
    if (col.eff) return onField(i, col.f, stepEffort(col.eff, s[col.f], dir))
    onField(i, col.f, Math.max(0, Math.round(((s[col.f] || 0) + dir * col.step) * 100) / 100))
  }
  // Uses the shared stepper markup so a set row picks up the same control styling
  // as every other +/- field in the app.
  const cell = (s, i, col, cls) => (
    <div className={'stp ' + cls}>
      <button aria-label="Decrease" onClick={() => bump(s, i, col, -1)}><Icon name="minus" /></button>
      {/* a typed effort is capped — there is no RPE 12, and 12 reps in reserve is a warm-up */}
      <span className="val"><NumberField decimal={col.dec} nullable={col.opt} value={s[col.f] ?? ''}
        onChange={v => onField(i, col.f, col.eff ? capEffort(col.eff, v) : v)} /></span>
      <button aria-label="Increase" onClick={() => bump(s, i, col, 1)}><Icon name="plus" /></button>
    </div>
  )
  const bpColor = bpColorOf(ex)
  return <>
    <Media ex={ex} key={entry.id} compact={compact} minimizable />
    <div className="row between" style={{ marginBottom: 6 }}>
      <div style={{ fontSize: compact ? 17 : 20, fontWeight: 600, letterSpacing: '-.02em', textTransform: 'capitalize', lineHeight: 1.2 }}>{ex.n}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {onSwap && <button className="iconbtn" aria-label={t('Switch exercise')} onClick={() => swapExerciseSheet(entry.id, onSwap)}><Icon name="shuffle" /></button>}
        <button className="iconbtn" aria-label={t('Details')} onClick={() => exerciseDetailSheet(ex)}><Icon name="info" /></button>
      </div>
    </div>
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
      {cardio && <span className="tag acc"><Icon name="figureRun" />{t('Cardio')}</span>}
      {!cardio && !timed && isPerSide(cfg) && <span className="tag acc nocap"><Icon name="shuffle" />{t('{0} per side', fmtNum(sideReps(entry.sets.find(s => !s.done)?.r ?? entry.sets[0]?.r)))}</span>}
      {(ex.tg || ex.bp) && (
        <span className="tag nocap" style={{
          background: `color-mix(in srgb,${bpColor} 16%,var(--surface-2))`,
          color: bpColor,
          border: `1px solid color-mix(in srgb,${bpColor} 28%,transparent)`,
        }}>{t(ex.tg || ex.bp)}</span>
      )}
      {ex.eq && <span className="tag">{t(ex.eq)}</span>}
      {best > 0 && <span className="tag nocap pr-ref">{t('Best:')} {fmtNum(best)} {S.unit}</span>}
    </div>
    {last && <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 4, fontSize: 13, color: 'var(--label-3)' }}><Icon name="history" style={{ fontSize: 11, flexShrink: 0, color: 'var(--label-3)' }} /><span>{fmtDate(last.d)}: {last.sets.map(s => setLabel(entry.id, s, last.target)).join(', ')}</span></div>}
    {plan && plan.why && plan.kind !== 'off' && <div className={'progline' + (plan.kind === 'deload' ? ' warn' : '')}>
      <Icon name={plan.kind === 'up' ? 'arrowUp' : plan.kind === 'deload' ? 'arrowDown' : 'lightbulb'} />
      <span>{t(...plan.why)}</span>
    </div>}
    <div className="card" style={{
      marginTop: 10, marginBottom: 0,
      borderLeft: `3px solid color-mix(in srgb,${bpColor} 55%,transparent)`,
    }}>
      {/* the header carries the same eff3 sizing as the rows, or the labels drift off their columns */}
      <div className={'sethead' + (col3 ? ' eff3' : '')}><span className="n-sp" /><span className="w-sp">{col1.hd}</span>{col2 && <span className="r-sp">{col2.hd}</span>}{col3 && <span className="eff-sp">{col3.hd}</span>}{timed && <span className="ck-sp" />}<span className="ck-sp" /></div>
      {entry.sets.map((s, i) => <div key={i} className={'setrow' + (s.done ? ' done' : '') + (col3 ? ' eff3' : '')}>
        <div className={'n' + (s.pr ? ' pr-hit' : '')}>{i + 1}</div>
        {cell(s, i, col1, 'w')}
        {col2 && cell(s, i, col2, 'r')}
        {col3 && cell(s, i, col3, 'eff')}
        {/* A timed set is started, not typed: the timer counts the hold down and checks the
            set off itself. The checkbox stays for anyone who timed it on their own watch. */}
        {timed && <button className="setgo" aria-label={t('Start set')} disabled={s.done || !!working}
          onClick={() => onStartTimed(i)}><Icon name="play" /></button>}
        <Check checked={s.done} onChange={() => onToggle(i)} />
      </div>)}
      <div style={{ height: 8 }} />
      <div className="row">
        <Button size="sm" icon="minus" disabled={entry.sets.length <= 1} onClick={onRemoveSet}>{t('Remove set')}</Button>
        <Button size="sm" icon="plus" onClick={onAddSet}>{t('Add set')}</Button>
      </div>
    </div>
  </>
}

/* ---------- active workout ---------- */
function ActiveWorkout() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { startRest, stopRest } = useUI()
  const A = S.active
  const units = supersetUnits(A.entries)
  const cur = Math.min(A.cur, Math.max(0, A.entries.length - 1))
  const unit = A.entries.length ? unitOf(units, cur) : []
  const unitIdx = units.findIndex(u => u === unit)
  const isSuperset = unit.length > 1

  const total = A.entries.reduce((n, e) => n + e.sets.length, 0)
  const done = setsDoneActive(A)

  const mutEntry = (idx, fn) => update(s => { fn(s.active.entries[idx]) }, true)
  // Clearing an optional field drops the key rather than storing null, so a set only carries
  // what was actually logged — in the session, in history and in a backup.
  const setField = (idx, i, field, v) => mutEntry(idx, e => {
    if (v == null) delete e.sets[i][field]; else e.sets[i][field] = v
  })
  const modeAt = idx => modeOf({ ...(A.entries[idx].target || {}), id: A.entries[idx].id })
  const addSet = idx => mutEntry(idx, e => {
    const l = e.sets[e.sets.length - 1]
    const m = modeOf({ ...(e.target || {}), id: e.id })
    if (m === 'cardio') e.sets.push({ min: l ? l.min : (e.target.min || 20), speed: l ? l.speed : (e.target.speed || 8), done: false })
    else if (m === 'time') e.sets.push({ sec: l ? l.sec : (e.target.sec || 45), w: l ? (l.w || 0) : (e.target.weight || 0), done: false })
    else e.sets.push({ w: l ? l.w : 0, r: l ? l.r : e.target.reps, done: false })
  })
  const removeSet = idx => mutEntry(idx, e => { if (e.sets.length > 1) e.sets.pop() })

  // A timed set is held, not typed. The work timer records what was actually held — an early
  // finish logs 0:38 of a 0:45 target rather than crediting the full prescription — and then
  // checks the set off through the normal path, so rest, supersets and the finish prompt all
  // behave exactly as they do for a reps set.
  const startTimed = (idx, i) => {
    const e = A.entries[idx]
    useUI.getState().startWork(e.sets[i].sec || 45, exOr(e.id).n, elapsed => {
      mutEntry(idx, en => { en.sets[i].sec = elapsed })
      if (!useStore.getState().S.active.entries[idx].sets[i].done) toggle(idx, i)
    })
  }

  const toggle = (idx, i) => {
    const m = modeAt(idx)
    const cardioEntry = m === 'cardio'
    const isLastUnit = unitIdx >= units.length - 1
    // Capture pre-toggle state for PR check — bestWeightFor reads workouts history only,
    // so it reflects the all-time best before this session's active sets.
    const entrySnap = A.entries[idx]
    const isLoadedReps = m === 'reps' && !isBw({ ...(entrySnap.target || {}), id: entrySnap.id })
    const setWeight = entrySnap.sets[i]?.w || 0
    const setReps = entrySnap.sets[i]?.r || 0
    // Compute bests before the set is mutated (so this set doesn't count against itself).
    const histBests = isLoadedReps ? (() => {
      const b = historicalBests(S, entrySnap.id)
      const exW = (S.exWeights[entrySnap.id] || {}).w || 0
      if (exW > b.weight) b.weight = exW
      return b
    })() : null
    let askTop = false, exJustDone = false, workoutDone = false, prKind = null
    mutEntry(idx, e => {
      e.sets[i].done = !e.sets[i].done
      if (e.sets[i].done) {
        beep(S.sound, 1040, 0.12); vibrate(30)
        if (isLoadedReps && setWeight > 0 && setReps > 0) {
          prKind = prKindOf(histBests, setWeight, setReps)
          if (prKind) e.sets[i].pr = prKind
        }
        const isLastExInUnit = idx === unit[unit.length - 1]
        const unitDone = unit.every(ui => (ui === idx ? e : A.entries[ui]).sets.every(x => x.done))
        if (isLastExInUnit && !unitDone) startRest(S.restSec)
        else if (unitDone) stopRest()
        if (unitDone && isLastUnit) workoutDone = true      // last exercise's last set → done
        const loaded = m === 'reps' && !(isBw({ ...(e.target || {}), id: e.id }) && !e.sets.some(x => x.w > 0))
        if (e.sets.every(x => x.done)) { exJustDone = true; if (loaded && !e.asked) { e.asked = true; askTop = true } }
      } else {
        delete e.sets[i].pr
      }
    })
    if (prKind) {
      vibrate([80, 60, 80, 60, 200])
      if (prKind === 'weight') useUI.getState().toast(t('New PR — {0} {1}!', fmtNum(setWeight), S.unit), 'pr')
      else if (prKind === 'reprange') useUI.getState().toast(t('New {0}-rep best — {1} {2}!', Math.round(setReps), fmtNum(setWeight), S.unit), 'pr')
      else { const est = estimate1RM(setWeight, setReps); useUI.getState().toast(t('New estimated 1RM — {0} {1}!', fmtNum(est), S.unit), 'pr') }
    }
    if (askTop) topWeightSheet(idx)
    else if (workoutDone) workoutCompleteSheet()
    else if (exJustDone && cardioEntry) useUI.getState().toast(t('Cardio logged'))
    else if (exJustDone && m === 'time') useUI.getState().toast(t('Hold logged'))
  }

  // Live-presence heartbeat so the admin dashboard can show who's training now. Signed-in only —
  // guests have no server session. Reads fresh state each tick so progress stays current.
  useEffect(() => {
    if (!useStore.getState().user) return
    let stopped = false
    const ping = active => {
      const A2 = useStore.getState().S.active
      if (!A2) return
      const u = supersetUnits(A2.entries)
      const c = Math.min(A2.cur, Math.max(0, A2.entries.length - 1))
      const ui = u.findIndex(x => x.includes(c))
      const tot = A2.entries.reduce((n, e) => n + e.sets.length, 0)
      api('/api/activity', { method: 'POST', body: JSON.stringify({
        active, name: A2.name, exIdx: ui + 1, exTotal: u.length,
        setsDone: setsDoneActive(A2), setsTotal: tot, startedAt: A2.start
      }) }).catch(() => {})
    }
    ping(true)
    const iv = setInterval(() => { if (!stopped) ping(true) }, 20000)
    return () => {
      stopped = true; clearInterval(iv)
      // best-effort "left" signal: sendBeacon survives a tab close, fetch covers in-app nav
      try { navigator.sendBeacon?.('/api/activity', new Blob([JSON.stringify({ active: false })], { type: 'application/json' })) } catch { /* */ }
      api('/api/activity', { method: 'POST', body: JSON.stringify({ active: false }) }).catch(() => {})
    }
  }, [])

  const volume = A.entries.reduce((vol, e) => {
    if (modeOf({ ...(e.target || {}), id: e.id }) !== 'reps') return vol
    return vol + e.sets.filter(s => s.done && s.w > 0 && s.r > 0).reduce((sv, s) => sv + s.w * s.r, 0)
  }, 0)

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" aria-label={t('Discard')} onClick={() => confirmSheet({ title: t('Discard workout?'), message: t('The sets you logged in this session will be lost.'), confirmText: t('Discard'), danger: true, onConfirm: () => { update(s => { s.active = null }); stopRest(); nav('/home') } })}><Icon name="xmark" /></button>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 600 }}>{A.name}</div>
        <div className="sub">
          <Elapsed start={A.start} /> · {t('{0} sets', done + '/' + total)}{volume > 0 ? ' · ' + fmtNum(Math.round(volume)) + ' ' + S.unit : ''}
        </div>
      </div>
      <button className="iconbtn" style={{ color: 'var(--acc)' }} aria-label={t('Finish')} onClick={finishWorkout}><Icon name="check" /></button>
    </div>
    <div className="wprog"><i style={{ width: (total ? done / total * 100 : 0) + '%' }} /></div>

    {A.entries.length ? <>
      {/* Exercise position chips — labeled with number+letter so supersets are unambiguous */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: 5, marginBottom: 10, scrollbarWidth: 'none', WebkitScrollbarWidth: 'none', paddingBottom: 2 }}>
        {units.map((u, i) => {
          const isDone = u.every(idx => A.entries[idx].sets.every(s => s.done))
          const isCur = i === unitIdx
          const isSS = u.length > 1
          const goTo = () => update(s => { s.active.cur = units[i][0] })
          if (isSS) {
            return (
              <button key={i} onClick={goTo}
                style={{ display: 'flex', gap: 2, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                {u.map((_, k) => {
                  const lbl = `${i + 1}${String.fromCharCode(65 + k)}`
                  return (
                    <span key={k} style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '4px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                      background: isCur ? 'var(--acc)' : isDone ? 'color-mix(in srgb,var(--teal) 18%,var(--surface-2))' : 'var(--surface-2)',
                      color: isCur ? 'var(--on-acc)' : isDone ? 'var(--teal)' : 'var(--label-2)',
                      opacity: isDone ? .9 : 1,
                    }}>{lbl}</span>
                  )
                })}
              </button>
            )
          }
          const lbl = `${i + 1}`
          return (
            <button key={i} onClick={goTo}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '4px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                background: isCur ? 'var(--acc)' : isDone ? 'color-mix(in srgb,var(--teal) 18%,var(--surface-2))' : 'var(--surface-2)',
                color: isCur ? 'var(--on-acc)' : isDone ? 'var(--teal)' : 'var(--label-2)',
                opacity: isDone ? .9 : 1,
                border: 'none', cursor: 'pointer',
              }}
            >{lbl}</button>
          )
        })}
      </div>
      {isSuperset ? (
        <div className="ss-card">
          <div className="ss-hd"><Icon name="link" style={{ fontSize: 14 }} />{t('Superset — back-to-back, rest after all')}</div>
          {unit.length >= 2 && (
            <div className="ss-overview">
              {unit.map((idx, k) => {
                const ex2 = exOr(A.entries[idx].id)
                const done2 = A.entries[idx].sets.every(s => s.done)
                const letter = String.fromCharCode(65 + k)
                return (
                  <div key={idx} className={'ss-ov-item' + (done2 ? ' done' : '')}>
                    <span className="ss-badge" style={{ flexShrink: 0 }}>{letter}</span>
                    <span className="ss-ov-name">{ex2.n}</span>
                    {done2 && <Icon name="checkCircle" style={{ fontSize: 14, color: 'var(--acc)', flexShrink: 0 }} />}
                  </div>
                )
              })}
            </div>
          )}
          <div className="ss-body">
            {unit.map((idx, k) => <div key={idx} className="ss-ex">
              {k > 0 && <div className="ss-amp">
                <span className="ss-amp-line" />
                <span className="ss-amp-pill"><Icon name="arrowDown" style={{ fontSize: 11 }} />{t('then')}</span>
                <span className="ss-amp-line" />
              </div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="ss-badge">{String.fromCharCode(65 + k)}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--acc)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {t('Exercise {0}', `${unitIdx + 1}${String.fromCharCode(65 + k)}`)}
                </span>
              </div>
              <ExerciseBlock entryIdx={idx} compact
                onToggle={i => toggle(idx, i)} onField={(i, f, v) => setField(idx, i, f, v)} onAddSet={() => addSet(idx)} onRemoveSet={() => removeSet(idx)} onStartTimed={i => startTimed(idx, i)}
                onSwap={newEx => update(s => { s.active.entries[idx].id = newEx.id })} />
            </div>)}
          </div>
        </div>
      ) : (
        <ExerciseBlock key={A.entries[cur]?.id} entryIdx={cur} onToggle={i => toggle(cur, i)} onField={(i, f, v) => setField(cur, i, f, v)} onAddSet={() => addSet(cur)} onRemoveSet={() => removeSet(cur)} onStartTimed={i => startTimed(cur, i)}
          onSwap={newEx => update(s => { s.active.entries[cur].id = newEx.id })} />
      )}
    </> : <div className="empty"><div className="ico"><Icon name="shuffle" /></div>{t('Freestyle workout — add your first exercise.')}</div>}

    <div style={{ height: 12 }} />
    {/* "Next up" preview — shown when there's a next unit */}
    {unitIdx >= 0 && unitIdx < units.length - 1 && (() => {
      const nextUnit = units[unitIdx + 1]
      const nextNames = nextUnit.map(idx => exOr(A.entries[idx].id).n)
      const allCurDone = unit.every(idx => A.entries[idx].sets.every(s => s.done))
      return (
        <div style={{
          padding: '7px 10px', marginBottom: 4,
          display: 'flex', alignItems: 'center', gap: 8,
          background: allCurDone ? 'color-mix(in srgb,var(--acc) 8%,var(--surface-2))' : 'var(--surface-2)',
          border: `1px solid ${allCurDone ? 'color-mix(in srgb,var(--acc) 20%,transparent)' : 'var(--sep)'}`,
          borderRadius: 10,
          opacity: allCurDone ? 1 : 0.55,
          transition: 'opacity .3s, background .3s, border-color .3s',
        }}>
          <Icon name="chevronRight" style={{ fontSize: 11, color: allCurDone ? 'var(--acc)' : 'var(--label-4)', flexShrink: 0 }} />
          <span className="small" style={{ color: allCurDone ? 'var(--label-2)' : 'var(--label-3)', fontWeight: allCurDone ? 500 : 400 }}>
            {t('Next')}: <span style={{ textTransform: 'capitalize' }}>{nextNames.join(' & ')}</span>
          </span>
        </div>
      )
    })()}
    {(() => {
      const allCurDone = unit.length > 0 && unit.every(idx => A.entries[idx].sets.every(s => s.done))
      const hasNext = unitIdx >= 0 && unitIdx < units.length - 1
      return (
        <div className="row">
          <Button icon="chevronLeft" disabled={unitIdx <= 0} onClick={() => update(s => { s.active.cur = units[unitIdx - 1][0] })}>{t('Prev')}</Button>
          <Button
            variant={hasNext ? 'primary' : undefined}
            trailingIcon="chevronRight"
            disabled={!hasNext}
            className={allCurDone && hasNext ? 'btn-next-ready' : ''}
            onClick={() => update(s => { s.active.cur = units[unitIdx + 1][0] })}
          >{t('Next')}</Button>
        </div>
      )
    })()}
    <div style={{ height: 10 }} />
    <Button onClick={() => exercisePicker(ex => exConfigSheet(ex, null, cfg => update(s => {
      const full = { ...cfg, id: ex.id }
      const plan = nextPrescription(s, full, s.routines.find(r => r.id === s.active.routineId))
      s.active.entries.push({ id: ex.id, target: { ...cfg }, plan, sets: applyPrescription(buildSets(s, full), plan) })
      s.active.cur = s.active.entries.length - 1
    }), null, S.routines.find(r => r.id === A.routineId), true))} icon="plus">{t('Add exercise')}</Button>
    <div style={{ height: 10 }} />
    {(() => {
      const exDone = A.entries.filter(e => e.sets.length && e.sets.every(s => s.done)).length
      const allDone = A.entries.length > 0 && exDone === A.entries.length
      return <button key={allDone ? 'done' : 'early'} className={allDone ? 'btn primary finish-cta' : 'btn ghost dim'} onClick={finishWorkout}>
        {allDone ? t('Finish workout') : t('Finish workout early · {0} exercises', exDone + '/' + A.entries.length)}
      </button>
    })()}
    <div style={{ height: 40 }} />
  </div>
}

export default function Workout() {
  const active = useStore(s => s.S.active)
  return active ? <ActiveWorkout /> : <StartChooser />
}
