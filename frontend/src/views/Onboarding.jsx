import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button, Stepper } from '../components/ui.jsx'
import { SasoianMark } from '../components/SasoianLogo.jsx'
import { loadStarterPlan } from '../sheets.jsx'
import { ACTIVITY_LEVELS, ACTIVITY_LABEL, ACTIVITY_DESC, calcBMR, calcTDEE } from '../lib/nutrition.js'
import { GOALS, GOAL_LABEL, GOAL_DESC, GOAL_DEFAULT_DELTA, calcTargetKcal } from '../lib/goals.js'
import { calcMacros } from '../lib/macros.js'
import { todayISO } from '../lib/format.js'

/* ── Equipment catalogue (exporté pour Settings) ─────────────────── */
export const EQUIPMENT_OPTIONS = [
  { key: 'body weight',       label: 'Poids de corps' },
  { key: 'dumbbell',          label: 'Haltères' },
  { key: 'barbell',           label: 'Barre + disques' },
  { key: 'ez barbell',        label: 'Barre EZ' },
  { key: 'kettlebell',        label: 'Kettlebell' },
  { key: 'cable',             label: 'Câble / Poulie' },
  { key: 'leverage machine',  label: 'Machines guidées' },
  { key: 'smith machine',     label: 'Smith machine' },
  { key: 'resistance band',   label: 'Élastiques' },
  { key: 'medicine ball',     label: 'Médecine ball' },
  { key: 'stationary bike',   label: 'Vélo stationnaire' },
]

/* ── Progress dots (étapes 1-3) ───────────────────────────────────── */
function ProgressDots({ step }) {
  if (step === 0) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingTop: 16, paddingBottom: 4 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          width: i <= step ? 20 : 6, height: 6, borderRadius: 3,
          background: i === step ? 'var(--acc)' : i < step
            ? 'color-mix(in srgb,var(--acc) 40%,transparent)'
            : 'var(--sep)',
          transition: 'all .25s var(--ease)',
        }} />
      ))}
    </div>
  )
}

/* ── Titre d'étape ────────────────────────────────────────────────── */
function StepHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 24, marginTop: 8 }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1.15, marginBottom: 6 }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 14, color: 'var(--label-3)', lineHeight: 1.5 }}>{subtitle}</p>
      )}
    </div>
  )
}

/* ── Tuile de sélection ───────────────────────────────────────────── */
function Tile({ selected, onClick, icon, color, label, subtitle }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%',
        padding: '12px 14px', borderRadius: 14, textAlign: 'left', cursor: 'pointer',
        background: selected
          ? `color-mix(in srgb,${color || 'var(--acc)'} 14%,var(--surface))`
          : 'var(--surface)',
        border: `1.5px solid ${selected ? (color || 'var(--acc)') : 'var(--sep)'}`,
        transition: 'all .15s',
      }}
    >
      {icon && (
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `color-mix(in srgb,${color || 'var(--acc)'} 18%,var(--surface-2))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color || 'var(--acc)', fontSize: 17,
        }}>
          <Icon name={icon} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: selected ? (color || 'var(--acc)') : 'var(--label-1)' }}>
          {label}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 2, lineHeight: 1.35 }}>{subtitle}</div>
        )}
      </div>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${selected ? (color || 'var(--acc)') : 'var(--sep)'}`,
        background: selected ? (color || 'var(--acc)') : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <Icon name="check" style={{ fontSize: 11, color: '#fff' }} />}
      </div>
    </button>
  )
}

/* ── Icônes et couleurs des niveaux d'activité ────────────────────── */
const ACTIVITY_ICON  = { sedentary: 'person', light: 'figureStrength', moderate: 'figureRun', active: 'bolt', extra: 'flame' }
const ACTIVITY_COLOR = { sedentary: 'var(--label-3)', light: 'var(--teal)', moderate: 'var(--blue)', active: 'var(--orange)', extra: 'var(--red)' }
const GOAL_ICON      = { maintain: 'target', cut: 'arrowDown', bulk: 'arrowUp', recomp: 'shuffle' }
const GOAL_COLOR     = { maintain: 'var(--teal)', cut: 'var(--blue)', bulk: 'var(--green)', recomp: 'var(--purple)' }

/* ══════════════════════════════════════════════════════════════════ */
export default function Onboarding() {
  const update = useStore(s => s.update)
  const [step, setStep] = useState(0)

  // Étape 0
  const [name, setName] = useState('')

  // Étape 1 — profil de base
  const [unit, setUnit]         = useState('kg')
  const [sex, setSex]           = useState(null)   // null = non sélectionné
  const [age, setAge]           = useState(null)
  const [heightCm, setHeightCm] = useState(null)

  // Étape 2 — activité & objectif
  const [activityLevel, setActivityLevel]     = useState(null) // null = non sélectionné
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState(0)
  const [goal, setGoal]                       = useState(null) // null = non sélectionné
  const [goalDelta, setGoalDelta]             = useState(0)

  /* ── Handlers ─────────────────────────────────────────────────── */

  const handleGoalChange = g => {
    setGoal(g)
    setGoalDelta(GOAL_DEFAULT_DELTA[g] || 0)
  }

  const saveStep = n => {
    if (n === 1) {
      update(s => {
        s.displayName = name.trim() || null
        s.unit = unit
        s.nutrition = {
          ...(s.nutrition || {}),
          sex: sex || null,
          age: age || null,
          heightCm: heightCm || null,
        }
      })
    }
    if (n === 2) {
      update(s => {
        const newBmr    = calcBMR(s.nutrition?.sex, null, s.nutrition?.heightCm, s.nutrition?.age)
        const newTdee   = calcTDEE(newBmr, activityLevel, workoutsPerWeek)
        const newTarget = calcTargetKcal(newTdee, goalDelta)
        s.nutrition = {
          ...(s.nutrition || {}),
          activityLevel,
          workoutsPerWeek,
          goal,
          goalDelta,
          bmr: newBmr,
          tdee: newTdee,
          targetKcal: newTarget,
          macros: calcMacros(newTarget, null, goal, workoutsPerWeek),
        }
      })
    }
  }

  const next = () => {
    saveStep(step)
    setStep(s => s + 1)
  }

  const back = () => setStep(s => s - 1)

  const finish = (loadPlan, weight) => {
    if (weight && weight > 0) {
      update(s => {
        const now = Date.now()
        s.bodyweight = [...(s.bodyweight || []), { t: now, w: weight, d: todayISO() }]
        const toKg  = w => unit === 'lb' ? w / 2.2046 : w
        const wKg   = toKg(weight)
        const n     = s.nutrition || {}
        const newBmr    = calcBMR(n.sex, wKg, n.heightCm, n.age)
        const newTdee   = calcTDEE(newBmr, n.activityLevel, n.workoutsPerWeek)
        const newTarget = calcTargetKcal(newTdee, n.goalDelta)
        s.nutrition.bmr        = newBmr
        s.nutrition.tdee       = newTdee
        s.nutrition.targetKcal = newTarget
        s.nutrition.macros     = calcMacros(newTarget, wKg, n.goal, n.workoutsPerWeek)
      })
    }
    update(s => { s.onboardingDone = true })
    if (loadPlan) loadStarterPlan()
  }

  /* ── Rendu ────────────────────────────────────────────────────── */
  const renderStep = () => {
    switch (step) {
      case 0: return <Step0 name={name} setName={setName} onNext={next} />
      case 1: return (
        <Step1
          unit={unit} sex={sex} age={age} heightCm={heightCm}
          onUnit={setUnit} onSex={setSex} onAge={setAge} onHeight={setHeightCm}
          onNext={next} onBack={back}
        />
      )
      case 2: return (
        <Step2
          activityLevel={activityLevel} workoutsPerWeek={workoutsPerWeek}
          goal={goal} onActivity={setActivityLevel}
          onWorkouts={setWorkoutsPerWeek} onGoal={handleGoalChange}
          onNext={next} onBack={back}
        />
      )
      case 3: return (
        <Step3 unit={unit} onBack={back} onFinish={finish} />
      )
      default: return null
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <ProgressDots step={step} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: 140 }}>
        {renderStep()}
      </div>
    </div>
  )
}

/* ══ STEP 0 — Bienvenue ════════════════════════════════════════════ */
const FEATURES = [
  { icon: 'dumbbell',  color: 'var(--acc)',    label: 'Smart progression',  desc: 'Auto-increments weight, predicts your next set.' },
  { icon: 'chartLine', color: 'var(--blue)',   label: 'Track everything',   desc: 'PRs, volume, body weight, measurements, macros.' },
  { icon: 'flame',     color: 'var(--orange)', label: 'Stay consistent',    desc: 'Weekly streak, muscle balance heatmap, calendar.' },
]

function Step0({ name, setName, onNext }) {
  return (
    <div style={{ paddingTop: 60, maxWidth: 560, margin: '0 auto' }}>
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 320, height: 320, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, color-mix(in srgb,var(--acc) 12%,transparent) 0%, transparent 72%)',
      }} />

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, animation: 'badgePop .45s var(--ease)' }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: -12, borderRadius: '50%',
            background: 'radial-gradient(circle, color-mix(in srgb,var(--acc) 20%,transparent), transparent 70%)',
          }} />
          <SasoianMark size={76} />
        </div>
      </div>

      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.028em', lineHeight: 1.12, textAlign: 'center', marginBottom: 8 }}>
        {name.trim() ? t('Hi {0}! 👋', name.trim()) : t('Welcome to Sasoian!')}
      </h1>
      <p style={{ textAlign: 'center', color: 'var(--label-2)', fontSize: 15, lineHeight: 1.5, marginBottom: 32 }}>
        {t('Your personal fitness tracker — built for consistency.')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {FEATURES.map(f => (
          <div key={f.icon} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: `linear-gradient(135deg,color-mix(in srgb,${f.color} 9%,var(--surface)),var(--surface))`,
            border: `1px solid color-mix(in srgb,${f.color} 16%,transparent)`,
            borderRadius: 14, padding: '12px 14px',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11, flexShrink: 0,
              background: `color-mix(in srgb,${f.color} 18%,var(--surface-2))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: f.color, fontSize: 18,
            }}>
              <Icon name={f.icon} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t(f.label)}</div>
              <div style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 2, lineHeight: 1.35 }}>{t(f.desc)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 8 }}>
        <FieldLabel>{t('What should we call you?')}</FieldLabel>
        <input
          className="input"
          autoFocus
          placeholder={t('Your first name or nickname')}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onNext() }}
          style={{ fontSize: 17, padding: '14px 16px', borderRadius: 14, width: '100%', boxSizing: 'border-box' }}
        />
        <div style={{ fontSize: 12, color: 'var(--label-4)', marginTop: 6 }}>
          {t('Optional — shown in your greeting.')}
        </div>
      </div>

      <BottomBar>
        <Button variant="primary" style={{ width: '100%', padding: '15px 0', fontSize: 16, borderRadius: 14 }} icon="arrowRight"
          onClick={onNext}>
          {"C'est parti !"}
        </Button>
      </BottomBar>
    </div>
  )
}

/* ══ STEP 1 — Profil de base ════════════════════════════════════════ */
function Step1({ unit, sex, age, heightCm, onUnit, onSex, onAge, onHeight, onNext, onBack }) {
  const canContinue = sex !== null

  return (
    <div style={{ paddingTop: 12, maxWidth: 560, margin: '0 auto' }}>
      <StepHeader
        title={"Quelques infos sur toi"}
        subtitle={"Utilisées pour calculer ton BMR et tes besoins caloriques. Elles restent sur ton appareil."}
      />

      {/* Unité */}
      <FieldLabel>{"Unité de poids"}</FieldLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {['kg', 'lb'].map(u => (
          <button key={u} onClick={() => onUnit(u)} style={{
            padding: '14px', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer',
            background: unit === u ? 'var(--acc)' : 'var(--surface)',
            color: unit === u ? '#fff' : 'var(--label-1)',
            border: `1.5px solid ${unit === u ? 'var(--acc)' : 'var(--sep)'}`,
            transition: 'all .15s',
          }}>
            {u}
          </button>
        ))}
      </div>

      {/* Sexe biologique */}
      <FieldLabel>{"Sexe biologique"} <span style={{ color: 'var(--acc)', marginLeft: 4 }}>*</span></FieldLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 6 }}>
        {[
          { key: 'male',   label: 'Homme', color: 'var(--blue)' },
          { key: 'female', label: 'Femme', color: 'var(--pink)' },
        ].map(o => (
          <button key={o.key} onClick={() => onSex(o.key)} style={{
            padding: '18px 12px', borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer',
            background: sex === o.key ? `color-mix(in srgb,${o.color} 14%,var(--surface))` : 'var(--surface)',
            color: sex === o.key ? o.color : 'var(--label-1)',
            border: `1.5px solid ${sex === o.key ? o.color : 'var(--sep)'}`,
            transition: 'all .15s',
          }}>
            {o.label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--label-4)', marginBottom: 20, lineHeight: 1.4 }}>
        {"Requis pour la formule de Mifflin-St Jeor (BMR). Pas utilisé ailleurs."}
      </p>

      {/* Âge */}
      <FieldLabel>{"Âge"}</FieldLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <input
          className="input" type="number" inputMode="numeric" placeholder="—"
          value={age ?? ''}
          onChange={e => onAge(e.target.value ? +e.target.value : null)}
          style={{ flex: 1, fontSize: 20, padding: '12px 16px', borderRadius: 12, textAlign: 'center' }}
        />
        <span style={{ fontSize: 14, color: 'var(--label-3)', minWidth: 32 }}>{"ans"}</span>
      </div>

      {/* Taille */}
      <FieldLabel>{"Taille"}</FieldLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <input
          className="input" type="number" inputMode="numeric" placeholder="—"
          value={heightCm ?? ''}
          onChange={e => onHeight(e.target.value ? +e.target.value : null)}
          style={{ flex: 1, fontSize: 20, padding: '12px 16px', borderRadius: 12, textAlign: 'center' }}
        />
        <span style={{ fontSize: 14, color: 'var(--label-3)', minWidth: 32 }}>cm</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--label-4)', marginBottom: 8, lineHeight: 1.4 }}>
        {"Âge et taille sont facultatifs — modifiables à tout moment dans Nutrition > Profil."}
      </p>

      <BottomBar>
        <NavButtons
          onBack={onBack}
          onNext={onNext}
          disabled={!canContinue}
          hint={!canContinue ? "Sélectionne un sexe pour continuer" : null}
        />
      </BottomBar>
    </div>
  )
}

/* ══ STEP 2 — Activité & Objectif ════════════════════════════════════ */
function Step2({ activityLevel, workoutsPerWeek, goal, onActivity, onWorkouts, onGoal, onNext, onBack }) {
  const canContinue = activityLevel !== null && goal !== null
  const hintMsg = activityLevel === null && goal === null
    ? "Sélectionne un niveau d'activité et un objectif pour continuer"
    : activityLevel === null
      ? "Sélectionne un niveau d'activité pour continuer"
      : "Sélectionne un objectif pour continuer"

  return (
    <div style={{ paddingTop: 12, maxWidth: 560, margin: '0 auto' }}>
      <StepHeader
        title={"Activité & Objectif"}
        subtitle={"Choisis le niveau qui correspond à ta vie quotidienne hors séances de sport."}
      />

      {/* Niveau d'activité */}
      <FieldLabel>{"Niveau d'activité quotidien"} <span style={{ color: 'var(--acc)', marginLeft: 4 }}>*</span></FieldLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {ACTIVITY_LEVELS.map(k => (
          <Tile
            key={k}
            selected={activityLevel === k}
            onClick={() => onActivity(k)}
            icon={ACTIVITY_ICON[k] || 'bolt'}
            color={ACTIVITY_COLOR[k]}
            label={t(ACTIVITY_LABEL[k])}
            subtitle={t(ACTIVITY_DESC[k])}
          />
        ))}
      </div>

      {/* Séances de sport / semaine */}
      <FieldLabel>{"Séances de sport par semaine"}</FieldLabel>
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{"Entraînements / semaine"}</div>
            <div style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 2 }}>
              {"Gym, sport, cardio — hors activité quotidienne ci-dessus"}
            </div>
          </div>
          <Stepper value={workoutsPerWeek} step={1} decimal={false}
            onChange={v => onWorkouts(Math.min(14, Math.max(0, v)))} />
        </div>
      </div>

      {/* Objectif */}
      <FieldLabel>{"Objectif principal"} <span style={{ color: 'var(--acc)', marginLeft: 4 }}>*</span></FieldLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        {GOALS.map(k => (
          <Tile
            key={k}
            selected={goal === k}
            onClick={() => onGoal(k)}
            icon={GOAL_ICON[k]}
            color={GOAL_COLOR[k]}
            label={t(GOAL_LABEL[k])}
            subtitle={t(GOAL_DESC[k])}
          />
        ))}
      </div>

      <BottomBar>
        <NavButtons
          onBack={onBack}
          onNext={onNext}
          disabled={!canContinue}
          hint={!canContinue ? hintMsg : null}
        />
      </BottomBar>
    </div>
  )
}

/* ══ STEP 3 — Poids (optionnel) ═════════════════════════════════════ */
function Step3({ unit, onBack, onFinish }) {
  const [weight, setWeight] = useState(null)

  return (
    <div style={{ paddingTop: 12, maxWidth: 560, margin: '0 auto' }}>
      <StepHeader
        title={"Ton poids actuel"}
        subtitle={"Optionnel — active le suivi de progression et les projections caloriques."}
      />

      <div className="card" style={{
        padding: '14px 16px', marginBottom: 20,
        background: 'color-mix(in srgb,var(--blue) 8%,var(--surface))',
        border: '1px solid color-mix(in srgb,var(--blue) 20%,transparent)',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="lightbulb" style={{ fontSize: 18, color: 'var(--blue)', marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: 'var(--label-2)', lineHeight: 1.6 }}>
            {"Pour des données comparables dans le temps :"}
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li>{"Le matin, à jeun"}</li>
              <li>{"Après être allé aux toilettes"}</li>
              <li>{"Avant de manger ou boire"}</li>
              <li>{"Toujours dans les mêmes conditions"}</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <input
          className="input" type="number" inputMode="decimal" placeholder="—"
          value={weight ?? ''}
          onChange={e => setWeight(e.target.value ? +e.target.value : null)}
          style={{ flex: 1, fontSize: 28, fontWeight: 700, padding: '16px', borderRadius: 14, textAlign: 'center' }}
        />
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--label-2)', minWidth: 36 }}>{unit}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--label-4)', marginBottom: 24, lineHeight: 1.4 }}>
        {"Modifiable à tout moment dans l'onglet Poids."}
      </p>

      <BottomBar>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button variant="primary" icon="sparkles"
            style={{ width: '100%', padding: '15px 0', fontSize: 16, borderRadius: 14 }}
            onClick={() => onFinish(true, weight)}>
            {"Charger un plan starter (PPL)"}
          </Button>
          <Button style={{ width: '100%', padding: '12px 0', fontSize: 14, borderRadius: 12 }}
            onClick={() => onFinish(false, weight)}>
            {"Je configure mon plan manuellement"}
          </Button>
          <button
            style={{ width: '100%', padding: '8px', fontSize: 13, color: 'var(--label-3)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => onFinish(false, null)}>
            {"Je me pèserai demain matin →"}
          </button>
        </div>
      </BottomBar>
    </div>
  )
}

/* ── Composants partagés ─────────────────────────────────────────── */

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-2)', marginBottom: 10, letterSpacing: '.01em', display: 'flex', alignItems: 'center' }}>
      {children}
    </div>
  )
}

function BottomBar({ children }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 560,
      padding: '16px 16px calc(16px + env(safe-area-inset-bottom,0px))',
      background: 'linear-gradient(to top, var(--bg) 72%, transparent)',
      zIndex: 10,
    }}>
      {children}
    </div>
  )
}

function NavButtons({ onBack, onNext, disabled, hint }) {
  return (
    <div>
      {hint && (
        <p style={{ fontSize: 12, color: 'var(--orange)', textAlign: 'center', marginBottom: 8 }}>
          <Icon name="lightbulb" style={{ fontSize: 12, marginRight: 4 }} />{hint}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <Button style={{ padding: '14px 20px', borderRadius: 14, fontSize: 15 }} icon="chevronLeft" onClick={onBack}>
          {"Retour"}
        </Button>
        <Button
          variant="primary"
          style={{
            flex: 1, padding: '14px', fontSize: 15, borderRadius: 14,
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          icon="arrowRight"
          onClick={disabled ? undefined : onNext}
        >
          {"Suivant"}
        </Button>
      </div>
    </div>
  )
}
