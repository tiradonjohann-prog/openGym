import { useStore } from '../../store/useStore.js'
import { t } from '../../lib/i18n.js'
import { lastBW } from '../../lib/history.js'
import { fmtNum, fmtDate, todayISO } from '../../lib/format.js'
import { calcBMR, calcTDEE, ACTIVITY_LEVELS, ACTIVITY_LABEL, ACTIVITY_DESC } from '../../lib/nutrition.js'
import { GOALS, GOAL_LABEL, GOAL_DESC, GOAL_DEFAULT_DELTA, DELTA_MIN, DELTA_MAX, calcTargetKcal, isAggressiveDelta } from '../../lib/goals.js'
import { calcMacros, MACRO_SOURCE } from '../../lib/macros.js'
import { EU_ALLERGENS, DIET_TYPES } from './dietConsts.js'
import Icon from '../../components/Icon.jsx'
import { Section, Row, SelectRow, Segmented, NumberField, Stepper, Check, Button } from '../../components/ui.jsx'
import { useUI } from '../../store/useUI.js'

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

  const setN = patch => update(s => {
    const prev = s.nutrition || {}
    s.nutrition = { ...prev, ...patch }

    // Recompute derived fields
    const wKg = bw ? toKg(bw.w) : null
    const newBmr  = calcBMR(s.nutrition.sex, wKg, s.nutrition.heightCm, s.nutrition.age)
    const newTdee = calcTDEE(newBmr, s.nutrition.activityLevel, s.nutrition.workoutsPerWeek)
    const newTarget = calcTargetKcal(newTdee, s.nutrition.goalDelta)
    s.nutrition.bmr       = newBmr
    s.nutrition.tdee      = newTdee
    s.nutrition.targetKcal = newTarget
    s.nutrition.macros    = calcMacros(newTarget, wKg, s.nutrition.goal, s.nutrition.workoutsPerWeek)

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
        footer={bw
          ? t('Weight from your last weigh-in: {0} {1}.', fmtNum(bw.w), S.unit)
          : t('Log a body weight in the main app — it is required for the BMR calculation.')}
      >
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
        <Section title={t('Estimated needs')}>
          <Row icon="flame" iconTint="var(--red)" title={t('Basal metabolic rate')} subtitle={t('Calories at complete rest')} value={fmtNum(bmr) + ' kcal'} />
          <Row icon="bolt" iconTint="var(--yellow)" title={t('Daily energy expenditure')} subtitle={t('TDEE — total daily calories')} value={fmtNum(tdee) + ' kcal'} />
        </Section>
      ) : (
        <p className="sect-f" style={{ marginTop: 8 }}>{t('Complete the profile above to see your calorie needs.')}</p>
      )}

      {/* ── Goal ── */}
      <Section
        title={t('Goal')}
        footer={isAggressiveDelta(tdee, n.goalDelta) ? t('⚠️ Deficit exceeds 20% of TDEE. ANSES recommends a maximum of 500 kcal/day deficit to preserve muscle.') : undefined}
      >
        <SelectRow icon="target" iconTint="var(--acc)" title={t('Objective')} value={n.goal || 'maintain'} onChange={setGoal} options={goalOptions} />
        {tdee != null && (
          <Row icon="bolt" iconTint="var(--blue)" title={t('Calorie adjustment')} subtitle={t('Offset from TDEE (kcal/day)')}>
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
      </Section>

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

      {/* ── Macro targets ── */}
      {macros && (
        <Section title={t('Macro targets')} footer={t('Based on {0}. Individual needs may vary — consult a dietitian for personalised advice.', MACRO_SOURCE)}>
          <Row icon="bolt"   iconTint="var(--blue)"   title={t('Protein')}       value={macros.protG  + ' g / day'} />
          <Row icon="bolt"   iconTint="var(--yellow)"  title={t('Carbohydrates')} value={macros.carbsG + ' g / day'} />
          <Row icon="bolt"   iconTint="var(--purple)"  title={t('Fat')}           value={macros.fatG   + ' g / day'} />
          <Row icon="bolt"   iconTint="var(--teal)"    title={t('Fiber')}         value={macros.fiberG + ' g / day'} />
        </Section>
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
