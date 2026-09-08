import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField, Stepper } from '../components/ui.jsx'
import { SasoianMark } from '../components/SasoianLogo.jsx'
import { loadStarterPlan } from '../sheets.jsx'
import { ACTIVITY_LEVELS, ACTIVITY_LABEL, ACTIVITY_DESC, calcBMR, calcTDEE } from '../lib/nutrition.js'
import { GOALS, GOAL_LABEL, GOAL_DESC, GOAL_DEFAULT_DELTA, calcTargetKcal } from '../lib/goals.js'
import { calcMacros } from '../lib/macros.js'
import { todayISO } from '../lib/format.js'

/* ── Equipment catalogue ─────────────────────────────────────────────── */
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
const ALL_EQ = EQUIPMENT_OPTIONS.map(e => e.key)

const TOTAL_STEPS = 5 // steps 0..4

/* ── Progress dots ───────────────────────────────────────────────────── */
function ProgressDots({ step }) {
  if (step === 0) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingTop: 16, paddingBottom: 4 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          width: i <= step ? 20 : 6, height: 6, borderRadius: 3,
          background: i === step ? 'var(--acc)' : i < step ? 'color-mix(in srgb,var(--acc) 40%,transparent)' : 'var(--sep)',
          transition: 'all .25s var(--ease)',
        }} />
      ))}
    </div>
  )
}

/* ── Step title ──────────────────────────────────────────────────────── */
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

/* ── Selection tile ──────────────────────────────────────────────────── */
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

/* ── Sex tile (compact, 2-column) ────────────────────────────────────── */
function SexGrid({ value, onChange }) {
  const options = [
    { key: 'male',   label: t('Homme'),  icon: 'person',       color: 'var(--blue)' },
    { key: 'female', label: t('Femme'),  icon: 'person',       color: 'var(--pink)' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            padding: '16px 12px', borderRadius: 14, cursor: 'pointer',
            background: value === o.key ? `color-mix(in srgb,${o.color} 14%,var(--surface))` : 'var(--surface)',
            border: `1.5px solid ${value === o.key ? o.color : 'var(--sep)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            transition: 'all .15s',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: `color-mix(in srgb,${o.color} 20%,var(--surface-2))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: o.color, fontSize: 22,
          }}>
            <Icon name={o.icon} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: value === o.key ? o.color : 'var(--label-1)' }}>
            {o.label}
          </span>
        </button>
      ))}
    </div>
  )
}

/* ── Equipment chip grid ─────────────────────────────────────────────── */
function EquipmentGrid({ value, onChange }) {
  const allSelected = ALL_EQ.every(k => value.includes(k))
  const toggle = key => onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key])
  const toggleAll = () => onChange(allSelected ? [] : [...ALL_EQ])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          className="chip on"
          style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, background: allSelected ? 'var(--sep)' : 'var(--acc)', color: allSelected ? 'var(--label-2)' : '#fff', border: 'none' }}
          onClick={toggleAll}
        >
          {allSelected ? t('Tout décocher') : t('Tout cocher')}
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {EQUIPMENT_OPTIONS.map(eq => {
          const on = value.includes(eq.key)
          return (
            <button
              key={eq.key}
              onClick={() => toggle(eq.key)}
              className={'chip' + (on ? ' on' : '')}
              style={{ fontSize: 13, padding: '7px 14px', borderRadius: 10 }}
            >
              {t(eq.label)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function Onboarding() {
  const update = useStore(s => s.update)

  const [step, setStep] = useState(0)

  // Step 0
  const [name, setName] = useState('')

  // Step 1 — profil de base
  const [unit, setUnit]         = useState('kg')
  const [sex, setSex]           = useState(null)
  const [age, setAge]           = useState(null)
  const [heightCm, setHeightCm] = useState(null)

  // Step 2 — activité & objectif
  const [activityLevel, setActivityLevel]     = useState('sedentary')
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState(3)
  const [goal, setGoal]                       = useState('maintain')
  const [goalDelta, setGoalDelta]             = useState(0)

  // Step 3 — équipement
  const [equipment, setEquipment]   = useState([])
  const [daysPerWeek, setDaysPerWeek] = useState(3)

  // Step 4 — poids (optionnel)
  const [weight, setWeight] = useState(null)

  /* ── Helpers ─────────────────────────────────────────────────────── */

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
        const wKg = null // weight not yet entered
        const newBmr  = calcBMR(s.nutrition?.sex, wKg, s.nutrition?.heightCm, s.nutrition?.age)
        const newTdee = calcTDEE(newBmr, activityLevel, workoutsPerWeek)
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
    if (n === 3) {
      update(s => {
        s.equipment  = equipment
        s.daysPerWeek = daysPerWeek
      })
    }
  }

  const next = () => {
    saveStep(step)
    setStep(s => s + 1)
  }

  const back = () => setStep(s => s - 1)

  const finish = (loadPlan, bw) => {
    // Save step 3 fields if we're jumping from step 4
    update(s => {
      s.equipment   = equipment
      s.daysPerWeek = daysPerWeek
    })

    if (bw && bw > 0) {
      update(s => {
        const now = Date.now()
        s.bodyweight = [
          ...(s.bodyweight || []),
          { t: now, w: bw, d: todayISO() },
        ]
        // Recompute nutrition with real weight
        const toKg = w => unit === 'lb' ? w / 2.2046 : w
        const wKg  = toKg(bw)
        const n    = s.nutrition || {}
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

  /* ── Layout wrapper ─────────────────────────────────────────────── */
  const renderContent = () => {
    switch (step) {
      case 0: return <Step0 name={name} setName={setName} onNext={next} />
      case 1: return <Step1 unit={unit} sex={sex} age={age} heightCm={heightCm}
                       onUnit={setUnit} onSex={setSex} onAge={setAge} onHeight={setHeightCm}
                       onNext={next} onBack={back} />
      case 2: return <Step2 activityLevel={activityLevel} workoutsPerWeek={workoutsPerWeek}
                       goal={goal} goalDelta={goalDelta}
                       onActivity={setActivityLevel} onWorkouts={setWorkoutsPerWeek}
                       onGoal={handleGoalChange}
                       onNext={next} onBack={back} />
      case 3: return <Step3 equipment={equipment} daysPerWeek={daysPerWeek}
                       onEquipment={setEquipment} onDays={setDaysPerWeek}
                       onNext={next} onBack={back} />
      case 4: return <Step4 unit={unit} weight={weight} onWeight={setWeight}
                       onBack={back} onFinish={finish} />
      default: return null
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <ProgressDots step={step} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: 140 }}>
        {renderContent()}
      </div>
    </div>
  )
}

/* ══ STEP 0 — Bienvenue ══════════════════════════════════════════════ */
const FEATURES = [
  { icon: 'dumbbell',  color: 'var(--acc)',    label: 'Smart progression',  desc: 'Auto-increments weight, predicts your next set.' },
  { icon: 'chartLine', color: 'var(--blue)',   label: 'Track everything',   desc: 'PRs, volume, body weight, measurements, macros.' },
  { icon: 'flame',     color: 'var(--orange)', label: 'Stay consistent',    desc: 'Weekly streak, muscle balance heatmap, calendar.' },
]

function Step0({ name, setName, onNext }) {
  return (
    <div style={{ paddingTop: 60, maxWidth: 560, margin: '0 auto' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 320, height: 320, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, color-mix(in srgb,var(--acc) 12%,transparent) 0%, transparent 72%)',
      }} />

      {/* Logo */}
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
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-2)', marginBottom: 8 }}>
          {t('What should we call you?')}
        </div>
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
          {t("C'est parti !")}
        </Button>
      </BottomBar>
    </div>
  )
}

/* ══ STEP 1 — Profil de base ══════════════════════════════════════════ */
function Step1({ unit, sex, age, heightCm, onUnit, onSex, onAge, onHeight, onNext, onBack }) {
  return (
    <div style={{ paddingTop: 12, maxWidth: 560, margin: '0 auto' }}>
      <StepHeader
        title={t('Quelques infos sur toi')}
        subtitle={t('Utilisées pour calculer ton BMR et tes besoins caloriques. Elles restent sur ton appareil.')}
      />

      {/* Unité */}
      <FieldLabel>{t('Unité de poids')}</FieldLabel>
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
      <FieldLabel>{t('Sexe biologique')}</FieldLabel>
      <div style={{ marginBottom: 20 }}>
        <SexGrid value={sex} onChange={onSex} />
        <p style={{ fontSize: 11, color: 'var(--label-4)', marginTop: 6, lineHeight: 1.4 }}>
          {t('Requis pour la formule de Mifflin-St Jeor. Pas utilisé ailleurs.')}
        </p>
      </div>

      {/* Âge */}
      <FieldLabel>{t('Âge')}</FieldLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          placeholder="—"
          value={age ?? ''}
          onChange={e => onAge(e.target.value ? +e.target.value : null)}
          style={{ flex: 1, fontSize: 20, padding: '12px 16px', borderRadius: 12, textAlign: 'center' }}
        />
        <span style={{ fontSize: 14, color: 'var(--label-3)', minWidth: 32 }}>{t('ans')}</span>
      </div>

      {/* Taille */}
      <FieldLabel>{t('Taille')}</FieldLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          placeholder="—"
          value={heightCm ?? ''}
          onChange={e => onHeight(e.target.value ? +e.target.value : null)}
          style={{ flex: 1, fontSize: 20, padding: '12px 16px', borderRadius: 12, textAlign: 'center' }}
        />
        <span style={{ fontSize: 14, color: 'var(--label-3)', minWidth: 32 }}>cm</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--label-4)', marginBottom: 8, lineHeight: 1.4 }}>
        {t('Ces champs sont facultatifs — tu pourras les compléter plus tard dans le profil nutrition.')}
      </p>

      <BottomBar>
        <NavButtons onBack={onBack} onNext={onNext} />
      </BottomBar>
    </div>
  )
}

/* ══ STEP 2 — Activité & Objectif ════════════════════════════════════ */
const ACTIVITY_ICON  = { sedentary: 'person', light: 'figureStrength', moderate: 'figureRun', active: 'bolt', extra: 'flame' }
const ACTIVITY_COLOR = { sedentary: 'var(--label-3)', light: 'var(--teal)', moderate: 'var(--blue)', active: 'var(--orange)', extra: 'var(--red)' }
const GOAL_ICON      = { maintain: 'target', cut: 'arrowDown', bulk: 'arrowUp', recomp: 'shuffle' }
const GOAL_COLOR     = { maintain: 'var(--teal)', cut: 'var(--blue)', bulk: 'var(--green)', recomp: 'var(--purple)' }

function Step2({ activityLevel, workoutsPerWeek, goal, onActivity, onWorkouts, onGoal, onNext, onBack }) {
  return (
    <div style={{ paddingTop: 12, maxWidth: 560, margin: '0 auto' }}>
      <StepHeader
        title={t('Activité & Objectif')}
        subtitle={t('Choisis le niveau qui correspond à ta vie quotidienne hors séances de sport.')}
      />

      {/* Niveau d'activité */}
      <FieldLabel>{t('Niveau d\'activité quotidien')}</FieldLabel>
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

      {/* Séances sport / semaine */}
      <FieldLabel>{t('Séances de sport par semaine')}</FieldLabel>
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t('Entraînements / semaine')}</div>
            <div style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 2 }}>
              {t('Gym, sport, cardio — hors activité quotidienne')}
            </div>
          </div>
          <Stepper value={workoutsPerWeek} step={1} decimal={false}
            onChange={v => onWorkouts(Math.min(14, Math.max(0, v)))} />
        </div>
      </div>

      {/* Objectif */}
      <FieldLabel>{t('Objectif principal')}</FieldLabel>
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
        <NavButtons onBack={onBack} onNext={onNext} />
      </BottomBar>
    </div>
  )
}

/* ══ STEP 3 — Équipement ═════════════════════════════════════════════ */
function Step3({ equipment, daysPerWeek, onEquipment, onDays, onNext, onBack }) {
  return (
    <div style={{ paddingTop: 12, maxWidth: 560, margin: '0 auto' }}>
      <StepHeader
        title={t('Ton équipement')}
        subtitle={t('Sélectionne ce dont tu disposes. Utilisé pour personnaliser tes séances à l\'avenir.')}
      />

      <EquipmentGrid value={equipment} onChange={onEquipment} />

      {/* Jours d'entraînement par semaine */}
      <div className="card" style={{ padding: '12px 16px', marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t('Jours d\'entraînement / semaine')}</div>
            <div style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 2 }}>
              {t('Pour planifier ton programme')}
            </div>
          </div>
          <Stepper value={daysPerWeek} step={1} decimal={false}
            onChange={v => onDays(Math.min(7, Math.max(1, v)))} />
        </div>
      </div>

      <BottomBar>
        <NavButtons onBack={onBack} onNext={onNext} nextLabel={t('Suivant')} />
      </BottomBar>
    </div>
  )
}

/* ══ STEP 4 — Poids (optionnel) ══════════════════════════════════════ */
function Step4({ unit, weight, onWeight, onBack, onFinish }) {
  return (
    <div style={{ paddingTop: 12, maxWidth: 560, margin: '0 auto' }}>
      <StepHeader
        title={t('Ton poids actuel')}
        subtitle={t('Optionnel — active le suivi de progression et les projections caloriques.')}
      />

      {/* Info card */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 20, background: 'color-mix(in srgb,var(--blue) 8%,var(--surface))', border: '1px solid color-mix(in srgb,var(--blue) 20%,transparent)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="lightbulb" style={{ fontSize: 18, color: 'var(--blue)', marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: 'var(--label-2)', lineHeight: 1.6 }}>
            {t('Pour des données comparables dans le temps :')}
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li>{t('Le matin, à jeun')}</li>
              <li>{t('Après être allé aux toilettes')}</li>
              <li>{t('Avant de manger ou boire')}</li>
              <li>{t('Toujours dans les mêmes conditions')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Weight input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          placeholder="—"
          value={weight ?? ''}
          onChange={e => onWeight(e.target.value ? +e.target.value : null)}
          style={{ flex: 1, fontSize: 28, fontWeight: 700, padding: '16px', borderRadius: 14, textAlign: 'center' }}
        />
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--label-2)', minWidth: 36 }}>{unit}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--label-4)', marginBottom: 24, lineHeight: 1.4 }}>
        {t('Tu peux entrer ou modifier ton poids à tout moment dans l\'onglet Poids.')}
      </p>

      <BottomBar>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button variant="primary" icon="sparkles"
            style={{ width: '100%', padding: '15px 0', fontSize: 16, borderRadius: 14 }}
            onClick={() => onFinish(true, weight)}>
            {t('Charger un plan starter (PPL)')}
          </Button>
          <Button style={{ width: '100%', padding: '12px 0', fontSize: 14, borderRadius: 12 }}
            onClick={() => onFinish(false, weight)}>
            {t('Je configure mon plan manuellement')}
          </Button>
          {!!weight && (
            <button
              style={{ width: '100%', padding: '8px', fontSize: 13, color: 'var(--label-3)', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => onFinish(false, null)}>
              {t('Ignorer le poids pour l\'instant')}
            </button>
          )}
          {!weight && (
            <button
              style={{ width: '100%', padding: '8px', fontSize: 13, color: 'var(--label-3)', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => onFinish(false, null)}>
              {t('Je me pèserai demain matin →')}
            </button>
          )}
        </div>
      </BottomBar>
    </div>
  )
}

/* ── Shared sub-components ───────────────────────────────────────────── */

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-2)', marginBottom: 10, letterSpacing: '.01em' }}>
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

function NavButtons({ onBack, onNext, nextLabel }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <Button style={{ padding: '14px 20px', borderRadius: 14, fontSize: 15 }} icon="chevronLeft" onClick={onBack}>
        {t('Retour')}
      </Button>
      <Button variant="primary" style={{ flex: 1, padding: '14px', fontSize: 15, borderRadius: 14 }} icon="arrowRight" onClick={onNext}>
        {nextLabel || t('Suivant')}
      </Button>
    </div>
  )
}
