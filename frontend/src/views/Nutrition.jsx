import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { lastBW } from '../lib/history.js'
import { fmtNum } from '../lib/format.js'
import { calcBMR, calcTDEE, ACTIVITY_LEVELS, ACTIVITY_LABEL, ACTIVITY_DESC } from '../lib/nutrition.js'
import Icon from '../components/Icon.jsx'
import Stepper from '../components/Stepper.jsx'
import { Section, Row, SelectRow, Segmented, NumberField } from '../components/ui.jsx'

export default function Nutrition() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const { update } = useStore()

  const n = S.nutrition || {}
  const bw = lastBW(S)
  const weightKg = bw
    ? (S.unit === 'lb' ? bw.w / 2.2046 : bw.w)
    : null

  const bmr = calcBMR(n.sex, weightKg, n.heightCm, n.age)
  const tdee = calcTDEE(bmr, n.activityLevel, n.workoutsPerWeek)

  const set = patch => update(s => {
    s.nutrition = { ...(s.nutrition || {}), ...patch }
    const wKg = bw ? (S.unit === 'lb' ? bw.w / 2.2046 : bw.w) : null
    s.nutrition.bmr = calcBMR(s.nutrition.sex, wKg, s.nutrition.heightCm, s.nutrition.age)
    s.nutrition.tdee = calcTDEE(s.nutrition.bmr, s.nutrition.activityLevel, s.nutrition.workoutsPerWeek)
  })

  const activityOptions = ACTIVITY_LEVELS.map(k => ({
    value: k,
    label: t(ACTIVITY_LABEL[k]),
    subtitle: t(ACTIVITY_DESC[k]),
  }))

  return (
    <div className="narrow">
      <div className="hdr">
        <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}>
          <Icon name="chevronLeft" />
        </button>
        <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Nutrition')}</h1></div>
      </div>

      <Section
        title={t('Your profile')}
        footer={bw
          ? t('Weight from your last weigh-in: {0} {1}.', fmtNum(bw.w), S.unit)
          : t('Log a body weight first — it is needed for the BMR calculation.')}
      >
        <Row icon="person" iconTint="var(--blue)" title={t('Sex')}>
          <Segmented
            className="seg-inline"
            options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]}
            value={n.sex || 'male'}
            onChange={v => set({ sex: v })}
          />
        </Row>
        <Row icon="calendar" iconTint="var(--orange)" title={t('Age')} subtitle={t('years')}>
          <NumberField
            value={n.age ?? null}
            decimal={false}
            nullable
            onChange={v => set({ age: v })}
            style={{ width: 68, textAlign: 'right' }}
            placeholder="—"
          />
        </Row>
        <Row icon="arrowUp" iconTint="var(--teal)" title={t('Height')} subtitle="cm">
          <NumberField
            value={n.heightCm ?? null}
            decimal={false}
            nullable
            onChange={v => set({ heightCm: v })}
            style={{ width: 68, textAlign: 'right' }}
            placeholder="—"
          />
        </Row>
      </Section>

      <Section
        title={t('Activity')}
        footer={t('Choose the level that matches your daily life outside of gym sessions. Workouts are counted separately below.')}
      >
        <SelectRow
          icon="flame"
          iconTint="var(--orange)"
          title={t('Activity level')}
          value={n.activityLevel || 'sedentary'}
          onChange={v => set({ activityLevel: v })}
          options={activityOptions}
        />
        <Row icon="dumbbell" iconTint="var(--acc)" title={t('Workouts per week')}>
          <Stepper
            value={n.workoutsPerWeek || 0}
            step={1}
            decimal={false}
            onChange={v => set({ workoutsPerWeek: Math.min(14, v) })}
          />
        </Row>
      </Section>

      {bmr != null
        ? (
          <Section title={t('Estimated needs')}>
            <Row
              icon="flame"
              iconTint="var(--red)"
              title={t('Basal metabolic rate')}
              subtitle={t('Calories burned at complete rest')}
              value={fmtNum(bmr) + ' kcal'}
            />
            <Row
              icon="bolt"
              iconTint="var(--yellow)"
              title={t('Daily energy expenditure')}
              subtitle={t('TDEE — your total daily calories')}
              value={fmtNum(tdee) + ' kcal'}
            />
          </Section>
        )
        : (
          <p className="sect-f" style={{ marginTop: 8 }}>
            {t('Fill in your profile above to see your estimated calorie needs.')}
          </p>
        )}
    </div>
  )
}
