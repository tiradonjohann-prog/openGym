import { useEffect } from 'react'
import { useStore } from '../../store/useStore.js'
import { t } from '../../lib/i18n.js'
import { lastBW } from '../../lib/history.js'
import { fmtNum, fmtDate, todayISO } from '../../lib/format.js'
import { bwSheet } from '../../sheets.jsx'
import { calcBMR, calcTDEE, ACTIVITY_LEVELS, ACTIVITY_LABEL, ACTIVITY_DESC } from '../../lib/nutrition.js'
import { GOALS, GOAL_LABEL, GOAL_DESC, GOAL_DEFAULT_DELTA, DELTA_MIN, DELTA_MAX, calcTargetKcal, isAggressiveDelta, presetsFor } from '../../lib/goals.js'
import { calcMacros, MACRO_SOURCE } from '../../lib/macros.js'
import { EU_ALLERGENS, DIET_TYPES } from './dietConsts.js'
import Icon from '../../components/Icon.jsx'
import { Section, Row, SelectRow, Segmented, NumberField, Stepper, Check, Button } from '../../components/ui.jsx'
import { useUI } from '../../store/useUI.js'
import NutriPlan from './NutriPlan.jsx'

/* ── Helper: convert macro grams → percentages ── */
function toMacroPct(macros, target) {
  if (!macros || !target) return null
  const protPct  = Math.round(macros.protG  * 4 / target * 100)
  const fatPct   = Math.round(macros.fatG   * 9 / target * 100)
  const carbsPct = 100 - protPct - fatPct
  return { prot: protPct, fat: fatPct, carbs: Math.max(0, carbsPct) }
}

/* ── MacroSliders ─────────────────────────────────────────────────── */
function MacroSliders({ target, weightKg, macros, macroPct, onSave, onReset }) {
  if (!target) return null

  // Use stored override pct, or derive from current macros
  const autoPct = toMacroPct(macros, target) || { prot: 30, carbs: 45, fat: 25 }
  const protPct  = macroPct?.prot  ?? autoPct.prot
  const fatPct   = macroPct?.fat   ?? autoPct.fat
  const carbsPct = Math.max(0, 100 - protPct - fatPct)

  const protG  = Math.round(target * protPct  / 100 / 4)
  const carbsG = Math.round(target * carbsPct / 100 / 4)
  const fatG   = Math.round(target * fatPct   / 100 / 9)
  const fiberG = macros?.fiberG || 25

  // ANSES minimums (FR recommendations)
  const minProtG  = weightKg ? Math.max(Math.round(0.83 * weightKg), Math.round(target * 0.10 / 4)) : Math.round(target * 0.10 / 4)
  const minFatG   = Math.round(target * 0.20 / 9)
  const minCarbsG = Math.round(target * 0.15 / 4)

  const warnProt  = protG  < minProtG
  const warnFat   = fatG   < minFatG
  const warnCarbs = carbsG < minCarbsG

  const handleProtPct = v => {
    const pp = Math.min(Math.max(v, 10), 70)
    const fp = Math.min(fatPct, 100 - pp - 10)
    onSave({ prot: pp, fat: fp })
  }
  const handleFatPct = v => {
    const fp = Math.min(Math.max(v, 10), 60)
    const pp = Math.min(protPct, 100 - fp - 10)
    onSave({ prot: pp, fat: fp })
  }

  return (
    <Section title={t('Macro targets')}
      footer={t('Based on {0}. Individual needs may vary — consult a dietitian for personalised advice.', MACRO_SOURCE)}
    >
      {/* Animated proportion bar */}
      <div style={{ margin: '4px 16px 14px', height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex', gap: 2 }}>
        <div style={{ flex: protPct,  background: 'var(--nut-prot)',  transition: 'flex .25s', borderRadius: '6px 0 0 6px' }} />
        <div style={{ flex: carbsPct, background: 'var(--nut-carbs)', transition: 'flex .25s' }} />
        <div style={{ flex: fatPct,   background: 'var(--nut-fat)',   transition: 'flex .25s', borderRadius: '0 6px 6px 0' }} />
      </div>

      {/* Protein slider */}
      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--nut-prot)' }}>{t('Protein')} — {protPct}%</span>
          <span style={{ fontSize: 13, color: warnProt ? 'var(--red)' : 'var(--label-3)' }}>
            {warnProt ? `⚠ ${protG}g (min ${minProtG}g)` : `${protG}g / day`}
          </span>
        </div>
        <input type="range" min="10" max="70" step="1" value={protPct}
          onChange={e => handleProtPct(+e.target.value)}
          style={{ width: '100%', accentColor: 'var(--nut-prot)', cursor: 'pointer' }}
        />
      </div>

      {/* Fat slider */}
      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--nut-fat)' }}>{t('Fat')} — {fatPct}%</span>
          <span style={{ fontSize: 13, color: warnFat ? 'var(--red)' : 'var(--label-3)' }}>
            {warnFat ? `⚠ ${fatG}g (min ${minFatG}g)` : `${fatG}g / day`}
          </span>
        </div>
        <input type="range" min="10" max="60" step="1" value={fatPct}
          onChange={e => handleFatPct(+e.target.value)}
          style={{ width: '100%', accentColor: 'var(--nut-fat)', cursor: 'pointer' }}
        />
      </div>

      {/* Carbs + fiber (read-only, derived) */}
      <Row icon="bolt" iconTint="var(--nut-carbs)" title={t('Carbohydrates')}
        subtitle={warnCarbs ? `⚠ ${t('Below recommended minimum')}` : carbsPct + '%'}
        value={(warnCarbs ? '⚠ ' : '') + carbsG + ' g / day'}
      />
      <Row icon="bolt" iconTint="var(--nut-fiber)" title={t('Fiber')} value={fiberG + ' g / day'} />

      {/* Reset chip */}
      {macroPct && (
        <div style={{ padding: '4px 16px 8px' }}>
          <button className="chip" onClick={onReset}>{t('Reset to auto')}</button>
        </div>
      )}
    </Section>
  )
}

/* ── TDEE Breakdown ─────────────────────────────────────────────── */
function TDEEBreakdown({ bmr, tdee, target, goalDelta, activityLevel }) {
  if (!bmr || !tdee) return null
  const actMult  = tdee && bmr ? (tdee / bmr).toFixed(2) : null
  const actKcal  = tdee - bmr
  const isDeficit = (goalDelta || 0) < 0
  const isSurplus = (goalDelta || 0) > 0

  const steps = [
    { label: t('Basal Metabolic Rate (BMR)'), value: fmtNum(bmr) + ' kcal', icon: 'heart', tint: 'var(--red)',
      note: t('Calories burned at complete rest (Mifflin–St Jeor)') },
    { label: `× ${actMult} (${t(ACTIVITY_LABEL[activityLevel] || activityLevel)})`, value: '+' + fmtNum(actKcal) + ' kcal', icon: 'flame', tint: 'var(--orange)',
      note: t('Activity multiplier for your daily life outside workouts') },
    { label: t('Total Daily Energy (TDEE)'), value: fmtNum(tdee) + ' kcal', icon: 'bolt', tint: 'var(--yellow)', bold: true },
    goalDelta && goalDelta !== 0 && {
      label: isDeficit ? t('Deficit') : t('Surplus'), icon: isDeficit ? 'arrowDown' : 'arrowUp',
      value: (goalDelta > 0 ? '+' : '') + fmtNum(goalDelta) + ' kcal', tint: isDeficit ? 'var(--blue)' : 'var(--green)',
      note: isDeficit ? t('Calorie reduction to lose body fat') : t('Calorie increase to gain muscle'),
    },
    target && { label: t('Daily calorie target'), value: fmtNum(target) + ' kcal', icon: 'star', tint: 'var(--acc)', bold: true },
  ].filter(Boolean)

  return (
    <div className="card" style={{ margin: '8px 16px 4px', padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--label-3)', marginBottom: 12 }}>
        {t('How calories are calculated')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((s, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: s.tint + '1A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={s.icon} style={{ fontSize: 13, color: s.tint }} />
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: s.bold ? 700 : 400 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: s.bold ? 700 : 600, color: s.tint }}>{s.value}</div>
            </div>
            {s.note && <div style={{ fontSize: 11, color: 'var(--label-4)', marginTop: 3, marginLeft: 36 }}>{s.note}</div>}
            {i < steps.length - 1 && (
              <div style={{ marginLeft: 14, marginTop: 4, borderLeft: '2px dashed var(--sep)', height: 6 }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10, fontSize: 12, color: 'var(--label-3)', lineHeight: 1.5 }}>
        <Icon name="figureRun" style={{ fontSize: 13, marginRight: 5, color: 'var(--orange)' }} />
        {t('Cardio does not increase your food target')} — {t('it deepens your caloric deficit in the Balance tab.')}
      </div>
    </div>
  )
}

export default function Profile() {
  const S      = useStore(s => s.S)
  const { update } = useStore()
  const toast  = useUI(s => s.toast)

  const n      = S.nutrition || {}
  const bw     = lastBW(S)
  const toKg   = w => S.unit === 'lb' ? w / 2.2046 : w
  const weightKg = bw ? toKg(bw.w) : null
  const bmr    = calcBMR(n.sex, weightKg, n.heightCm, n.age)
  const tdee   = calcTDEE(bmr, n.activityLevel, n.workoutsPerWeek)
  const target = calcTargetKcal(tdee, n.goalDelta)
  const macros = calcMacros(target, weightKg, n.goal, n.workoutsPerWeek)

  const KCAL_PER_KG = 7700
  const _DAY_MS = 86_400_000
  const isWeightGoal = n.goal === 'cut' || n.goal === 'bulk'
  const kgToGoal = isWeightGoal && S.targetW != null && weightKg != null
    ? Math.abs(weightKg - S.targetW)
    : null

  // ── P1: tendance poids observée (régression linéaire, 90j, min 3 pesées) ──
  let weeklyRateKg = null
  if (kgToGoal != null) {
    const bwRecent = [...S.bodyweight]
      .map(e => ({ t: e.t || new Date(e.d).getTime(), y: e.w }))
      .filter(e => e.t > Date.now() - 90 * _DAY_MS)
      .sort((a, b) => a.t - b.t)
    if (bwRecent.length >= 3) {
      const t0 = bwRecent[0].t
      const xs = bwRecent.map(p => (p.t - t0) / _DAY_MS)
      const ys = bwRecent.map(p => p.y)
      const mx = xs.reduce((s, x) => s + x, 0) / xs.length
      const my = ys.reduce((s, y) => s + y, 0) / ys.length
      const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
      const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
      if (den > 0) weeklyRateKg = +((num / den) * 7).toFixed(3)
    }
  }
  const trendValid = weeklyRateKg !== null && kgToGoal != null && kgToGoal > 0.05 && (
    (n.goal === 'cut' && weeklyRateKg < -0.01) ||
    (n.goal === 'bulk' && weeklyRateKg > 0.01)
  )
  const daysFromTrend = trendValid
    ? Math.round(kgToGoal / Math.abs(weeklyRateKg) * 7)
    : null

  // ── P2: déficit calorique réel (logs vs TDEE, 30j, min 5 jours loggés) ──
  let daysFromRealKcal = null
  let realDailyDeficit = null
  let loggedDaysCount = 0
  if (kgToGoal != null && kgToGoal > 0.05 && n.tdee) {
    const log = S.nutritionLog || {}
    const loggedKcals = []
    for (let i = 1; i <= 30; i++) {
      const d = new Date(Date.now() - i * _DAY_MS)
      const iso = d.toISOString().slice(0, 10)
      let kcal = 0
      ;(log[iso]?.meals || []).forEach(m => m.items.forEach(item => { kcal += item.kcal || 0 }))
      if (kcal > 0) loggedKcals.push(kcal)
    }
    loggedDaysCount = loggedKcals.length
    if (loggedDaysCount >= 5) {
      const avgKcal = loggedKcals.reduce((s, k) => s + k, 0) / loggedDaysCount
      realDailyDeficit = Math.round(n.tdee - avgKcal)
      const realValid = (n.goal === 'cut' && realDailyDeficit > 50) ||
                        (n.goal === 'bulk' && realDailyDeficit < -50)
      if (realValid) daysFromRealKcal = Math.round(kgToGoal * KCAL_PER_KG / Math.abs(realDailyDeficit))
    }
  }

  // ── P3: théorique (goalDelta) ──
  const daysFromTheory = kgToGoal != null && kgToGoal > 0.05 && n.goalDelta && Math.abs(n.goalDelta) > 50
    ? Math.round(kgToGoal * KCAL_PER_KG / Math.abs(n.goalDelta))
    : null

  const daysToGoal = daysFromTrend ?? daysFromRealKcal ?? daysFromTheory
  const projSource = daysFromTrend !== null ? 'trend' : daysFromRealKcal !== null ? 'real' : 'theory'
  const goalDateStr = daysToGoal
    ? new Date(Date.now() + daysToGoal * _DAY_MS)
        .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const setTargetW = v => update(s => { s.targetW = (v != null && v > 0) ? v : null })

  const setN = patch => update(s => {
    const prev = s.nutrition || {}
    s.nutrition = { ...prev, ...patch }

    // Recompute derived fields
    const wKg = bw ? toKg(bw.w) : null
    const newBmr    = calcBMR(s.nutrition.sex, wKg, s.nutrition.heightCm, s.nutrition.age)
    const newTdee   = calcTDEE(newBmr, s.nutrition.activityLevel, s.nutrition.workoutsPerWeek)
    const newTarget = calcTargetKcal(newTdee, s.nutrition.goalDelta)
    s.nutrition.bmr       = newBmr
    s.nutrition.tdee      = newTdee
    s.nutrition.targetKcal = newTarget

    // If user has set custom macro percentages, apply them to the new target;
    // otherwise fall back to auto-calculated macros.
    const pct = s.nutrition.macroPct
    if (pct && newTarget) {
      const carbsPct = Math.max(0, 100 - pct.prot - pct.fat)
      const autoMacros = calcMacros(newTarget, wKg, s.nutrition.goal, s.nutrition.workoutsPerWeek)
      s.nutrition.macros = {
        protG:  Math.round(newTarget * pct.prot  / 100 / 4),
        carbsG: Math.round(newTarget * carbsPct  / 100 / 4),
        fatG:   Math.round(newTarget * pct.fat   / 100 / 9),
        fiberG: autoMacros?.fiberG || 25,
      }
    } else {
      s.nutrition.macros = calcMacros(newTarget, wKg, s.nutrition.goal, s.nutrition.workoutsPerWeek)
    }

    // Snapshot history when bmr or tdee changes
    if (newBmr && (newBmr !== prev.bmr || newTdee !== prev.tdee)) {
      const today = todayISO()
      const hist  = (prev.history || []).filter(h => h.date !== today)
      s.nutrition.history = [
        ...hist,
        { date: today, bmr: newBmr, tdee: newTdee, weightKg: wKg },
      ].slice(-90)
    }
  })

  // Recalculate stored calories whenever body weight changes
  useEffect(() => {
    if (bw) setN({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bw?.w, bw?.d])

  const setGoal = goal => {
    setN({ goal, goalDelta: GOAL_DEFAULT_DELTA[goal] })
  }

  const setDiet = patch => update(s => {
    s.nutrition = { ...(s.nutrition || {}), diet: { ...(s.nutrition?.diet || {}), ...patch } }
  })

  const toggleAllergen = a => {
    const curr = n.diet?.allergens || []
    setDiet({ allergens: curr.includes(a) ? curr.filter(x => x !== a) : [...curr, a] })
  }

  const activityOptions = ACTIVITY_LEVELS.map(k => ({
    value: k, label: t(ACTIVITY_LABEL[k]), subtitle: t(ACTIVITY_DESC[k]),
  }))

  const goalOptions = GOALS.map(k => ({
    value: k, label: t(GOAL_LABEL[k]), subtitle: t(GOAL_DESC[k]),
  }))

  const dietOptions = DIET_TYPES.map(d => ({ value: d.value, label: t(d.label) }))

  const hist = (n.history || []).slice(-5).reverse()

  return (
    <div>
      {/* ── Profile ── */}
      <Section
        title={t('Your profile')}
        footer={!bw ? t('Body weight is required for BMR/TDEE calculation — tap the weight row to log it.') : undefined}
      >
        {/* Body weight — fetched from workout tracker, editable inline */}
        <Row
          icon="scale"
          iconTint="var(--blue)"
          title={t('Body weight')}
          subtitle={bw ? fmtDate(bw.d, true) : t('Tap to log — required for BMR')}
          value={bw ? fmtNum(bw.w) + ' ' + S.unit : '—'}
          accessory="chevron"
          onClick={() => bwSheet()}
        />
        <Row icon="person" iconTint="var(--blue)" title={t('Sex')}>
          <Segmented
            className="seg-inline"
            options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]}
            value={n.sex || 'male'}
            onChange={v => setN({ sex: v })}
          />
        </Row>
        <Row icon="calendar" iconTint="var(--orange)" title={t('Age')} subtitle={t('years')}>
          <NumberField value={n.age ?? null} decimal={false} nullable onChange={v => setN({ age: v })} style={{ width: 68, textAlign: 'right' }} placeholder="—" />
        </Row>
        <Row icon="arrowUp" iconTint="var(--teal)" title={t('Height')} subtitle="cm">
          <NumberField value={n.heightCm ?? null} decimal={false} nullable onChange={v => setN({ heightCm: v })} style={{ width: 68, textAlign: 'right' }} placeholder="—" />
        </Row>
      </Section>

      {/* ── Activity ── */}
      <Section
        title={t('Activity')}
        footer={t('Choose the level that matches your daily life outside gym sessions. Workouts are added separately.')}
      >
        <SelectRow icon="flame" iconTint="var(--orange)" title={t('Activity level')} value={n.activityLevel || 'sedentary'} onChange={v => setN({ activityLevel: v })} options={activityOptions} />
        <Row icon="dumbbell" iconTint="var(--acc)" title={t('Workouts per week')}>
          <Stepper value={n.workoutsPerWeek || 0} step={1} decimal={false} onChange={v => setN({ workoutsPerWeek: Math.min(14, v) })} />
        </Row>
      </Section>

      {/* ── Estimated needs ── */}
      {bmr != null ? (
        <>
          <Section title={t('Estimated needs')}>
            <Row icon="flame" iconTint="var(--red)" title={t('Basal metabolic rate')} subtitle={t('Calories at complete rest')} value={fmtNum(bmr) + ' kcal'} />
            <Row icon="bolt" iconTint="var(--yellow)" title={t('Daily energy expenditure')} subtitle={t('TDEE — total daily calories')} value={fmtNum(tdee) + ' kcal'} />
          </Section>
          <TDEEBreakdown bmr={bmr} tdee={tdee} target={target} goalDelta={n.goalDelta} activityLevel={n.activityLevel} />
        </>
      ) : (
        <p className="sect-f" style={{ marginTop: 8 }}>{t('Complete the profile above to see your calorie needs.')}</p>
      )}

      {/* ── Goal ── */}
      {(() => {
        const presets = presetsFor(n.goal)
        const activePreset = presets?.find(p => p.delta === n.goalDelta)
        return (
          <Section
            title={t('Goal')}
            footer={isAggressiveDelta(tdee, n.goalDelta) ? t('⚠️ Deficit exceeds 20% of TDEE. ANSES recommends a maximum of 500 kcal/day deficit to preserve muscle.') : undefined}
          >
            <SelectRow icon="target" iconTint="var(--acc)" title={t('Objective')} value={n.goal || 'maintain'} onChange={setGoal} options={goalOptions} />

            {/* Intensity presets for cut / bulk */}
            {presets && tdee != null && (
              <div style={{ padding: '10px 16px 4px' }}>
                <div className="small dim" style={{ marginBottom: 8 }}>{t('Intensity')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {presets.map(p => (
                    <button
                      key={p.id}
                      className={'chip' + (activePreset?.id === p.id ? ' on' : '')}
                      onClick={() => setN({ goalDelta: p.delta })}
                      title={t(p.desc)}
                    >
                      {t(p.label)}
                      <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 11 }}>
                        {p.delta > 0 ? '+' : ''}{p.delta} kcal
                      </span>
                    </button>
                  ))}
                </div>
                {activePreset && (
                  <p className="small dim" style={{ marginTop: 6, lineHeight: 1.4 }}>{t(activePreset.desc)}</p>
                )}
              </div>
            )}

            {/* Fine-tune with stepper */}
            {tdee != null && (
              <Row icon="bolt" iconTint="var(--blue)" title={t('Calorie adjustment')} subtitle={t('Fine-tune offset from TDEE (kcal/day)')}>
                <Stepper
                  value={n.goalDelta || 0}
                  step={50}
                  decimal={false}
                  onChange={v => setN({ goalDelta: Math.max(DELTA_MIN, Math.min(DELTA_MAX, v)) })}
                />
              </Row>
            )}
            {target != null && (
              <Row icon="star" iconTint="var(--yellow)" title={t('Daily calorie target')} value={fmtNum(target) + ' kcal'} />
            )}

            {/* ── Target weight + fat-loss projection (cut / bulk only) ── */}
            {isWeightGoal && weightKg != null && (
              <Row icon="target" iconTint="var(--teal)" title={t('Target weight')} subtitle={S.unit}>
                <NumberField
                  value={S.targetW ?? null}
                  decimal
                  nullable
                  onChange={setTargetW}
                  style={{ width: 68, textAlign: 'right' }}
                  placeholder="—"
                />
              </Row>
            )}

            {daysToGoal != null && (
              <div style={{ margin: '4px 16px 8px', padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 12 }}>
                {/* Source badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
                    padding: '2px 7px', borderRadius: 20,
                    background: projSource === 'trend' ? 'color-mix(in srgb,var(--teal) 18%,transparent)' : projSource === 'real' ? 'color-mix(in srgb,var(--blue) 18%,transparent)' : 'color-mix(in srgb,var(--label-3) 18%,transparent)',
                    color: projSource === 'trend' ? 'var(--teal)' : projSource === 'real' ? 'var(--blue)' : 'var(--label-3)',
                  }}>
                    {projSource === 'trend' ? t('Observed trend') : projSource === 'real' ? t('Real calories') : t('Theoretical')}
                  </span>
                </div>
                {/* Main estimate */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <Icon name="calendar" style={{ fontSize: 14, color: 'var(--teal)', flexShrink: 0, alignSelf: 'center' }} />
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--label)' }}>~{Math.min(daysToGoal, 999)}</span>
                  <span style={{ fontSize: 13, color: 'var(--label-2)' }}>{t('days')}</span>
                  {goalDateStr && <span style={{ fontSize: 12, color: 'var(--label-3)', marginLeft: 2 }}>· {goalDateStr}</span>}
                </div>
                {/* Source detail */}
                <div style={{ fontSize: 11, color: 'var(--label-3)', lineHeight: 1.6 }}>
                  {projSource === 'trend' && weeklyRateKg !== null && (
                    <>{fmtNum(Math.abs(weeklyRateKg))} {S.unit}/{t('week')} {n.goal === 'cut' ? t('lost') : t('gained')} · {S.bodyweight.filter(e => (e.t || new Date(e.d).getTime()) > Date.now() - 90 * _DAY_MS).length} {t('weigh-ins')}</>
                  )}
                  {projSource === 'real' && realDailyDeficit !== null && (
                    <>{Math.abs(realDailyDeficit)} kcal/j {n.goal === 'cut' ? t('deficit') : t('surplus')} {t('real')} · {loggedDaysCount} {t('days logged')}</>
                  )}
                  {projSource === 'theory' && (
                    <>{fmtNum(kgToGoal)} {S.unit} × {KCAL_PER_KG} kcal/kg ÷ {Math.abs(Math.round(n.goalDelta))} kcal/j</>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--label-4)', marginTop: 5, lineHeight: 1.4 }}>
                  {t('Estimate based on fat mass (7 700 kcal/kg). Actual scale weight varies with water and muscle.')}
                </div>
              </div>
            )}
          </Section>
        )
      })()}

      {/* ── Dietary preferences ── */}
      <Section title={t('Dietary preferences')}>
        <SelectRow icon="list" iconTint="var(--teal)" title={t('Diet type')} value={n.diet?.type || 'omnivore'} onChange={v => setDiet({ type: v })} options={dietOptions} />
        <Row icon="calendar" iconTint="var(--indigo)" title={t('Meals per day')}>
          <Stepper value={n.diet?.mealsPerDay || 3} step={1} decimal={false} onChange={v => setDiet({ mealsPerDay: Math.max(1, Math.min(6, v)) })} />
        </Row>
        <Row icon="plus" iconTint="var(--purple)" title={t('Snacks per day')}>
          <Stepper value={n.diet?.snacksPerDay ?? 1} step={1} decimal={false} onChange={v => setDiet({ snacksPerDay: Math.max(0, Math.min(4, v)) })} />
        </Row>
      </Section>

      {/* ── Allergens ── */}
      <Section title={t('Allergens to exclude')} footer={t('EU standard 14 major allergens.')}>
        <div style={{ padding: '8px 16px 4px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EU_ALLERGENS.map(a => {
            const on = (n.diet?.allergens || []).includes(a.value)
            return (
              <button
                key={a.value}
                className={'chip' + (on ? ' on' : '')}
                onClick={() => toggleAllergen(a.value)}
                aria-pressed={on}
              >
                {t(a.label)}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Macro targets (interactive sliders) ── */}
      {target && (
        <MacroSliders
          target={target}
          weightKg={weightKg}
          macros={macros}
          macroPct={n.macroPct}
          onSave={pct => setN({ macroPct: pct })}
          onReset={() => setN({ macroPct: null })}
        />
      )}

      {/* ── Nutrition plan ── */}
      {n.goal && (
        <NutriPlan
          goal={n.goal}
          macros={macros}
          target={target}
          workoutsPerWeek={n.workoutsPerWeek}
        />
      )}

      {/* ── History ── */}
      {hist.length > 0 && (
        <Section title={t('TDEE history')}>
          {hist.map(h => (
            <Row key={h.date} icon="history" iconTint="var(--label-3)"
              title={fmtDate(h.date, true)}
              subtitle={'BMR ' + h.bmr + ' · TDEE ' + h.tdee + ' kcal'}
            />
          ))}
        </Section>
      )}
    </div>
  )
}
