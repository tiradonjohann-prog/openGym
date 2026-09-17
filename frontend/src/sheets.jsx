import { useEffect, useRef, useState } from 'react'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { EXDB, EXIDX, BODYPARTS, isCardio, isBodyweightEq, allExercises, equipmentOf, swDataFor } from './lib/exercises.js'
import { fmtDate, fmtNum, fmtVol, fmtDur, durPart, todayISO, uid, exCount, DAYN, MONTHS_LONG, ACCENTS } from './lib/format.js'
import { lastEntryFor, bestWeightFor, buildSets, effectiveRoutineId, workoutVolume, setsDone, setsDoneActive, lastBW, supersetUnits, unitOf, setLabel, defaultConfig, cleanupSg, modeOf, effortOf, isBw, isPerSide, sideReps, exLine } from './lib/history.js'
import { beep, vibrate } from './lib/sound.js'
import { t, instrFor, getLang, INSTR_LANGS } from './lib/i18n.js'
import { nav } from './lib/nav.js'
import { starterRoutines } from './lib/starter.js'
import Media, { Thumb } from './components/Media.jsx'
import Stepper from './components/Stepper.jsx'
import Icon from './components/Icon.jsx'
import { Button, Slider, Switch, Segmented, SelectRow, Row, SearchField } from './components/ui.jsx'
import { glyphOf, GLYPH_GROUPS, DEFAULT_GLYPH } from './lib/glyphs.js'
import BodyMap from './components/BodyMap.jsx'
import { loadOfWorkouts } from './lib/muscles.js'
import { parseImport, mergeImport } from './lib/import-csv.js'
import { parseProgram } from './lib/programImport.js'
import { downloadExcelTemplate } from './lib/excelTemplate.js'
import { buildPlanBundle, parsePlan, mergePlan, printPlan } from './lib/plan-share.js'
import { estimate1RM, best1RM, is1RMRecord, REP_CAP } from './lib/onerm.js'
import { nextPrescription, applyPrescription, policyFor, defaultIncrement, POLICIES_FOR, POLICY_NAME, POLICY_DESC, MAX_BW_SETS } from './lib/progression.js'
import { MOBILE, shareExport } from './lib/mobile.js'
import { pickImage, isUserImage } from './lib/imageUtils.js'
import { isCardioSport, isHybrid, SPORTS, BLOCK_TYPES, blockSummary, estimateBlockKcal, defaultCardioBlocks } from './lib/sports.js'
import { sessionStates, isWeekComplete, isProgrammeComplete } from './lib/programme.js'
import { CardioForm } from './views/nutrition/CardioEntry.jsx'

const S = () => useStore.getState().S
const update = (...a) => useStore.getState().update(...a)
const ui = () => useUI.getState()
const toast = m => ui().toast(m)
const snd = () => S().sound

/* ============================ custom confirm dialog ============================ */
function ConfirmDialog({ title, message, confirmText, cancelText, danger, onConfirm, onCancel, close }) {
  return <div style={{ textAlign: 'center', padding: '4px 0' }}>
    {title && <h3 style={{ marginBottom: 8 }}>{title}</h3>}
    <div className="muted" style={{ marginBottom: 18, lineHeight: 1.5 }}>{message}</div>
    <button className={'btn ' + (danger ? 'danger' : 'primary')} onClick={() => { close(); onConfirm && onConfirm() }}>{confirmText || t('Confirm')}</button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={() => { close(); onCancel && onCancel() }}>{cancelText || t('Cancel')}</Button>
  </div>
}
// Themed replacement for window.confirm — callback-based (no blocking).
export function confirmSheet(opts) {
  ui().openSheet(close => <ConfirmDialog {...opts} close={close} />, { kind: 'center' })
}

/* ============================ starter plan ============================ */
export function loadStarterPlan() {
  const [push, pull, legs] = starterRoutines()
  const prog = {
    id: uid(), name: 'Push / Pull / Legs',
    routineIds: [push.id, pull.id, legs.id],
    totalWeeks: 8, currentWeek: 1, weekProgress: {},
    imageUrl: '/assets/covers/ppl.svg',
  }
  update(st => {
    st.routines.push(push, pull, legs)
    st.week[1] = push.id; st.week[3] = pull.id; st.week[5] = legs.id
    if (!st.programmes) st.programmes = []
    st.programmes.push(prog)
  })
  toast(t('Starter plan loaded — Mon Push · Wed Pull · Fri Legs'))
}

/* ============================ weight picker (shared: body weight + goal) ============================ */
// Fixed range, not a moving window — a window that resizes itself mid-drag (the previous
// attempt) makes the thumb's position unpredictable: every time it grows, everything already
// placed on it shifts toward one side. A static range never has that problem, at the cost of
// coarser precision per pixel — the +/- buttons cover exact values.
// The ceiling follows the profile's unit: 300 covers a body weight or a working weight in
// kg, but as pounds it cut off at 136 kg — below plenty of people's body weight, and well
// below an everyday squat.
const W_LO = 1
const wHi = unit => (unit === 'lb' ? 660 : 300)
function WeightInput({ value, setValue, unit }) {
  const W_HI = wHi(unit)
  const clamp = x => Math.max(W_LO, Math.min(W_HI, Math.round((x || 0) * 10) / 10))
  const sv = Math.max(W_LO, Math.min(W_HI, value))
  const onSlide = v => setValue(clamp(v))
  return <>
    <div className="bwstep">
      <button className="bw-pm" onClick={() => onSlide(value - 0.1)} aria-label="minus 0.1"><Icon name="minus" /></button>
      <div className="bw-read">{fmtNum(value)}<span className="u"> {unit}</span></div>
      <button className="bw-pm" onClick={() => onSlide(value + 0.1)} aria-label="plus 0.1"><Icon name="plus" /></button>
    </div>
    <div className="chips" style={{ justifyContent: 'center', margin: '8px 0' }}>
      <button className="chip" onClick={() => onSlide(value - 1)}>−1</button>
      <button className="chip" onClick={() => onSlide(value - 0.5)}>−0.5</button>
      <button className="chip" onClick={() => onSlide(value + 0.5)}>+0.5</button>
      <button className="chip" onClick={() => onSlide(value + 1)}>+1</button>
    </div>
    <Slider value={sv} min={W_LO} max={W_HI} step={0.5} onChange={onSlide} />
  </>
}

/* ============================ body weight ============================ */
function BwSheet({ required, onDone, close }) {
  const st = useStore(s => s.S)
  const unit = st.unit
  const bw = lastBW(st)
  const [v, setV] = useState(bw ? bw.w : 70)
  const save = () => {
    const n = Math.round((v || 0) * 10) / 10
    if (!n || n <= 0) { toast(t('Enter a valid weight')); return }
    update(s => {
      const iso = todayISO()
      const ex = s.bodyweight.find(b => b.d === iso)
      if (ex) { ex.w = n; ex.t = Date.now() } else s.bodyweight.push({ d: iso, w: n, t: Date.now() })
      s.bodyweight.sort((a, b) => (a.d < b.d ? -1 : 1))
    })
    close()
    if (onDone) onDone(n); else toast(t('Weight saved'))
  }
  const recent = [...st.bodyweight].reverse().slice(0, 3)
  const delEntry = d => update(s => { s.bodyweight = s.bodyweight.filter(b => b.d !== d) })
  return <>
    <h3>{required ? t('Quick check-in') : t('Log body weight')}</h3>
    <div className="muted small">{required ? t('Slide or tap to set your weight — tracked before every workout so your curve stays honest.') : t('Today') + ', ' + fmtDate(todayISO(), true)}</div>
    <WeightInput value={v} setValue={setV} unit={unit} />
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={save}>{required ? t('Save & start workout') : t('Save')}</Button>
    {required && <>
      <div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={() => { close(); onDone && onDone(null) }}>{t('Start without weighing in')}</Button>
      <div style={{ height: 2 }} /><Button variant="ghost" className="dim" icon="reset" onClick={() => { close(); nav('/workout') }}>{t('Choose a different workout')}</Button>
    </>}
    {!required && recent.length > 0 && <>
      <h4 className="sec">{t('Recent weigh-ins')}</h4>
      <div className="list" style={{ gap: 0 }}>
        {recent.map(b => <div key={b.d} className="row between" style={{ padding: '9px 2px', borderBottom: '1px solid var(--sep)' }}>
          <span className="small muted">{fmtDate(b.d, true)}</span>
          <span className="row" style={{ gap: 12 }}><b>{fmtNum(b.w)} {unit}</b>
            <button className="iconbtn" style={{ width: 32, height: 30, borderRadius: 8, fontSize: 15, color: 'var(--red)' }} onClick={() => delEntry(b.d)} aria-label="delete"><Icon name="trash" /></button></span>
        </div>)}
      </div>
    </>}
  </>
}
export function bwSheet(opts = {}) {
  const h = ui().openSheet(close => <BwSheet {...opts} close={close} />, { locked: !!opts.required })
  return h
}

/* ============================ body measurements ============================ */
import { MEASURE_FIELDS, latestMeasurements } from './lib/measurements.js'
import BodyMeasureMap from './components/BodyMeasureMap.jsx'

function MeasurementsSheet({ close }) {
  const st = useStore(s => s.S)
  const latest = latestMeasurements(st)
  const [vals, setVals] = useState(() => {
    const init = {}
    MEASURE_FIELDS.forEach(f => { init[f.key] = latest[f.key]?.v ?? '' })
    return init
  })

  const set = (k, raw) => {
    const v = raw === '' ? '' : Math.max(0, Math.round(parseFloat(raw) * 10) / 10) || ''
    setVals(prev => ({ ...prev, [k]: v }))
  }

  const save = () => {
    const values = {}
    MEASURE_FIELDS.forEach(f => {
      const n = parseFloat(vals[f.key])
      if (n > 0) values[f.key] = n
    })
    if (!Object.keys(values).length) { toast(t('Enter at least one measurement')); return }
    update(s => {
      if (!s.measurements) s.measurements = []
      const d = todayISO()
      const ex = s.measurements.find(m => m.d === d)
      if (ex) ex.values = { ...ex.values, ...values }
      else s.measurements.push({ d, values })
      s.measurements.sort((a, b) => a.d < b.d ? -1 : 1)
    })
    close()
    toast(t('Measurements saved'))
  }

  const recent = [...(st.measurements || [])].reverse().slice(0, 3)

  return (
    <>
      <h3 style={{ marginBottom: 4 }}>{t('Body measurements')}</h3>
      <div className="muted small" style={{ marginBottom: 16 }}>
        {fmtDate(todayISO(), true)} · {t('Tap a field to enter your measurements')}
      </div>

      {/* SVG body diagram with overlaid inputs */}
      <BodyMeasureMap values={vals} onChange={set} />

      <div style={{ height: 20 }} />
      <Button variant="primary" onClick={save}>{t('Save measurements')}</Button>

      {/* Recent entries */}
      {recent.length > 0 && (
        <>
          <h4 className="sec">{t('Recent entries')}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map(entry => (
              <div key={entry.d} style={{
                background: 'var(--surface-2)', borderRadius: 10,
                padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, color: 'var(--label-3)', marginBottom: 6 }}>
                  {fmtDate(entry.d, true)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                  {MEASURE_FIELDS.filter(f => (entry.values || {})[f.key] > 0).map(f => (
                    <span key={f.key} style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--label-3)', fontSize: 11 }}>{f.name} </span>
                      <b>{entry.values[f.key]}</b>
                      <span style={{ color: 'var(--label-3)', fontSize: 11 }}> cm</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
export const measurementsSheet = () => ui().openSheet(close => <MeasurementsSheet close={close} />)

/* ============================ import from another app ============================ */
// Shows what a parsed export would actually do before anything is written. An import is
// the one action where "just try it" is expensive — it's someone's entire training
// history — so the numbers, the unit conversion and the exercises we couldn't recognise
// are all on screen before the confirm button.
function ImportSummary({ parsed, close }) {
  const st = useStore(s => s.S)
  const isBW = parsed.kind === 'bodyweight'
  const have = isBW
    ? parsed.bodyweight.filter(b => st.bodyweight.some(x => x.d === b.d)).length
    : parsed.workouts.filter(w => st.workouts.some(x => x.d === w.d)).length
  const fresh = (isBW ? parsed.bodyweight.length : parsed.workouts.length) - have

  const doImport = () => {
    let res
    update(s => { res = mergeImport(s, parsed) })
    close()
    toast(isBW
      ? t('{0} weigh-ins imported', res.added)
      : t('{0} workouts imported', res.added))
  }

  return <>
    <h3>{parsed.source ? t('Import from {0}', parsed.source) : t('Import history')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>
      {parsed.from === parsed.to ? fmtDate(parsed.from, true) : fmtDate(parsed.from, true) + ' – ' + fmtDate(parsed.to, true)}
    </div>

    <div className="tiles" style={{ textAlign: 'left' }}>
      {isBW ? <>
        <div className="tile"><div className="l">{t('Weigh-ins')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{parsed.bodyweight.length}</div></div>
        <div className="tile"><div className="l">{t('New')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{fresh}</div></div>
      </> : <>
        <div className="tile"><div className="l">{t('Workouts')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{parsed.workouts.length}</div></div>
        <div className="tile"><div className="l">{t('Sets')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{parsed.sets}</div></div>
        <div className="tile"><div className="l">{t('Exercises matched')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{parsed.matched}</div></div>
        <div className="tile"><div className="l">{t('Added as your own')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{parsed.created}</div></div>
      </>}
    </div>

    {parsed.mixedUnits ? <div className="small" style={{ color: 'var(--yellow)', marginBottom: 10 }}>
      {t('The file mixes kg and lb — each set is converted to {0}.', st.unit)}
    </div> : parsed.converted ? <div className="small" style={{ color: 'var(--yellow)', marginBottom: 10 }}>
      {t('The file is in {0} and your profile is in {1} — weights will be converted.', parsed.fileUnit, st.unit)}
    </div> : null}
    {!isBW && !parsed.fileUnit && !parsed.mixedUnits && <div className="small dim" style={{ marginBottom: 10 }}>
      {t('The file does not say which unit it uses — numbers are imported as they are.')}
    </div>}
    {have > 0 && <div className="small dim" style={{ marginBottom: 10 }}>
      {t('{0} days already have data here and will be left alone.', have)}
    </div>}
    {/* The file rated its sets. Say so: the column is off by default, so the ratings would
        otherwise arrive invisibly and look like they had been dropped. */}
    {!isBW && (parsed.rirSets + parsed.rpeSets) > 0 && <div className="small dim" style={{ marginBottom: 10 }}>
      {t(effortOf(st) === 'none'
        ? '{0} sets bring an {1} with them — switch on Effort per set in Settings to see it.'
        : '{0} sets bring an {1} with them.',
      parsed.rirSets || parsed.rpeSets, parsed.rirSets ? 'RIR' : 'RPE')}
    </div>}
    {!isBW && parsed.unmatchedNames.length > 0 && <>
      <h4 className="sec">{t('Not in the library — added as your own exercises')}</h4>
      <div className="mchips" style={{ marginBottom: 12 }}>
        {parsed.unmatchedNames.slice(0, 12).map(n => <span key={n} className="mchip capitalize">{n}</span>)}
        {parsed.unmatchedNames.length > 12 && <span className="mchip">+{parsed.unmatchedNames.length - 12}</span>}
      </div>
    </>}

    <Button variant="primary" onClick={doImport} disabled={!fresh}>
      {fresh ? t('Import') : t('Nothing new to import')}
    </Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

/** Read a CSV/XML export, then show what it would do. */
export function importFromApp(file, onDone) {
  const rd = new FileReader()
  rd.onload = () => {
    let parsed
    try { parsed = parseImport(String(rd.result), { unit: S().unit }) }
    catch (e) { toast(t('Could not read that file')); return }
    if (parsed.error === 'empty') { toast(t('That file is empty')); return }
    if (parsed.error) { toast(t("That file's columns aren't recognised — see the docs for supported apps.")); return }
    if (parsed.kind === 'bodyweight' ? !parsed.bodyweight.length : !parsed.workouts.length) {
      toast(t('Nothing to import from that file')); return
    }
    ui().openSheet(close => <ImportSummary parsed={parsed} close={close} />)
    onDone && onDone()
  }
  rd.onerror = () => toast(t('Could not read that file'))
  rd.readAsText(file)
}

/* ============================ target weight ============================ */
export function bwDeltaColor(delta, currentW) {
  if (!delta) return 'var(--label-2)'
  if (!S().targetW) return 'var(--label)'
  const up = S().targetW > currentW
  return (delta > 0) === up ? 'var(--acc)' : 'var(--red)'
}
function GoalSheet({ close }) {
  const st = S()
  const bw = lastBW(st)
  const [v, setV] = useState(st.targetW || (bw ? bw.w : 70))
  return <>
    <h3>{t('Target weight')}</h3>
    <div className="muted small">{t('Your goal is drawn as a line through the weight charts, and gains/losses are colored by whether they move toward it.')}</div>
    <WeightInput value={v} setValue={setV} unit={st.unit} />
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={() => {
      const n = Math.round((v || 0) * 10) / 10
      if (!n || n <= 0) { toast(t('Enter a valid weight')); return }
      update(s => { s.targetW = n }); close()
      const b = lastBW(S()); toast(t('Goal set: {0}', fmtNum(n) + ' ' + st.unit) + (b ? ' (' + t('{0} to go', fmtNum(Math.abs(n - b.w))) + ')' : ''))
    }}>{t('Save goal')}</Button>
    {st.targetW && <><div style={{ height: 8 }} /><Button variant="danger" onClick={() => { update(s => { s.targetW = null }); close(); toast(t('Goal removed')) }}>{t('Remove goal')}</Button></>}
  </>
}
export const goalSheet = () => ui().openSheet(close => <GoalSheet close={close} />)

export const cardioLogSheet = () => {
  const st = S()
  const bw = lastBW(st)
  const weightKg = bw ? (st.unit === 'lb' ? bw.w / 2.2046 : bw.w) : null
  ui().openSheet(close => (
    <>
      <h3>{t('Log activity')}</h3>
      <CardioForm
        weightKg={weightKg}
        onSave={entry => {
          const d = entry.date || todayISO()
          update(s => {
            if (!s.nutritionLog)     s.nutritionLog = {}
            if (!s.nutritionLog[d])  s.nutritionLog[d] = { meals: [], sport: [] }
            s.nutritionLog[d].sport.push(entry)
          })
          close()
        }}
        onCancel={close}
      />
    </>
  ))
}

/* ============================ exercise detail ============================ */
// Estimated 1RM for one exercise (issue #18): what the log already implies, plus a calculator
// for a set you have not done — so the number is reachable before there is any history.
function OneRM({ ex }) {
  const st = useStore(s => s.S)
  const best = best1RM(st, ex.id)
  const [w, setW] = useState(best ? best.w : (st.exWeights[ex.id] || {}).w || 20)
  const [r, setR] = useState(best ? best.r : 5)
  const est = estimate1RM(w, r)
  return <>
    <h4 className="sec">{t('Estimated 1RM')}</h4>
    {best && <div className="small" style={{ marginBottom: 8 }}>
      {t('From your log:')} <b className="accent">{fmtNum(best.est)} {st.unit}</b>
      <span className="dim"> · {t('{0} × {1} on {2}', fmtNum(best.w) + ' ' + st.unit, best.r, fmtDate(best.d, true))}</span>
    </div>}
    <div className="row cfgrow" style={{ marginBottom: 10 }}>
      <Stepper label={t('Weight ({0})', st.unit)} value={w} step={2.5} onChange={setW} />
      <Stepper label={t('Reps')} value={r} step={1} decimal={false} onChange={setR} />
    </div>
    <div className="row between" style={{ marginBottom: 4 }}>
      <span className="muted small">{t('Estimate')}</span>
      <b className="accent" style={{ fontSize: 20 }}>{est === null ? '—' : fmtNum(est) + ' ' + st.unit}</b>
    </div>
    <div className="small dim">{est === null
      ? t('Enter a weight and 1–{0} reps — beyond that an estimate is guesswork.', REP_CAP)
      : t('Epley formula — a calculation from one set, not a tested max.')}</div>
  </>
}

const SW_MUSCLE_LABELS = {
  ABS_LOWER: 'Abdominaux inférieurs', ABS_OBLIQUES: 'Obliques', ABS_UPPER: 'Abdominaux supérieurs',
  ADDUCTOR_LONGUS: 'Adducteur long', ADDUCTOR_MAGNUS: 'Grand adducteur',
  BACK_INFRASPINATUS: 'Infra-épineux', BACK_LATS: 'Grand dorsal',
  BACK_TERES_MAJOR: 'Grand rond', BACK_TERES_MINOR: 'Petit rond',
  BACK_TRAPEZIUS_LOWER: 'Trapèze inférieur', BACK_TRAPEZIUS_MIDDLE: 'Trapèze moyen', BACK_TRAPEZIUS_UPPER: 'Trapèze supérieur',
  BICEPS_FEMORIS: 'Biceps fémoral', BICEPS_LONG_HEAD: 'Biceps — longue portion', BICEPS_SHORT_HEAD: 'Biceps — courte portion',
  BRACHIORADIALIS: 'Brachio-radial', CHEST_BIG_SWING_MUSCLE: 'Grand pectoral',
  CHEST_LOWER: 'Pectoral inférieur', CHEST_MIDDLE: 'Pectoral moyen', CHEST_UPPER: 'Pectoral supérieur',
  CLAVES_GASTROCNEMIUS: 'Gastrocnémien', CLAVES_SOLEUS_MUSCLE: 'Soléaire', CLAVES_TRIBIALIS: 'Tibial antérieur',
  ERECTOR_SPINAE: 'Érecteurs du rachis',
  FOREARM_EXTENSORS: 'Extenseurs avant-bras', FOREARM_FLEXORS: 'Fléchisseurs avant-bras',
  GLUTEUS_MAXIMUS: 'Grand fessier', GLUTEUS_MEDIUS: 'Moyen fessier',
  GRACILIS: 'Gracile', ILIOPSOAS: 'Ilio-psoas', PECTINEUS: 'Pectiné',
  QUADRICEPS_RECTUS_FEMORIS: 'Droit fémoral', QUADRICEPS_VASTUS_INTERMEDIUS: 'Vaste intermédiaire',
  QUADRICEPS_VASTUS_LATERALIS: 'Vaste latéral', QUADRICEPS_VASTUS_MEDIALIS: 'Vaste médial',
  SARTORIUS: 'Sartorius', SEMIMEMBRANOSUS: 'Semi-membraneux', SEMITENDINOSUS: 'Semi-tendineux',
  SHOULDERS_FRONT_PART: 'Deltoïde antérieur', SHOULDERS_MIDDLE_PART: 'Deltoïde latéral', SHOULDERS_REAR_PART: 'Deltoïde postérieur',
  TRICEPS_LATERAL_HEAD: 'Triceps — faisceau latéral', TRICEPS_LONG_HEAD: 'Triceps — longue portion', TRICEPS_MEDIAL_HEAD: 'Triceps — faisceau médial',
}

function MuscleActivation({ muscles }) {
  const entries = Object.entries(muscles).sort(([, a], [, b]) => b - a)
  if (!entries.length) return null
  return (
    <div style={{ marginTop: 14 }}>
      <h4 className="sec" style={{ marginBottom: 8 }}>Muscles activés</h4>
      {entries.map(([key, pct]) => {
        const color = pct >= 70 ? 'var(--acc)' : pct >= 40 ? 'var(--orange)' : 'var(--yellow)'
        return (
          <div key={key} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: 'var(--label-2)' }}>{SW_MUSCLE_LABELS[key] || key}</span>
              <span style={{ fontWeight: 700, color }}>{pct}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ExerciseDetail({ ex, close }) {
  const st = useStore(s => s.S)
  const last = lastEntryFor(st, ex.id)
  const best = bestWeightFor(st, ex.id)
  const sw = swDataFor(ex.id)
  return <>
    <h3 className="capitalize">{ex.n}</h3>
    <Media ex={ex} />
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
      <span className="tag acc">{t(ex.bp)}</span>
      {ex.tg && <span className="tag"><Icon name="target" />{t(ex.tg)}</span>}
      <span className="tag"><Icon name="dumbbell" />{t(ex.eq)}</span>
      {(ex.sm || []).slice(0, 3).map((s, i) => <span key={i} className="tag">{t(s)}</span>)}
    </div>
    {ex.desc && <div className="exnote">{ex.desc}</div>}
    {sw?.muscles && Object.keys(sw.muscles).length > 0 && <MuscleActivation muscles={sw.muscles} />}
    {best > 0 && <div className="small row" style={{ marginBottom: 6, gap: 5 }}><Icon name="trophy" style={{ fontSize: 14, color: 'var(--yellow)' }} />{t('Best:')} <b className="accent">{fmtNum(best)} {st.unit}</b>{last ? ` · ${t('last')} ${fmtDate(last.d)}: ${last.sets.map(s => setLabel(ex.id, s, last.target)).join(', ')}` : ''}</div>}
    <Button variant="primary" icon="plus" style={{ margin: '10px 0 4px' }} onClick={() => addToRoutineSheet(ex)}>{t('Add to my plan')}</Button>
    {ex.custom && <div className="row" style={{ gap: 8, marginTop: 8 }}>
      <Button icon="pencil" style={{ flex: 1 }} onClick={() => { close(); customExSheet(ex) }}>{t('Edit')}</Button>
      <Button variant="danger" icon="trash" style={{ flex: 1 }} onClick={() => deleteCustomEx(ex, close)}>{t('Delete')}</Button>
    </div>}
    {!isCardio(ex) && <OneRM ex={ex} />}
    {instrFor(ex).length > 0 &&<><h4 className="sec">{t('How to')}{!INSTR_LANGS.includes(getLang()) && <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}> · {t('instructions in English')}</span>}</h4><ol className="steps-list">{instrFor(ex).map((s, i) => <li key={i}>{s}</li>)}</ol></>}
  </>
}
export const exerciseDetailSheet = ex => ui().openSheet(close => <ExerciseDetail ex={ex} close={close} />)

/* ============================ add to routine ============================ */
function AddToRoutine({ ex, close }) {
  const st = useStore(s => s.S)
  const pick = rid => {
    close()
    const isNew = rid === '_new'
    exConfigSheet(ex, null, cfg => {
      update(s => {
        let r = isNew ? { id: uid(), name: t('Nouvelle séance'), emoji: DEFAULT_GLYPH, ex: [] } : s.routines.find(x => x.id === rid)
        if (isNew) s.routines.push(r)
        if (r) {
          if (r.items) r.items.push({ kind: 'ex', id: ex.id, ...cfg })
          else { if (!r.ex) r.ex = []; r.ex.push({ id: ex.id, ...cfg }) }
        }
      })
      const r = isNew ? S().routines[S().routines.length - 1] : st.routines.find(x => x.id === rid)
      toast(t('"{0}" added to {1}', ex.n, r ? r.name : t('séance')))
      if (isNew && r) nav('/plan/r/' + r.id)
    }, null, isNew ? null : st.routines.find(x => x.id === rid))
  }
  return <>
    <h3 className="capitalize">{t('Add "{0}"', ex.n)}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Choisir une séance — séries, reps & poids viennent ensuite.')}</div>
    <div className="list">
      {st.routines.filter(r => !isCardioSport(r.sport)).map(r => {
        const exList = r.items ? r.items.filter(x => x.kind === 'ex') : (r.ex || [])
        return <div key={r.id} className="item" onClick={() => pick(r.id)}>
          <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
          <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(exList.length)}</div></div>
          {exList.some(e => e.id === ex.id) && <span className="tag">{t('already in')}</span>}<Icon name="plus" className="chev" />
        </div>
      })}
      <div className="item" onClick={() => pick('_new')}><span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="sparkles" /></span>
        <div className="grow"><div className="tt">{t('Nouvelle séance')}</div><div className="ss">{t('Créer une séance avec cet exercice')}</div></div><Icon name="plus" className="chev" /></div>
    </div>
  </>
}
export const addToRoutineSheet = ex => ui().openSheet(close => <AddToRoutine ex={ex} close={close} />)

/* ============================ custom exercises (issue #11) ============================ */
// Name + body part is all it takes — the exercise then behaves like any built-in one
// (planning, logging, PRs, stats), just without an animation.
function CustomExForm({ existing, prefill, onDone, close }) {
  const [n, setN] = useState(existing ? existing.n : (prefill || ''))
  const [bp, setBp] = useState(existing ? existing.bp : '')
  const [desc, setDesc] = useState(existing ? (existing.desc || '') : '')
  const save = () => {
    const name = n.trim()
    if (!name) { toast(t('Give it a name')); return }
    if (!bp) { toast(t('Pick a body part')); return }
    const dup = allExercises(S()).find(e => e.n.toLowerCase() === name.toLowerCase() && e.id !== (existing || {}).id)
    if (dup) { toast(t('"{0}" already exists', dup.n)); return }
    const d = desc.trim().slice(0, 1000)
    let id = existing && existing.id
    if (existing) update(s => { const c = (s.customEx || []).find(x => x.id === id); if (c) { c.n = name; c.bp = bp; c.desc = d } })
    else {
      id = 'c' + uid()
      update(s => { (s.customEx = s.customEx || []).push({ id, n: name, bp, desc: d, tg: '', eq: 'custom', custom: true }) })
    }
    close()
    toast(existing ? t('Saved') : t('"{0}" created', name))
    onDone && onDone(EXIDX[id])
  }
  return <>
    <h3>{existing ? t('Edit custom exercise') : t('Create your own exercise')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Name it and pick a body part — it behaves like any other exercise, just without an animation.')}</div>
    <input className="input" placeholder={t('Exercise name')} value={n} onChange={e => setN(e.target.value)} />
    <div className="chips" style={{ margin: '12px 0' }}>
      {BODYPARTS.map(b => <button key={b} className={'chip' + (bp === b ? ' on' : '')} onClick={() => setBp(b)}>{t(b)}</button>)}
    </div>
    {bp === 'cardio' && <div className="small dim row" style={{ marginBottom: 10, gap: 5 }}><Icon name="figureRun" style={{ fontSize: 13 }} />{t('Cardio exercises log time + speed instead of weight × reps.')}</div>}
    <textarea className="input" rows={4} maxLength={1000} placeholder={t('Description (optional) — setup, cues, anything you want to remember')}
      value={desc} onChange={e => setDesc(e.target.value)} />
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={save}>{existing ? t('Save') : t('Create exercise')}</Button>
    {existing && <><div style={{ height: 8 }} /><Button variant="danger" icon="trash" onClick={() => { close(); deleteCustomEx(existing) }}>{t('Delete exercise')}</Button></>}
  </>
}
export const customExSheet = (existing, onDone, prefill) => ui().openSheet(close => <CustomExForm existing={existing} prefill={prefill} onDone={onDone} close={close} />)

export function deleteCustomEx(ex, afterDelete) {
  if (S().active?.entries.some(e => e.id === ex.id)) { toast(t('Finish your current workout first')); return }
  confirmSheet({
    title: t('Delete "{0}"?', ex.n),
    message: t('Il sera retiré de vos séances. Vos entraînements déjà effectués conservent leurs séries.'),
    confirmText: t('Delete'), danger: true,
    onConfirm: () => {
      update(s => {
        s.customEx = (s.customEx || []).filter(x => x.id !== ex.id)
        s.routines.forEach(r => {
          if (r.items) { r.items = r.items.filter(e => e.kind !== 'ex' || e.id !== ex.id) }
          else { r.ex = (r.ex || []).filter(e => e.id !== ex.id); cleanupSg(r.ex) }
        })
        // stamp the name into history entries so past workouts stay readable
        s.workouts.forEach(w => w.entries.forEach(e => { if (e.id === ex.id) e.n = ex.n }))
        delete s.exWeights[ex.id]
      })
      toast(t('Exercise deleted'))
      afterDelete && afterDelete()
    }
  })
}

/* ============================ exercise picker ============================ */
// Exercises already used in your routines or past workouts (for the "Chosen" filter + a marker).
function usageMap(st) {
  const u = {}
  st.routines.forEach(r => {
    const exList = r.items ? r.items.filter(x => x.kind === 'ex') : (r.ex || [])
    exList.forEach(e => { u[e.id] = (u[e.id] || 0) + 1 })
  })
  st.workouts.forEach(w => w.entries.forEach(e => { u[e.id] = (u[e.id] || 0) + 1 }))
  return u
}
function ExercisePicker({ onPick, close }) {
  const st = useStore(s => s.S)
  const usage = usageMap(st)
  const [q, setQ] = useState('')
  const [bp, setBp] = useState('')          // '' = all, '★' = chosen, else a body part
  const [eq, setEq] = useState('')          // '' = any equipment
  const [shown, setShown] = useState(50)
  const ql = q.toLowerCase().trim()
  const all = allExercises(st)
  let base = all.filter(e =>
    (bp === '★' ? usage[e.id] : (!bp || e.bp === bp)) &&
    (!ql || e.n.toLowerCase().includes(ql) || e.tg.includes(ql) || e.eq.includes(ql) || (e.desc || '').toLowerCase().includes(ql)))
  if (bp === '★') base = [...base].sort((a, b) => (usage[b.id] - usage[a.id]) || (a.n < b.n ? -1 : 1))
  const eqOpts = equipmentOf(base)
  // Drop the equipment filter if the search narrowed it away, so you never hit a dead end.
  const eqOn = eqOpts.includes(eq) ? eq : ''
  const f = eqOn ? base.filter(e => e.eq === eqOn) : base
  const chosenCount = Object.keys(usage).length
  return <>
    <h3>{t('Add exercise')}</h3>
    <SearchField value={q} onChange={e => { setQ(e.target.value); setShown(50) }} onClear={() => { setQ(''); setShown(50) }} placeholder={t('Search {0} exercises…', all.length)} />
    <div className="chips" style={{ margin: eqOpts.length > 1 ? '10px 0 6px' : '10px 0' }}>
      {chosenCount > 0 && <button className={'chip' + (bp === '★' ? ' on' : '')} onClick={() => { setBp('★'); setEq(''); setShown(50) }}><Icon name="starFill" style={{ fontSize: 12, display: 'inline-block', marginRight: 4, verticalAlign: '-1px' }} />{t('Chosen')} ({chosenCount})</button>}
      <button className={'chip nocap' + (!bp ? ' on' : '')} onClick={() => { setBp(''); setEq(''); setShown(50) }}>{t('All')}</button>
      {BODYPARTS.map(b => <button key={b} className={'chip' + (bp === b ? ' on' : '')} onClick={() => { setBp(b); setEq(''); setShown(50) }}>{t(b)}</button>)}
    </div>
    {eqOpts.length > 1 && <div className="chips" style={{ marginBottom: 10 }}>
      <button className={'chip nocap' + (!eqOn ? ' on' : '')} onClick={() => { setEq(''); setShown(50) }}>{t('Any equipment')}</button>
      {eqOpts.map(x => <button key={x} className={'chip' + (eqOn === x ? ' on' : '')} onClick={() => { setEq(x); setShown(50) }}>{t(x)}</button>)}
    </div>}
    <div className="list">
      {bp !== '★' && <div className="item" onClick={() => customExSheet(null, ex => { close(); onPick(ex) }, q.trim())}>
        <div className="thumb thumb-x"><Icon name="sparkles" /></div>
        <div className="grow"><div className="tt">{t('Create your own exercise')}</div><div className="ss">{t('name + body part, no animation')}</div></div><Icon name="plus" className="chev" />
      </div>}
      {f.slice(0, shown).map(e => <div key={e.id} className="item" onClick={() => { close(); onPick(e) }}>
        <Thumb ex={e} /><div className="grow"><div className="tt capitalize">{e.n}</div><div className="ss capitalize">{t(e.tg || e.bp)} · {t(e.eq)}</div></div>
        {usage[e.id] && <span className="tag acc"><Icon name="starFill" /></span>}<Icon name="plus" className="chev" />
      </div>)}
      {f.length === 0 && bp === '★' && <div className="empty">{t("Nothing chosen yet — add exercises and they'll show up here.")}</div>}
    </div>
    {f.length > shown && <><div style={{ height: 8 }} /><Button onClick={() => setShown(s => s + 50)}>{t('Show more')}</Button></>}
  </>
}
export const exercisePicker = onPick => ui().openSheet(close => <ExercisePicker onPick={onPick} close={close} />)

/* ============================ exercise swap ============================ */
function SwapPicker({ currentExId, onSwap, close }) {
  const st = useStore(s => s.S)
  const current = EXDB[currentExId] || allExercises(st).find(e => e.id === currentExId) || { n: currentExId, bp: '', eq: '' }
  const all = allExercises(st).filter(e => e.id !== currentExId)
  const similar = all
    .map(e => ({ ...e, score: (e.bp && e.bp === current.bp ? 10 : 0) + (e.eq && e.eq === current.eq ? 5 : 0) }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
  const showAll = () => { close(); exercisePicker(newEx => onSwap(newEx)) }
  return <>
    <h3>{t('Switch exercise')}</h3>
    <div className="small muted" style={{ marginBottom: 10 }}>
      {t('Replacing')}: <span className="capitalize" style={{ fontWeight: 500 }}>{current.n}</span>
    </div>
    {similar.length === 0 && <div className="empty" style={{ margin: '10px 0' }}>{t('No similar exercises found.')}</div>}
    <div className="list">
      {similar.slice(0, 20).map(e => (
        <div key={e.id} className="item" onClick={() => { close(); onSwap(e) }}>
          <Thumb ex={e} />
          <div className="grow">
            <div className="tt capitalize">{e.n}</div>
            <div className="ss capitalize">{t(e.tg || e.bp)} · {t(e.eq)}</div>
          </div>
          <Icon name="chevronRight" className="chev" />
        </div>
      ))}
    </div>
    <div style={{ height: 10 }} />
    <Button icon="list" onClick={showAll}>{t('Browse all exercises')}</Button>
  </>
}
export const swapExerciseSheet = (currentExId, onSwap) =>
  ui().openSheet(close => <SwapPicker currentExId={currentExId} onSwap={onSwap} close={close} />)

/* ============================ exercise config ============================ */
// Progression settings for one exercise (issue #17). Shown inside the config sheet because
// "how does this lift go up" belongs next to sets and reps, not in a separate screen. Left
// on "follow the routine" it inherits, so most people never touch it.
function ProgressionFields({ ex, mode, c, setC, routine, unit }) {
  const options = POLICIES_FOR[mode] || ['off']
  if (options.length < 2) return null
  const inherited = policyFor({ id: ex.id }, routine, mode)
  const active = policyFor({ ...c, id: ex.id }, routine, mode)
  const inc = c.inc > 0 ? c.inc : (mode === 'time' ? 5 : defaultIncrement(ex.id, unit))
  return <>
    <h4 className="sec">{t('Progression')}</h4>
    <div className="sect-b" style={{ marginBottom: 8 }}>
      <SelectRow title={t('Rule')} sheetTitle={t('Progression')} value={c.prog || ''} onChange={v => setC(x => ({ ...x, prog: v || undefined }))}
        options={[{ value: '', label: t('Suivre la séance ({0})', t(POLICY_NAME[inherited])) },
          ...options.map(p => ({ value: p, label: t(POLICY_NAME[p]) }))]} />
    </div>
    <div className="small dim" style={{ marginBottom: active === 'off' ? 18 : 10 }}>{t(POLICY_DESC[active])}</div>
    {active !== 'off' && <div className="row cfgrow" style={{ marginBottom: 18 }}>
      <Stepper label={mode === 'time' ? t('Step (seconds)') : t('Step ({0})', unit)} value={inc}
        step={mode === 'time' ? 5 : 1.25} decimal={mode !== 'time'} onChange={v => setC(x => ({ ...x, inc: v }))} />
      {active === 'double' && <Stepper label={t('Reps from')} value={c.repsMin || Math.max(1, (c.reps || 10) - 2)}
        step={1} decimal={false} onChange={v => setC(x => ({ ...x, repsMin: v }))} />}
    </div>}
  </>
}

function ExConfig({ ex, existing, onSave, onDelete, close, routine, inWorkout }) {
  const st = useStore(s => s.S)
  const cardio = isCardio(ex.id)
  const [c, setC] = useState(() => {
    const base = existing || defaultConfig(ex.id)
    const m = cardio ? 'cardio' : modeOf({ ...base, id: ex.id })
    if (m === 'reps' && !base.repsPerSet) {
      return { ...base, repsPerSet: Array.from({ length: base.sets || 3 }, () => base.reps || 10) }
    }
    return base
  })
  // Cardio keeps its own duration+speed form; the reps/time choice (issue #16) is offered for
  // everything else, which is where the gap was — planks, hangs, wall sits, loaded carries.
  const mode = cardio ? 'cardio' : modeOf({ ...c, id: ex.id })
  // Both default from the dataset and are then whatever the config says — see isBw.
  const bw = !cardio && isBw({ ...c, id: ex.id })
  const perSide = isPerSide(c)
  // Keep whatever the other mode already had (sets, weight) and fill only what is missing.
  const setMode = m => setC(x => ({ ...defaultConfig(ex.id, m), ...x, mode: m }))
  const save = () => {
    close()
    const sets = Math.max(1, Math.round(c.sets) || (cardio ? 1 : 3))
    // Only carry progression settings that differ from the inherited default, so a plan file
    // stays readable and "follow the routine" keeps meaning exactly that.
    const prog = {}
    if (c.prog) prog.prog = c.prog
    if (c.inc > 0) prog.inc = c.inc
    // Written only when it differs from what the dataset already says, so a barbell config
    // stays exactly the shape it was before these flags existed.
    // `bodyweight` is true of a hold as much as of a set of reps; `side` is not — it counts
    // reps, and a timed hold has none. Switching an exercise to Time therefore drops it
    // rather than carrying a flag nothing downstream can read.
    const flags = {}
    if (bw !== isBodyweightEq(ex.id)) flags.bodyweight = bw
    if (cardio) onSave({ sets, min: Math.max(1, Math.round(c.min) || 20), speed: Math.max(0, c.speed || 8) })
    else if (mode === 'time') onSave({ sets, mode: 'time', sec: Math.max(1, Math.round(c.sec) || 45), weight: Math.max(0, c.weight || 0), ...flags, ...prog })
    else {
      const rps = c.repsPerSet && c.repsPerSet.length > 0 ? c.repsPerSet : [c.reps || 10]
      const repSets = rps.length
      const mainTyped = Math.max(1, rps[0] || 10)
      const reps = perSide ? Math.ceil(mainTyped / 2) * 2 : mainTyped
      // Keep all per-set values even for unilateral exercises
      const repsPerSet = perSide ? rps.map(r => Math.ceil(Math.max(1, r) / 2) * 2) : rps.map(r => Math.max(1, r))
      const out = { sets: repSets, mode: 'reps', reps, repsPerSet, weight: Math.max(0, c.weight || 0), ...flags, ...(perSide ? { side: true } : {}), ...prog }
      if (policyFor({ ...c, id: ex.id }, routine, 'reps') === 'double') out.repsMin = Math.min(reps, Math.max(1, Math.round(c.repsMin) || Math.max(1, reps - 2)))
      // A ceiling below the working reps would tell you to add a set on day one.
      if (bw && !(out.weight > 0) && c.repsMax > 0) out.repsMax = Math.max(reps, Math.round(c.repsMax))
      onSave(out)
    }
  }
  return <>
    <h3 className="capitalize">{ex.n}</h3>
    <Media ex={ex} />
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '10px 0 14px' }}>
      {cardio && <span className="tag acc"><Icon name="figureRun" />{t('Cardio')}</span>}
      <span className="tag">{t(ex.tg || ex.bp)}</span><span className="tag">{t(ex.eq)}</span>
    </div>
    {ex.desc && <div className="exnote">{ex.desc}</div>}
    {!cardio && bw && <div style={{ marginBottom: 14 }}>
      <Segmented className="seg-range" value={mode} onChange={setMode}
        options={[{ value: 'reps', label: t('Reps') }, { value: 'time', label: t('Time') }]} />
    </div>}
    <div className="row cfgrow" style={{ marginBottom: 8 }}>
      {cardio ? <>
        <Stepper label={t('Intervals')} value={c.sets} step={1} decimal={false} onChange={v => setC(x => ({ ...x, sets: v }))} />
        <Stepper label={t('Minutes')} value={c.min} step={1} decimal={false} onChange={v => setC(x => ({ ...x, min: v }))} />
        <Stepper label={t('Speed (km/h)')} value={c.speed} step={0.5} onChange={v => setC(x => ({ ...x, speed: v }))} />
      </> : mode === 'time' ? <>
        <Stepper label={t('Sets')} value={c.sets} step={1} decimal={false} onChange={v => setC(x => ({ ...x, sets: v }))} />
        <Stepper label={t('Seconds')} value={c.sec} step={5} decimal={false} onChange={v => setC(x => ({ ...x, sec: v }))} />
        <Stepper label={t('Weight ({0})', st.unit)} value={c.weight} step={2.5} onChange={v => setC(x => ({ ...x, weight: v }))} />
      </> : <>
        {!bw && <Stepper label={t('Weight ({0})', st.unit)} value={c.weight} step={2.5} onChange={v => setC(x => ({ ...x, weight: v }))} />}
      </>}
    </div>
    {mode === 'reps' && !cardio && (
      <div style={{ marginBottom: 18 }}>
        {(c.repsPerSet || [10]).map((rep, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ minWidth: 64, fontSize: 13, color: 'var(--label-2)' }}>{'Série ' + (i + 1)}</div>
            <button className="iconbtn" style={{ width: 32, height: 32 }}
              onClick={() => setC(x => {
                const rps = [...x.repsPerSet]
                rps[i] = Math.max(1, rps[i] - (perSide ? 2 : 1))
                return { ...x, repsPerSet: rps }
              })}>
              <Icon name="minus" />
            </button>
            <div style={{ minWidth: 36, textAlign: 'center', fontWeight: 600, fontSize: 18 }}>{rep}</div>
            <button className="iconbtn" style={{ width: 32, height: 32 }}
              onClick={() => setC(x => {
                const rps = [...x.repsPerSet]
                rps[i] = rps[i] + (perSide ? 2 : 1)
                return { ...x, repsPerSet: rps }
              })}>
              <Icon name="plus" />
            </button>
            {(c.repsPerSet || []).length > 1 && (
              <button className="iconbtn" style={{ color: 'var(--red)', width: 32, height: 32 }}
                onClick={() => setC(x => {
                  const rps = x.repsPerSet.filter((_, j) => j !== i)
                  return { ...x, repsPerSet: rps, sets: rps.length }
                })}>
                <Icon name="trash" />
              </button>
            )}
          </div>
        ))}
        <button className="chip" style={{ marginTop: 6 }}
          onClick={() => setC(x => {
            const last = x.repsPerSet.length > 0 ? x.repsPerSet[x.repsPerSet.length - 1] : 10
            const rps = [...x.repsPerSet, last]
            return { ...x, repsPerSet: rps, sets: rps.length }
          })}>
          <Icon name="plus" style={{ fontSize: 12, marginRight: 4 }} />{t('Ajouter une série')}
        </button>
      </div>
    )}
    {mode === 'time' && !bw && <div className="small dim" style={{ marginBottom: 18 }}>
      {t('A timer runs while you hold the set. Leave the weight at 0 for bodyweight holds.')}
    </div>}
    {/* ---------- bodyweight + per side (issues #31/#32/#33) ---------- */}
    {!cardio && (bw || mode === 'reps') && <div className="sect-b" style={{ marginBottom: 8 }}>
      {bw && <Row icon="figureStrength" iconTint="var(--acc)" title={t('Bodyweight')}
        subtitle={t('No weight to enter — just log the reps.')}>
        <Switch checked={bw} onChange={v => setC(x => ({ ...x, bodyweight: v, weight: v ? 0 : x.weight }))} />
      </Row>}
      {mode === 'reps' && <Row icon="shuffle" iconTint="var(--blue)" title={t('Reps per side')}
        subtitle={perSide ? t('You still log the total: {0} is {1} per side.', c.reps || 0, fmtNum(sideReps(c.reps))) : t('For lunges, single-arm rows and the like.')}>
        {/* Turning it on rounds the target up to an even number, since half of an odd
            total is a rep one side does not get. */}
        <Switch checked={perSide} onChange={v => setC(x => ({ ...x, side: v || undefined, reps: v ? Math.ceil((x.reps || 0) / 2) * 2 : x.reps }))} />
      </Row>}
    </div>}
    {/* A stepper is too wide to sit in a list row next to a label — it squeezes the text to
        one word per line — so added weight gets the same full-width treatment as sets and
        reps, with its explanation underneath. */}
    {bw && <>
      <div className="row cfgrow" style={{ marginBottom: 8 }}>
        <Stepper label={t('Added ({0})', st.unit)} value={c.weight || 0} step={2.5}
          onChange={v => setC(x => ({ ...x, weight: v }))} />
      </div>
      <div className="small dim" style={{ marginBottom: 18 }}>
        {t('For dips or pull-ups with a belt. Progression then follows the weight.')}
      </div>
    </>}
    {/* The rep ceiling only means something when there is no load to add instead. */}
    {mode === 'reps' && bw && !(c.weight > 0) && <div className="row cfgrow" style={{ marginBottom: 18 }}>
      <Stepper label={t('Top of the range')} value={c.repsMax || 0} step={1} decimal={false}
        onChange={v => setC(x => ({ ...x, repsMax: v }))} />
    </div>}
    {mode === 'reps' && bw && !(c.weight > 0) && <div className="small dim" style={{ marginTop: -10, marginBottom: 18 }}>
      {c.repsMax > 0
        ? t('Reps climb to {0}, then a set is added and the reps start over. At {1} sets it asks you to add weight instead.', c.repsMax, MAX_BW_SETS)
        : t('Reps climb by one whenever every set was clean. Set a ceiling to add sets instead of reps forever.')}
    </div>}
    {!st.simpleMode && !inWorkout && <ProgressionFields ex={ex} mode={mode} c={c} setC={setC} routine={routine} unit={st.unit} />}
    {!st.simpleMode && inWorkout && <div className="small dim" style={{ marginBottom: 18, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', lineHeight: 1.5 }}>
      {t('La progression est configurée par séance. Les modifications s\'appliquent à partir de la prochaine session.')}
    </div>}
    <Button variant="primary" onClick={save}>{existing ? t('Save') : t('Ajouter à la séance')}</Button>
    {ex.custom && <><div style={{ height: 8 }} /><Button icon="pencil" onClick={() => { close(); customExSheet(ex) }}>{t('Edit or delete this exercise')}</Button></>}
    {onDelete && <><div style={{ height: 8 }} /><Button variant="danger" onClick={() => { close(); onDelete() }}>{t('Retirer de la séance')}</Button></>}
  </>
}
export const exConfigSheet = (ex, existing, onSave, onDelete, routine, inWorkout) => ui().openSheet(close => <ExConfig ex={ex} existing={existing} onSave={onSave} onDelete={onDelete} routine={routine} close={close} inWorkout={inWorkout} />)

/* ============================ glyph picker ============================ */
// Grouped by what the glyph means for a training day, so picking one is a scan
// of four short rows rather than a hunt through twenty loose icons.
export const glyphPicker = (current, onPick) => {
  const cur = glyphOf(current)
  return ui().openSheet(close => <>
    <h3>{t('Pick an icon')}</h3>
    {GLYPH_GROUPS.map(g => (
      <div key={g.key} style={{ marginBottom: 14 }}>
        <div className="sect-t" style={{ padding: '0 2px 7px' }}>{t(g.key)}</div>
        <div className="glyph-grid">
          {g.items.map(n => (
            <button key={n} className={'glyph-cell' + (n === cur ? ' on' : '')}
              onClick={() => { close(); onPick(n) }} aria-label={n}>
              <Icon name={n} />
            </button>
          ))}
        </div>
      </div>
    ))}
    <div style={{ height: 4 }} />
  </>)
}

/* ============================ share / print / import a plan ============================ */
export const planToolsSheet = () => ui().openSheet(close => <PlanTools close={close} />)

function PlanTools({ close }) {
  const st = useStore(s => s.S)
  const user = useStore(s => s.user)
  const fileRef = useRef(null)
  const csvRef  = useRef(null)
  const hasRoutines = (st.routines || []).some(r => r.ex && r.ex.length)

  const exportFile = async () => {
    const bundle = buildPlanBundle(st, user?.name ? t("{0}'s plan", user.name) : '')
    const json = JSON.stringify(bundle, null, 2)
    const name = 'opengym-plan-' + todayISO() + '.json'
    if (MOBILE) { try { await shareExport(json, name) } catch (e) { /* dismissed */ } close(); return }
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
    close(); toast(t('Plan file saved — send it to a friend'))
  }
  const pickFile = ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return
    const rd = new FileReader()
    rd.onload = () => {
      try { const bundle = parsePlan(rd.result); close(); planImportSheet(bundle) }
      catch (e) { toast(t('Import failed: {0}', e.message)) }
    }
    rd.readAsText(f)
  }

  const pickCSV = ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return
    parseProgram(f)
      .then(result => { close(); importProgramSheet(result) })
      .catch(e => toast(t('Import failed: {0}', e.message)))
  }

  return <>
    <h3>{t('Share your plan')}</h3>
    <div className="muted small" style={{ marginBottom: 16 }}>{t('Envoyez vos séances à un ami ou imprimez votre semaine.')}</div>
    <Button variant="primary" icon="upload" onClick={exportFile} disabled={!hasRoutines}>{t('Export plan file')}</Button>
    <div className="dim small" style={{ margin: '7px 2px 0', lineHeight: 1.4 }}>{t('Un petit fichier qu\'un ami importe dans son openGym — séances uniquement, sans vos entraînements ni pesées.')}</div>
    {!MOBILE && <>
      <div style={{ height: 12 }} />
      <Button variant="tinted" icon="download" onClick={() => { close(); printPlan(st, user?.name || '') }} disabled={!hasRoutines}>{t('Print / Save as PDF')}</Button>
      <div className="dim small" style={{ margin: '7px 2px 0', lineHeight: 1.4 }}>{t('A clean one-page-per-plan printout — no exercise ever splits across a page.')}</div>
    </>}
    {!hasRoutines && <div className="dim small" style={{ margin: '12px 2px 0' }}>{t('Ajoutez d\'abord un exercice à une séance — un plan vide n\'a rien à partager.')}</div>}
    <h4 className="sec">{t('Got a plan from a friend?')}</h4>
    <Button variant="ghost" icon="folder" onClick={() => fileRef.current?.click()}>{t('Import a plan file')}</Button>
    <input ref={fileRef} type="file" accept="application/json,.json" onChange={pickFile} hidden />
    <h4 className="sec">{t('Import program from CSV / Excel')}</h4>
    <Button variant="tinted" icon="download" onClick={downloadExcelTemplate}>{t('Download Excel template (.xlsx)')}</Button>
    <div className="dim small" style={{ margin: '7px 2px 12px', lineHeight: 1.4 }}>
      {t('Template with cascading dropdowns: select a muscle group and the exercise list filters automatically. Contains all 1324 exercises.')}
    </div>
    <Button variant="ghost" icon="folder" onClick={() => csvRef.current?.click()}>{t('Import Excel or CSV program file')}</Button>
    <input ref={csvRef} type="file" accept=".xlsx,.xls,.xlsm,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={pickCSV} hidden />
  </>
}

export const planImportSheet   = bundle => ui().openSheet(close => <PlanImport bundle={bundle} close={close} />)
export const importProgramSheet = result => ui().openSheet(close => <ImportProgram result={result} close={close} />)

function PlanImport({ bundle, close }) {
  const [schedule, setSchedule] = useState(false)
  const apply = () => {
    update(s => mergePlan(s, bundle, { schedule }))
    close()
    toast(t(bundle.routineCount === 1 ? '{0} séance ajoutée à votre plan' : '{0} séances ajoutées à votre plan', bundle.routineCount))
    nav('/plan')
  }
  return <>
    <h3>{bundle.name ? t('Import "{0}"', bundle.name) : t('Import this plan')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>
      {t(bundle.routineCount === 1 ? '{0} séance' : '{0} séances', bundle.routineCount)}
      {' · ' + exCount(bundle.exerciseCount)}
      {bundle.scheduledDays > 0
        ? ' · ' + t(bundle.scheduledDays === 1 ? 'scheduled on {0} day' : 'scheduled on {0} days', bundle.scheduledDays)
        : ''}
    </div>
    <div className="dim small" style={{ marginBottom: 14, lineHeight: 1.4 }}>{t('Ces séances sont ajoutées à votre plan — rien de ce que vous avez déjà n\'est modifié.')}</div>
    {bundle.dropped > 0 && <div className="small" style={{ color: 'var(--yellow)', marginBottom: 14, lineHeight: 1.4 }}>
      {t(bundle.dropped === 1
        ? "{0} exercise in the file isn't in your library and was left out."
        : "{0} exercises in the file aren't in your library and were left out.", bundle.dropped)}
    </div>}
    {bundle.scheduledDays > 0 && <div className="row between" style={{ padding: '10px 2px', borderTop: '1px solid var(--sep)', borderBottom: '1px solid var(--sep)', marginBottom: 16, gap: 12 }}>
      <div><div className="tt" style={{ fontSize: 15 }}>{t('Use this weekly schedule')}</div><div className="small dim">{t('Replaces your current Mon–Sun assignments.')}</div></div>
      <Switch checked={schedule} onChange={setSchedule} />
    </div>}
    <Button variant="primary" onClick={apply}>{t('Add to my plan')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

/* ============================ import program from CSV ============================ */
function ImportProgram({ result, close }) {
  const { programName, routines, warnings, programImageUrl } = result

  const apply = () => {
    if (routines.length === 0) { close(); return }
    update(s => {
      routines.forEach(r => s.routines.push(r))
      if (!s.programmes) s.programmes = []
      s.programmes.push({
        id: uid(),
        name: programName || t('Imported program'),
        routineIds: routines.map(r => r.id),
        totalWeeks: 1,
        currentWeek: 1,
        weekProgress: {},
        ...(programImageUrl ? { imageUrl: programImageUrl } : {}),
      })
    })
    close()
    toast(t('Programme "{0}" importé — {1} séances', programName, routines.length))
    nav('/plan')
  }

  return <>
    <h3>{t('Import "{0}"', programName)}</h3>

    {routines.length > 0 ? <>
      <div className="muted small" style={{ marginBottom: 12 }}>
        {t(routines.length === 1 ? '{0} séance sera ajoutée à votre plan :' : '{0} séances seront ajoutées à votre plan :', routines.length)}
      </div>
      <div className="sect-b" style={{ marginBottom: 14 }}>
        {routines.map(r => (
          <div key={r.id} className="lrow" style={{ padding: '10px 14px' }}>
            <div className="grow">
              <div className="tt">{r.name}</div>
              <div className="ss">{exCount(r.items ? r.items.filter(x => x.kind === 'ex').length : (r.ex?.length ?? 0))}</div>
            </div>
          </div>
        ))}
      </div>
    </> : (
      <div className="muted small" style={{ marginBottom: 14 }}>{t('No exercises could be imported. Check your file and try again.')}</div>
    )}

    {warnings.length > 0 && (
      <div style={{ marginBottom: 14 }}>
        <div className="small" style={{ color: 'var(--yellow)', marginBottom: 6, fontWeight: 600 }}>
          {t('{0} warning(s):', warnings.length)}
        </div>
        {warnings.map((w, i) => (
          <div key={i} className="small dim" style={{ marginBottom: 4, lineHeight: 1.4 }}>• {w}</div>
        ))}
      </div>
    )}

    <div className="dim small" style={{ marginBottom: 16, lineHeight: 1.4 }}>
      {t('Ces séances sont ajoutées à votre plan — rien de ce que vous avez déjà n\'est modifié.')}
    </div>

    <Button variant="primary" onClick={apply} disabled={routines.length === 0}>{t('Add to my plan')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

/* ============================ day override / assign ============================ */
function DayOverride({ iso, close }) {
  const st = useStore(s => s.S)
  const wd = new Date(iso + 'T12:00:00').getDay()
  const weeklyR = st.routines.find(r => r.id === st.week[wd])
  const hasOvr = st.dayPlan[iso] !== undefined
  const effId = effectiveRoutineId(st, iso)
  const set = v => {
    update(s => { if (!v) delete s.dayPlan[iso]; else s.dayPlan[iso] = v })
    close()
    toast(v === '' ? t('Back to weekly plan') : v === 'rest' ? t('{0} set to rest', fmtDate(iso)) : t('{0} planned for {1}', (st.routines.find(r => r.id === v) || {}).name, fmtDate(iso)))
  }
  return <>
    <h3>{fmtDate(iso, true)}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Weekly plan:')} {weeklyR ? weeklyR.name : t('Rest')}{hasOvr && <span style={{ color: 'var(--orange)' }}> · {t('changed for this day')}</span>}<br />{t('Sick, missed a day or want a different session? Pick what to train instead.')}</div>
    <div className="list">
      {st.routines.filter(r => (r.ex?.length ?? 0) > 0 || (r.blocks?.length ?? 0) > 0).map(r => <div key={r.id} className="item" onClick={() => set(r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex?.length ?? 0)}</div></div>
        {effId === r.id && <Icon name="check" className="accent" />}</div>)}
      <div className="item" onClick={() => set('rest')}><span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="moon" /></span><div className="grow"><div className="tt">{t('Rest / skip this day')}</div></div>{effId === null && <Icon name="check" className="accent" />}</div>
      {hasOvr && <div className="item" onClick={() => set('')}><span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="reset" /></span><div className="grow"><div className="tt">{t('Back to weekly plan')}</div></div></div>}
    </div>
  </>
}
export const dayOverrideSheet = iso => ui().openSheet(close => <DayOverride iso={iso} close={close} />)

function DayAssign({ day, close }) {
  const st = useStore(s => s.S)
  const set = v => { update(s => { if (v) s.week[day] = v; else delete s.week[day] }); close() }
  return <>
    <h3>{t(DAYN[day])}</h3>
    <div className="list">
      <div className="item" onClick={() => set('')}><span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="moon" /></span><div className="grow"><div className="tt">{t('Rest day')}</div></div>{!st.week[day] && <Icon name="check" className="accent" />}</div>
      {st.routines.filter(r => (r.ex?.length ?? 0) > 0 || (r.blocks?.length ?? 0) > 0).map(r => <div key={r.id} className="item" onClick={() => set(r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex?.length ?? 0)}</div></div>
        {st.week[day] === r.id && <Icon name="check" className="accent" />}</div>)}
    </div>
  </>
}
export const dayAssignSheet = day => ui().openSheet(close => <DayAssign day={day} close={close} />)

/* ============================ workout detail ============================ */
function WorkoutDetail({ w, close }) {
  const st = useStore(s => s.S)
  const hasPRs = w.prs && w.prs.length > 0
  return <>
    <h3 style={{ marginBottom: 2 }}>{w.name}</h3>
    <div className="muted small" style={{ marginBottom: 10 }}>{fmtDate(w.d, true)}{w.bw ? ' · ' + fmtNum(w.bw) + ' ' + st.unit : ''}</div>
    <div className="tiles" style={{ marginBottom: 14 }}>
      <div className="tile colored" style={{ '--card-color': 'var(--teal)' }}><div className="l">{t('Duration')}</div><div className="v">{fmtDur(w.end - w.start)}</div></div>
      <div className="tile colored" style={{ '--card-color': 'var(--blue)' }}><div className="l">{t('Volume')}</div><div className="v">{fmtVol(w.vol, st.unit)}</div></div>
      <div className="tile colored" style={{ '--card-color': 'var(--purple)' }}><div className="l">{t('Sets')}</div><div className="v">{setsDone(w)}</div></div>
      <div className="tile colored" style={{ '--card-color': hasPRs ? 'var(--yellow)' : 'var(--label-3)' }}><div className="l">{t('PRs')}</div><div className="v">{hasPRs ? w.prs.length : '—'}</div></div>
    </div>
    {w.entries.map((e, i) => {
      const ex = EXIDX[e.id]
      const isPR = w.prs && w.prs.includes(e.id)
      return <div key={i} className="row" style={{ marginBottom: 8, alignItems: 'flex-start', padding: '9px 10px', background: isPR ? 'color-mix(in srgb,var(--yellow) 7%,var(--surface))' : 'var(--surface-2)', borderRadius: 10, border: isPR ? '1px solid color-mix(in srgb,var(--yellow) 22%,transparent)' : '1px solid var(--sep)' }}>
        {ex && <Thumb ex={ex} />}
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="tt capitalize" style={{ fontWeight: 600, lineHeight: 1.3 }}>{ex ? ex.n : (e.n || e.id)}{isPR && <span className="pr" style={{ marginLeft: 6 }}><Icon name="trophy" />PR</span>}</div>
          <div className="ss">{e.sets.filter(s => s.done).map(s => setLabel(e.id, s, e.target)).join(' · ') || t('no sets')}</div>
        </div>
      </div>
    })}
    <div style={{ height: 4 }} />
    <Button variant="danger" onClick={() => confirmSheet({ title: t('Delete workout?'), message: t('This removes it from your history for good.'), confirmText: t('Delete'), danger: true, onConfirm: () => { update(s => { s.workouts = s.workouts.filter(x => x.id !== w.id) }); close(); toast(t('Workout deleted')) } })}>{t('Delete workout')}</Button>
  </>
}
export const workoutDetailSheet = w => ui().openSheet(close => <WorkoutDetail w={w} close={close} />)

/* ============================ calendar ============================ */
function Calendar({ start, close }) {
  const st = useStore(s => s.S)
  const [cur, setCur] = useState(() => { const d = start ? new Date(start) : new Date(); d.setDate(1); return d })
  const y = cur.getFullYear(), mo = cur.getMonth()
  const byDay = {}
  st.workouts.forEach(w => (byDay[w.d] = byDay[w.d] || []).push(w))
  const startOffset = (new Date(y, mo, 1).getDay() + 6) % 7
  const daysIn = new Date(y, mo + 1, 0).getDate()
  const monthWs = st.workouts.filter(w => w.d.startsWith(y + '-' + String(mo + 1).padStart(2, '0')))
  const monthVol = monthWs.reduce((a, w) => a + (w.vol || 0), 0)
  const monthMs = monthWs.reduce((a, w) => a + Math.max(0, (w.end || w.start) - w.start), 0)
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(<div key={'e' + i} />)
  for (let d = 1; d <= daysIn; d++) {
    const iso = y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
    const ws = byDay[iso], effId = effectiveRoutineId(st, iso), ovr = st.dayPlan[iso] !== undefined
    const dotCls = ws ? 'done' : ovr && effId ? 'ovr' : effId ? 'plan' : ''
    cells.push(<button key={d} className={'cal-d' + (ws ? ' has' : '') + (iso === todayISO() ? ' today' : '')} onClick={() => {
      if (!ws) { close(); dayOverrideSheet(iso); return }
      if (ws.length === 1) { close(); workoutDetailSheet(ws[0]); return }
      close(); ui().openSheet(c2 => <><h3>{fmtDate(iso, true)}</h3><div className="list">{ws.map(w => <WorkoutRow key={w.id} w={w} onClick={() => { c2(); workoutDetailSheet(w) }} />)}</div></>)
    }}><span>{d}</span><i className={dotCls} /></button>)
  }
  return <>
    <div className="row between" style={{ marginBottom: 2 }}>
      <button className="iconbtn" onClick={() => setCur(new Date(y, mo - 1, 1))} aria-label={t('Previous month')}><Icon name="chevronLeft" /></button>
      <h3 style={{ margin: 0 }}>{t(MONTHS_LONG[mo])} {y}</h3>
      <button className="iconbtn" onClick={() => setCur(new Date(y, mo + 1, 1))} aria-label={t('Next month')}><Icon name="chevronRight" /></button>
    </div>
    <div className="small muted" style={{ textAlign: 'center' }}>{monthWs.length ? `${t(monthWs.length === 1 ? '{0} workout' : '{0} workouts', monthWs.length)} · ${fmtDur(monthMs)} · ${fmtVol(monthVol, st.unit)}` : t('No workouts this month')}</div>
    <div className="cal-grid">{['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(l => <div key={l} className="cal-h">{t(l)}</div>)}{cells}</div>
    <div className="cal-legend">
      <span><i style={{ background: 'var(--acc)' }} />{t('Trained')}</span>
      <span><i style={{ background: 'var(--label-3)' }} />{t('Planned')}</span>
      <span><i style={{ background: 'var(--orange)' }} />{t('Rescheduled')}</span>
    </div>
    <div className="small dim" style={{ textAlign: 'center', marginTop: 10 }}>{t('Tap a trained day for details · tap any other day to plan a session')}</div>
  </>
}
export const calendarSheet = start => ui().openSheet(close => <Calendar start={start} close={close} />)

/* shared small workout row (used in lists) */
export function WorkoutRow({ w, onClick }) {
  const st = useStore(s => s.S)
  const glyph = glyphOf((st.routines.find(r => r.id === w.routineId) || {}).emoji)
  const hasPR = w.prs && w.prs.length > 0
  const borderColor = hasPR ? 'var(--yellow)' : 'var(--acc)'
  return (
    <div className="item" onClick={onClick} style={{
      background: hasPR ? 'color-mix(in srgb,var(--yellow) 7%,var(--surface))' : undefined,
      borderLeft: `3px solid color-mix(in srgb,${borderColor} 55%,transparent)`,
    }}>
      <span className="lrow-i" style={{
        width: 34, height: 34, borderRadius: 8, fontSize: 19,
        background: hasPR ? 'color-mix(in srgb,var(--yellow) 22%,var(--surface-3))' : 'color-mix(in srgb,var(--acc) 18%,var(--surface-3))',
        color: hasPR ? 'var(--yellow)' : 'var(--acc)',
      }}>
        <Icon name={glyph} />
      </span>
      <div className="grow">
        <div className="tt">{w.name}</div>
        <div className="ss">{[fmtDate(w.d, true), ...durPart(w.end - w.start), t('{0} sets', setsDone(w)), fmtVol(w.vol, st.unit)].join(' · ')}</div>
      </div>
      {hasPR && <span className="pr"><Icon name="trophy" />{w.prs.length} PR</span>}
      <Icon name="chevronRight" className="chev" />
    </div>
  )
}

/* ============================ workout lifecycle ============================ */
export function startFlow(routineId, progCtx = null) {
  if (S().promptWeighBefore !== false) {
    bwSheet({ required: true, onDone: bw => beginWorkout(routineId, bw, progCtx) })
  } else {
    beginWorkout(routineId, null, progCtx)
  }
}
export function startFlowForProgramme(programmeId, weekNum, sessionIdx) {
  const prog = S().programmes.find(p => p.id === programmeId)
  if (!prog) return
  const routineId = prog.routineIds[sessionIdx]
  startFlow(routineId, { programmeId, progWeek: weekNum, progSessionIdx: sessionIdx })
}
export function beginWorkout(routineId, bw, progCtx = null) {
  const st = S()
  const r = routineId ? st.routines.find(x => x.id === routineId) : null

  if (r && isCardioSport(r.sport)) {
    update(s => {
      s.active = {
        id: uid(), d: todayISO(), start: Date.now(),
        routineId, name: r.name, sport: r.sport,
        bw: bw || null, cur: 0, entries: [],
        blocks: r.blocks || [],
        ...(progCtx || {}),
      }
    })
    useUI.getState().stopRest()
    nav('/cardio')
    return
  }

  if (r && isHybrid(r)) {
    const entries = (r.items || []).map(item => {
      if (item.kind === 'block') {
        return { kind: 'block', id: item.id || uid(), sport: item.sport, type: item.type, duration: item.duration, intensity: item.intensity, repeat: item.repeat, workSec: item.workSec, restSec: item.restSec, workIntensity: item.workIntensity, restIntensity: item.restIntensity, done: false, distKm: null, kcal: null, notes: null }
      }
      const plan = nextPrescription(st, item, r)
      return { kind: 'ex', id: item.id, sg: item.sg, target: { ...item }, plan, sets: applyPrescription(buildSets(st, item), plan) }
    })
    update(s => {
      s.active = {
        id: uid(), d: todayISO(), start: Date.now(),
        routineId, name: r.name, bw: bw || null, cur: 0, entries, hybrid: true,
        ...(progCtx || {}),
      }
    })
    useUI.getState().stopRest()
    nav('/workout')
    return
  }

  const entries = (r ? r.ex : []).map(cfg => {
    const plan = nextPrescription(st, cfg, r)
    return { id: cfg.id, sg: cfg.sg, target: { ...cfg }, plan, sets: applyPrescription(buildSets(st, cfg), plan) }
  })
  update(s => {
    s.active = {
      id: uid(), d: todayISO(), start: Date.now(),
      routineId, name: r ? r.name : t('Freestyle'),
      bw: bw || null, cur: 0, entries,
      ...(progCtx || {}),
    }
  })
  useUI.getState().stopRest()
  nav('/workout')
}
function TopWeight({ entryIdx, close }) {
  const st = useStore(s => s.S)
  const A = st.active
  // The workout can end underneath this sheet: finishing from the last exercise clears
  // `active`, and this re-renders before the sheet is torn down. Everything below is
  // read defensively and the sheet dismisses itself — reading A.entries straight took
  // the whole app down with it. Hooks still run unconditionally, so the bail-out has
  // to sit after every one of them.
  const entry = A ? A.entries[entryIdx] : null
  const ex = entry && EXIDX[entry.id]
  const maxSet = entry ? Math.max(0, ...entry.sets.filter(s => s.done).map(s => s.w || 0)) : 0
  const prevBest = entry ? Math.max((st.exWeights[entry.id] || {}).w || 0, bestWeightFor(st, entry.id)) : 0
  const [v, setV] = useState(entry ? (Math.max(maxSet, prevBest) || entry.target.weight || 0) : 0)
  useEffect(() => { if (!entry) close() }, [entry, close])

  const units = supersetUnits(A ? A.entries : [])
  const unit = entry ? unitOf(units, entryIdx) : []
  const unitDone = !!entry && unit.every(i => A.entries[i].sets.every(s => s.done))
  const unitIdx = units.findIndex(u => u === unit)
  const isLastUnit = unitIdx === units.length - 1
  if (!entry || !ex) return null

  const commit = advance => {
    const n = Math.round((v || 0) * 10) / 10
    if (!isFinite(n) || n < 0) { toast(t('Enter a valid weight')); return }
    update(s => {
      s.active.entries[entryIdx].topW = n
      const cur = s.exWeights[entry.id]
      s.exWeights[entry.id] = { w: Math.max(n, cur ? cur.w : 0), d: todayISO() }
    })
    close()
    if (advance && unitDone) {
      if (isLastUnit) workoutCompleteSheet()               // whole workout done → finish/continue prompt
      else update(s => { s.active.cur = units[unitIdx + 1][0] })
    } else toast(t('Tracked — next time starts at {0}', fmtNum(S().exWeights[entry.id].w) + ' ' + st.unit))
  }
  return <>
    <h3 className="capitalize row" style={{ gap: 8 }}><Icon name="checkCircle" style={{ color: 'var(--acc)' }} />{t('{0} done', ex.n)}</h3>
    <div className="muted small">{t('Confirm the weight you worked with — your highest becomes the default next time.')}{!unitDone && unit.length > 1 ? ' ' + t('Then finish the superset partner.') : ''}</div>
    <WeightInput value={v} setValue={setV} unit={st.unit} />
    <div style={{ height: 10 }} />
    {prevBest > 0 ? <div className="small dim" style={{ textAlign: 'center', marginBottom: 12 }}>{t('Previous best:')} {fmtNum(prevBest)} {st.unit}{maxSet > prevBest && <span style={{ color: 'var(--yellow)' }}> — {t('new record!')}</span>}</div> : <div style={{ height: 4 }} />}
    {unitDone ? <>
      <Button variant="primary" trailingIcon={isLastUnit ? null : 'chevronRight'} onClick={() => commit(true)}>{isLastUnit ? t('Save') : t('Save & next exercise')}</Button>
      <div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={() => commit(false)}>{t('Just close')}</Button>
    </> : <Button variant="primary" onClick={() => commit(false)}>{t('Save weight')}</Button>}
  </>
}
export const topWeightSheet = entryIdx => ui().openSheet(close => <TopWeight entryIdx={entryIdx} close={close} />)

// Shown when the last exercise's last set is checked — finish, or keep going.
function WorkoutComplete({ close }) {
  return <div style={{ textAlign: 'center', padding: '8px 0' }}>
    <div style={{ fontSize: 48, display: 'flex', justifyContent: 'center', color: 'var(--acc)', animation: 'badgePop 350ms var(--ease) both', filter: 'drop-shadow(0 0 14px color-mix(in srgb,var(--acc) 35%,transparent))' }}><Icon name="checkCircle" /></div>
    <h3 style={{ margin: '8px 0' }}>{t("That's the whole workout!")}</h3>
    <div className="muted small" style={{ marginBottom: 16 }}>{t('Every exercise done — great work. Finish up, or keep going and add another exercise.')}</div>
    <Button variant="primary" icon="flag" onClick={() => { close(); finishWorkout() }}>{t('Finish workout')}</Button>
    <div style={{ height: 8 }} />
    <Button onClick={() => { close(); useUI.getState().toast(t('Keep going — tap "+ Add exercise" below')) }}>{t('Continue workout')}</Button>
  </div>
}
export const workoutCompleteSheet = () => ui().openSheet(close => <WorkoutComplete close={close} />, { kind: 'center' })

function FinishSummary({ w, prDetails = [], close }) {
  const st = useStore(s => s.S)
  return <div style={{ textAlign: 'center', padding: '8px 0' }}>
    {/* Trophy hero — golden glow radial behind icon */}
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 130, height: 130, borderRadius: '50%',
        background: 'radial-gradient(circle, color-mix(in srgb,var(--yellow) 38%,transparent) 0%, transparent 70%)',
        animation: 'badgePop 480ms var(--ease) both',
        pointerEvents: 'none',
      }} />
      <div className="finish-trophy" style={{ color: 'var(--yellow)', position: 'relative', filter: 'drop-shadow(0 0 22px color-mix(in srgb,var(--yellow) 55%,transparent))' }}>
        <Icon name="trophy" />
      </div>
    </div>
    <h3 style={{ margin: '4px 0 3px', fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-.028em', lineHeight: 1.15 }}>{t('Workout complete!')}</h3>
    {w.name && <div className="muted small" style={{ marginBottom: 14, fontSize: 14 }}>{w.name}</div>}
    <div className="tiles" style={{ textAlign: 'left' }}>
      <div className="tile colored" style={{ '--card-color': 'var(--teal)' }}><div className="l">{t('Duration')}</div><div className="v">{fmtDur(w.end - w.start)}</div></div>
      <div className="tile colored" style={{ '--card-color': 'var(--blue)' }}><div className="l">{t('Volume')}</div><div className="v">{fmtVol(w.vol, st.unit)}</div></div>
      <div className="tile colored" style={{ '--card-color': 'var(--purple)' }}><div className="l">{t('Sets')}</div><div className="v">{setsDone(w)}</div></div>
      <div className="tile colored" style={{ '--card-color': 'var(--yellow)' }}><div className="l">{t('PRs')}</div><div className="v">{prDetails.length || '—'}</div></div>
    </div>
    {prDetails.length > 0 && <div style={{ textAlign: 'left', marginBottom: 12 }}>
      {prDetails.map((pr, i) => {
        const exName = (EXIDX[pr.id] || {}).n || pr.id
        const isWeight = pr.kinds.includes('weight')
        const isE1rm = pr.kinds.includes('e1rm') && !isWeight
        const isReprange = pr.kinds.includes('reprange') && !isWeight
        const color = isWeight ? 'var(--yellow)' : isReprange ? 'var(--blue)' : 'var(--acc)'
        const icon = isWeight ? 'trophy' : isReprange ? 'dumbbell' : 'chartLine'
        const badge = isWeight ? 'PR'
          : isReprange && pr.repBests.length ? pr.repBests.map(rb => t('{0}RM', rb.r)).join(' ') + ' PR'
          : t('Est. 1RM')
        return <div key={pr.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: `color-mix(in srgb,${color} 10%,var(--surface))`,
          borderRadius: 10, padding: '8px 12px', marginBottom: 5,
          border: `1px solid color-mix(in srgb,${color} 22%,transparent)`,
          animation: `badgePop ${300 + i * 60}ms var(--ease) both`,
          animationDelay: `${i * 60}ms`
        }}>
          <Icon name={icon} style={{ fontSize: 15, color, flexShrink: 0 }} />
          <span className="capitalize" style={{ fontSize: 13, fontWeight: 500, flex: 1, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exName}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '.04em', textTransform: 'uppercase', flexShrink: 0 }}>{badge}</span>
        </div>
      })}
    </div>}
    <h4 className="sec" style={{ textAlign: 'left' }}>{t('What you just trained')}</h4>
    <BodyMap load={loadOfWorkouts([w])} body={st.body} />
    <div style={{ height: 14 }} />
    <Button variant="primary" className="finish-cta" style={{ boxShadow: '0 6px 20px color-mix(in srgb,var(--acc) 45%,transparent)' }} onClick={() => { close(); nav('/home') }}>{t('Nice!')}</Button>
  </div>
}
function HybridMissingDataSheet({ missingEntries, close, onSaveAnyway }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px' }}>
      <Icon name="info" style={{ fontSize: 44, color: 'var(--yellow)', marginBottom: 12 }} />
      <h3 style={{ marginBottom: 6 }}>{t('Données manquantes')}</h3>
      <p className="muted small" style={{ marginBottom: 14 }}>{t('Certains blocs cardio n\'ont pas été complétés ou leurs données n\'ont pas été renseignées.')}</p>
      <div style={{ textAlign: 'left', marginBottom: 20 }}>
        {missingEntries.map((e, i) => {
          const sp = SPORTS[e.sport] || {}
          const bt = BLOCK_TYPES[e.type] || {}
          const missing = !e.done
            ? t('Non effectué')
            : (SPORTS[e.sport]?.hasDistance && !e.distKm ? t('Distance non renseignée') : t('Données manquantes'))
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < missingEntries.length - 1 ? '1px solid var(--sep)' : 'none' }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, flexShrink: 0 }}>
                <Icon name={sp.icon || 'bolt'} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t(sp.label || e.sport)} · {t(bt.label || e.type)}</div>
                <div className="dim small">{missing}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button style={{ flex: 1 }} onClick={close}>{t('Revenir compléter')}</Button>
        <Button variant="primary" style={{ flex: 1 }} onClick={onSaveAnyway}>{t('Sauvegarder quand même')}</Button>
      </div>
    </div>
  )
}

export function finishWorkout() {
  const A = S().active
  if (!A) return
  const done = setsDoneActive(A)
  const total = A.entries.filter(e => e.kind !== 'block').reduce((n, e) => n + (e.sets?.length ?? 0), 0)
  const blockEntries = A.entries.filter(e => e.kind === 'block')
  const hasSomethingDone = done > 0 || blockEntries.some(e => e.done)

  if (!hasSomethingDone) {
    confirmSheet({ title: t('Nothing logged yet'), message: t('You haven\'t checked off any sets. Finish the workout anyway?'), confirmText: t('Finish anyway'), onConfirm: doFinishWorkout })
    return
  }

  if (blockEntries.length > 0) {
    const missingData = blockEntries.filter(e => {
      if (!e.done) return true
      if (SPORTS[e.sport]?.hasDistance && !e.distKm) return true
      return false
    })
    if (missingData.length > 0) {
      useUI.getState().openSheet(close => (
        <HybridMissingDataSheet
          missingEntries={missingData}
          close={close}
          onSaveAnyway={() => { close(); doFinishWorkout() }}
        />
      ), { kind: 'center' })
      return
    }
  }

  if (done < total) { confirmSheet({ title: t('Finish early?'), message: t(total - done === 1 ? '{0} set still unchecked. Finish the workout now?' : '{0} sets still unchecked. Finish the workout now?', total - done), confirmText: t('Finish workout'), onConfirm: doFinishWorkout }); return }
  doFinishWorkout()
}
function doFinishWorkout() {
  const st = S()
  const A = st.active
  if (!A) return

  // Collect PR info from flags stored on each set by prs.js during the workout.
  const prByEx = {} // exId → Set<'weight'|'reprange'|'e1rm'>
  A.entries.forEach(e => {
    e.sets.filter(s => s.done && s.pr).forEach(s => {
      if (!prByEx[e.id]) prByEx[e.id] = new Set()
      prByEx[e.id].add(s.pr)
    })
    // Legacy fallback for exercises where prs.js didn't fire (bodyweight, cardio…).
    if (!prByEx[e.id]) {
      const mx = Math.max(0, ...e.sets.filter(s => s.done).map(s => s.w))
      if (mx > 0 && mx > bestWeightFor(st, e.id)) prByEx[e.id] = new Set(['weight'])
      else { const rec = is1RMRecord(st, e.id, e); if (rec) prByEx[e.id] = new Set(['e1rm']) }
    }
  })
  const prs = Object.keys(prByEx)
  const prDetails = Object.entries(prByEx).map(([id, kinds]) => {
    const entry = A.entries.find(e => e.id === id)
    const repBests = entry ? [...new Map(
      entry.sets
        .filter(s => s.done && s.pr === 'reprange' && s.r > 0 && s.w > 0)
        .sort((a, b) => a.r - b.r)
        .map(s => [Math.round(s.r), s.w])
    ).entries()].map(([r, wt]) => ({ r, w: wt })) : []
    return { id, kinds: [...kinds], repBests }
  })
  const w = {
    id: A.id, d: A.d, start: A.start, end: Date.now(), routineId: A.routineId, name: A.name, bw: A.bw,
    entries: A.entries.filter(e => e.kind !== 'block').map(e => ({ id: e.id, sets: e.sets, topW: e.topW || null, target: e.target || null })).filter(e => (e.sets || []).some(s => s.done)),
    prs,
    ...(A.hybrid ? {
      cardioBlocks: A.entries.filter(e => e.kind === 'block' && e.done).map(e => ({
        sport: e.sport, type: e.type, duration: e.duration, distKm: e.distKm || null, kcal: e.kcal || null, notes: e.notes || null,
      }))
    } : {}),
  }
  w.vol = workoutVolume(w)
  update(s => {
    w.entries.forEach(e => {
      const mx = Math.max(0, ...e.sets.filter(x => x.done).map(x => x.w || 0), e.topW || 0)
      if (mx > 0) { const cur = s.exWeights[e.id]; if (!cur || mx > cur.w) s.exWeights[e.id] = { w: mx, d: w.d } }
    })
    s.workouts.push(w)
    s.active = null
    // Record programme session completion and auto-advance week when all sessions done.
    if (A.programmeId != null && A.progWeek != null && A.progSessionIdx != null) {
      if (!s.programmes) s.programmes = []
      const prog = s.programmes.find(p => p.id === A.programmeId)
      if (prog) {
        if (!prog.weekProgress) prog.weekProgress = {}
        const key = String(A.progWeek)
        if (!prog.weekProgress[key]) prog.weekProgress[key] = new Array(prog.routineIds.length).fill(false)
        prog.weekProgress[key][A.progSessionIdx] = true
        if (prog.currentWeek === A.progWeek) {
          const allDone = prog.weekProgress[key].every(Boolean)
          if (allDone && prog.currentWeek < prog.totalWeeks) prog.currentWeek += 1
        }
      }
    }
  })
  useUI.getState().stopRest()
  beep(snd(), 880, 0.15); beep(snd(), 1100, 0.15, 0.18); beep(snd(), 1320, 0.3, 0.36)
  ui().openSheet(close => <FinishSummary w={w} prDetails={prDetails} close={close} />, { kind: 'center', locked: true })
}

/* ============================ programme create / edit ============================ */
function ProgrammeEditor({ initial, close }) {
  const st = useStore(s => s.S)
  const routines = st.routines
  const [name, setName] = useState(initial ? initial.name : '')
  const [totalWeeks, setTotalWeeks] = useState(initial ? initial.totalWeeks : 8)
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? null)
  const [paused, setPaused] = useState(initial?.paused ?? false)
  const [showProgNameError, setShowProgNameError] = useState(false)
  const [expandedSession, setExpandedSession] = useState(null)
  // sessions: ordered list of { routineId, key }
  const [sessions, setSessions] = useState(
    initial
      ? initial.routineIds.map(rid => ({ routineId: rid, key: uid() }))
      : []
  )
  const [initProgSnap] = useState(() => initial ? JSON.stringify({
    name: initial.name,
    routineIds: initial.routineIds,
    totalWeeks: initial.totalWeeks,
    imageUrl: initial.imageUrl ?? null,
    paused: initial.paused ?? false,
  }) : null)
  const hasProgChanges = !initial || JSON.stringify({
    name: name.trim(),
    routineIds: sessions.map(s => s.routineId),
    totalWeeks,
    imageUrl,
    paused,
  }) !== initProgSnap

  const addSession = rid => setSessions(prev => [...prev, { routineId: rid, key: uid() }])
  const removeSession = key => setSessions(prev => prev.filter(s => s.key !== key))
  const moveUp = key => setSessions(prev => {
    const i = prev.findIndex(s => s.key === key)
    if (i <= 0) return prev
    const next = [...prev]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    return next
  })

  const createAndAddSession = () => {
    ui().openSheet(sportPickerClose => (
      <>
        <h3>{t('Type de séance')}</h3>
        <div className="list">
          {Object.entries(SPORTS).map(([key, sp]) => (
            <div key={key} className="item" onClick={() => {
              sportPickerClose()
              const isCardioType = isCardioSport(key)
              const r = {
                id: uid(), name: t('Nouvelle séance'), emoji: DEFAULT_GLYPH,
                sport: key,
                ...(isCardioType ? { blocks: [] } : { ex: [] }),
              }
              update(s => { s.routines.push(r) })
              addSession(r.id)
              // Auto-save the programme if it already has a name, then navigate to RoutineEdit
              const trimmed = name.trim()
              if (trimmed) {
                const updatedIds = [...sessions.map(s => s.routineId), r.id]
                update(st => {
                  if (!st.programmes) st.programmes = []
                  if (initial) {
                    const idx = st.programmes.findIndex(p => p.id === initial.id)
                    if (idx >= 0) st.programmes[idx] = { ...st.programmes[idx], name: trimmed, routineIds: updatedIds, totalWeeks, imageUrl, paused }
                  } else {
                    st.programmes.push({ id: uid(), name: trimmed, routineIds: updatedIds, totalWeeks, currentWeek: 1, weekProgress: {}, imageUrl, paused: false })
                  }
                })
              }
              close()
              nav('/plan/r/' + r.id, { state: { isNew: true } })
            }}>
              <span className="lrow-i" style={{ background: sp.cardio ? 'var(--teal)' : 'var(--acc)', opacity: 0.85 }}>
                <Icon name={sp.icon} />
              </span>
              <div className="grow">
                <div className="tt">{t(sp.label)}</div>
                <div className="ss">{sp.cardio ? t('Cardio — timer-based blocks') : t('Strength — sets & reps')}</div>
              </div>
              <Icon name="chevronRight" className="chev" />
            </div>
          ))}
        </div>
      </>
    ))
  }

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setShowProgNameError(true)
      ui().openSheet(errClose => (
        <div style={{ textAlign: 'center', padding: '8px 4px' }}>
          <Icon name="info" style={{ fontSize: 52, color: 'var(--yellow)', marginBottom: 14 }} />
          <h3 style={{ marginBottom: 6 }}>{t('Nommez votre programme')}</h3>
          <p className="muted small" style={{ marginBottom: 20 }}>{t('Donnez un nom à ce programme avant de pouvoir le sauvegarder.')}</p>
          <Button variant="primary" style={{ width: '100%' }} onClick={errClose}>{t('OK')}</Button>
        </div>
      ), { kind: 'center' })
      return
    }
    if (!sessions.length) { toast(t('Ajoutez au moins une séance')); return }
    if (!totalWeeks || totalWeeks < 1) { toast(t('Set programme duration')); return }
    const routineIds = sessions.map(s => s.routineId)
    update(st => {
      if (!st.programmes) st.programmes = []
      if (initial) {
        const idx = st.programmes.findIndex(p => p.id === initial.id)
        if (idx >= 0) {
          st.programmes[idx] = {
            ...st.programmes[idx], name: trimmed, routineIds, totalWeeks, imageUrl, paused,
          }
        }
      } else {
        st.programmes.push({
          id: uid(), name: trimmed, routineIds, totalWeeks,
          currentWeek: 1, weekProgress: {}, imageUrl, paused: false,
        })
      }
    })
    close()
    ui().openSheet(successClose => (
      <div style={{ textAlign: 'center', padding: '8px 4px' }}>
        <Icon name="checkCircle" style={{ fontSize: 52, color: 'var(--teal)', marginBottom: 14 }} />
        <h3 style={{ marginBottom: 6 }}>{t('Programme sauvegardé !')}</h3>
        <p className="muted small" style={{ marginBottom: 20 }}>{trimmed}</p>
        <Button variant="primary" style={{ width: '100%' }} onClick={successClose}>{t('OK')}</Button>
      </div>
    ), { kind: 'center' })
  }

  const routineLabel = rid => {
    const r = routines.find(x => x.id === rid)
    return r ? r.name : rid
  }

  const openSessionPreview = routineId => {
    const snapshot = useStore.getState().S
    const routine = snapshot.routines.find(r => r.id === routineId)
    if (!routine) return
    const all = allExercises(snapshot)
    const entries = routine.items
      ? routine.items
      : routine.ex
        ? routine.ex.map(e => ({ ...e, kind: 'ex' }))
        : (routine.blocks || []).map(b => ({ ...b, kind: 'block' }))
    ui().openSheet(() => (
      <>
        <h3>{routine.name}</h3>
        {entries.length === 0 ? (
          <div className="empty">{t('Pas encore d\'exercices.')}</div>
        ) : (
          <div className="list">
            {entries.map((item, idx) => {
              if (item.kind === 'block') {
                const bt = BLOCK_TYPES[item.type] || {}
                const sp = SPORTS[item.sport] || {}
                return (
                  <div key={idx} className="item" style={{ pointerEvents: 'none' }}>
                    <span className="lrow-i" style={{ background: bt.color || 'var(--teal)' }}>
                      <Icon name={sp.icon || bt.icon || 'bolt'} />
                    </span>
                    <div className="grow">
                      <div className="tt">{bt.label || item.type}</div>
                      <div className="ss">{blockSummary(item)}</div>
                    </div>
                  </div>
                )
              }
              const ex = EXDB[item.id] || all.find(x => x.id === item.id) || { n: item.id, bp: '', eq: '' }
              return (
                <div key={idx} className="item" style={{ pointerEvents: 'none' }}>
                  <Thumb ex={ex} />
                  <div className="grow">
                    <div className="tt capitalize">{ex.n}</div>
                    <div className="ss">{exLine(item, snapshot.unit)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </>
    ))
  }

  return <>
    <h3>{initial ? t('Edit programme') : t('New programme')}</h3>

    {/* ── cover image picker ── */}
    {imageUrl ? (
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ position: 'relative', width: 120, height: 120, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-3)' }}>
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: 6, boxSizing: 'border-box' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.68) 100%)' }} />
          <div style={{ position: 'absolute', bottom: 7, left: 7, right: 7, fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
            {name || t('Programme name')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
          <button
            onClick={async () => { const url = await pickImage(); if (url) setImageUrl(url) }}
            style={{ background: 'var(--surface-3)', border: 'none', borderRadius: 8, padding: '8px 14px', color: 'var(--label)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >{t('Changer')}</button>
          {isUserImage(imageUrl) && (
            <button
              onClick={() => setImageUrl(null)}
              style={{ background: 'rgba(220,38,38,0.1)', border: 'none', borderRadius: 8, padding: '8px 14px', color: 'var(--red)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >{t('Supprimer')}</button>
          )}
        </div>
      </div>
    ) : (
      <button
        onClick={async () => { const url = await pickImage(); if (url) setImageUrl(url) }}
        style={{
          width: 120, height: 120, marginBottom: 16, borderRadius: 12,
          border: '1.5px dashed var(--sep)', background: 'var(--surface-2)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          color: 'var(--label-3)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}
      >
        <Icon name="photo" style={{ fontSize: 22 }} />
        {t('Ajouter photo')}
      </button>
    )}

    <div className="small muted" style={{ marginBottom: 4 }}>{t('Programme name')}</div>
    <input
      className="input" placeholder={t('Programme name')}
      value={name}
      onChange={e => {
        setName(e.target.value)
        if (showProgNameError && e.target.value.trim()) setShowProgNameError(false)
      }}
      style={{ marginBottom: showProgNameError ? 4 : 16, width: '100%', boxSizing: 'border-box', ...(showProgNameError ? { outline: '2px solid var(--red)', borderRadius: 6 } : {}) }}
    />
    {showProgNameError && (
      <div style={{ color: 'var(--red)', fontSize: 12, margin: '0 2px 12px', padding: '7px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 8, lineHeight: 1.5 }}>
        {t('Donnez un nom à ce programme avant de sauvegarder.')}
      </div>
    )}

    <div className="row between" style={{ marginBottom: 4 }}>
      <div className="small muted">{t('Duration (weeks)')}</div>
      <div className="small" style={{ fontWeight: 600 }}>{totalWeeks} {t('weeks')}</div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <button className="iconbtn" onClick={() => setTotalWeeks(w => Math.max(1, w - 1))} style={{ width: 36, height: 36, borderRadius: 10 }}><Icon name="minus" /></button>
      <div style={{ flex: 1, height: 4, background: 'var(--surface-3)', borderRadius: 2 }}>
        <div style={{ height: '100%', background: 'var(--acc)', borderRadius: 2, width: Math.min(100, (totalWeeks / 26) * 100) + '%', transition: 'width .2s' }} />
      </div>
      <button className="iconbtn" onClick={() => setTotalWeeks(w => Math.min(52, w + 1))} style={{ width: 36, height: 36, borderRadius: 10 }}><Icon name="plus" /></button>
    </div>

    <div className="small muted" style={{ marginBottom: 8 }}>{t('Sessions per cycle (in order)')}</div>
    {sessions.length === 0 && (
      <div className="empty" style={{ padding: '12px 0', marginBottom: 8 }}>{t('No sessions added yet.')}</div>
    )}
    {sessions.map((s, i) => {
      const isExpanded = expandedSession === s.key
      const routine = routines.find(r => r.id === s.routineId)
      let expandedContent = null
      if (isExpanded && routine) {
        const all = allExercises(st)
        const entries = routine.items
          ? routine.items
          : routine.ex
            ? routine.ex.map(e => ({ ...e, kind: 'ex' }))
            : (routine.blocks || []).map(b => ({ ...b, kind: 'block' }))
        expandedContent = (
          <div style={{
            background: 'var(--surface-2)', borderRadius: '0 0 10px 10px',
            borderTop: '1px solid var(--sep)', padding: '4px 10px 10px',
          }}>
            {entries.length === 0 ? (
              <div className="small muted" style={{ textAlign: 'center', padding: '8px 0' }}>{t('Pas encore d\'exercices.')}</div>
            ) : entries.map((item, idx) => {
              if (item.kind === 'block') {
                const bt = BLOCK_TYPES[item.type] || {}
                const sp = SPORTS[item.sport] || {}
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: idx < entries.length - 1 ? '1px solid var(--sep)' : 'none' }}>
                    <span style={{ width: 26, height: 26, borderRadius: 6, background: bt.color || 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={sp.icon || bt.icon || 'bolt'} style={{ color: '#fff', fontSize: 12 }} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{bt.label || item.type}</div>
                      <div style={{ fontSize: 12, color: 'var(--label-3)' }}>{blockSummary(item)}</div>
                    </div>
                  </div>
                )
              }
              const ex = EXDB[item.id] || all.find(x => x.id === item.id) || { n: item.id, bp: '', eq: '' }
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: idx < entries.length - 1 ? '1px solid var(--sep)' : 'none' }}>
                  <Thumb ex={ex} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{ex.n}</div>
                    <div style={{ fontSize: 12, color: 'var(--label-3)' }}>{exLine(item, st.unit)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
      return (
        <div key={s.key} style={{ marginBottom: 6 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface-2)', borderRadius: isExpanded ? '10px 10px 0 0' : 10, padding: '8px 10px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-3)', minWidth: 18, textAlign: 'center' }}>{i + 1}</div>
            <div
              style={{ flex: 1, fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setExpandedSession(prev => prev === s.key ? null : s.key)}
            >
              {routineLabel(s.routineId)}
              <Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} style={{ color: 'var(--label-3)', fontSize: 12 }} />
            </div>
            {i > 0 && (
              <button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => moveUp(s.key)} aria-label={t('Move up')}>
                <Icon name="chevronUp" />
              </button>
            )}
            <button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => removeSession(s.key)} aria-label={t('Remove')}>
              <Icon name="xmark" />
            </button>
          </div>
          {expandedContent}
        </div>
      )
    })}

    <div style={{ marginTop: 16, marginBottom: 8 }}>
      <Button variant="tinted" icon="plus" style={{ width: '100%' }} onClick={createAndAddSession}>
        {t('Créer une nouvelle séance')}
      </Button>
    </div>

    {routines.length > 0 && <>
      <div className="small muted" style={{ marginBottom: 8 }}>{t('Ajouter une séance existante')}</div>
      <div className="list">
        {routines.map(r => (
          <div key={r.id} className="item" onClick={() => addSession(r.id)} style={{ cursor: 'pointer' }}>
            <span className="lrow-i" style={isCardioSport(r.sport) ? { background: 'var(--teal)' } : undefined}>
              <Icon name={isCardioSport(r.sport) ? (SPORTS[r.sport]?.icon || 'bolt') : glyphOf(r.emoji)} />
            </span>
            <div className="grow"><div className="tt">{r.name}</div></div>
            <Icon name="plus" style={{ color: 'var(--acc)' }} />
          </div>
        ))}
      </div>
    </>}

    <div style={{ height: 16 }} />
    {initial && (
      <button
        onClick={() => setPaused(p => !p)}
        style={{
          width: '100%', padding: '11px', marginBottom: 10, borderRadius: 10,
          background: paused ? 'rgba(120,120,120,0.1)' : 'transparent',
          border: `1.5px solid ${paused ? 'rgba(140,140,140,0.5)' : 'rgba(140,140,140,0.3)'}`,
          color: 'var(--label-2)',
          fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <Icon name={paused ? 'play' : 'pause'} style={{ fontSize: 14 }} />
        {paused ? t('Réactiver le programme') : t('Mettre en pause')}
      </button>
    )}
    <Button variant="primary" style={{ width: '100%' }} onClick={save}
      disabled={!sessions.length || (initial ? !hasProgChanges : false)}>
      {t('Sauvegarder')}
    </Button>
  </>
}

export const programmeCreateSheet = () =>
  ui().openSheet(close => <ProgrammeEditor close={close} />)

export const programmeEditSheet = prog =>
  ui().openSheet(close => <ProgrammeEditor initial={prog} close={close} />)

export function deleteProgramme(id) {
  confirmSheet({
    title: t('Delete programme?'),
    message: t('Le programme et sa progression sont supprimés. Les séances sont conservées.'),
    danger: true,
    confirmText: t('Delete'),
    onConfirm: () => update(s => { s.programmes = (s.programmes || []).filter(p => p.id !== id) }),
  })
}
