import { t } from '../../lib/i18n.js'
import Icon from '../../components/Icon.jsx'

const EXTRA_TRAIN = 200  // extra kcal recommended on training vs rest days

const GOAL_COLOR = {
  cut:      'var(--blue)',
  bulk:     'var(--orange)',
  recomp:   'var(--purple)',
  maintain: 'var(--teal)',
}

const FALLBACK_PCT = {
  cut:      { prot: 35, carbs: 40, fat: 25 },
  bulk:     { prot: 25, carbs: 50, fat: 25 },
  recomp:   { prot: 40, carbs: 35, fat: 25 },
  maintain: { prot: 20, carbs: 50, fat: 30 },
}

const GOAL_TIPS = {
  cut: [
    { icon: 'bolt',     text: 'Prioritise protein at every meal to preserve muscle' },
    { icon: 'sparkles', text: 'Fill half your plate with vegetables and high-fibre foods' },
    { icon: 'flame',    text: 'Favour whole grains and legumes over refined carbs' },
  ],
  bulk: [
    { icon: 'bolt',     text: 'Time carbs and protein around your workouts' },
    { icon: 'flame',    text: 'Hit your calorie target every day — consistency builds mass' },
    { icon: 'moon',     text: 'Include slow-digesting protein (cottage cheese) before bed' },
  ],
  recomp: [
    { icon: 'bolt',     text: 'Protein is top priority — aim for 2 g per kg of body weight' },
    { icon: 'flame',    text: 'Cycle calories: more on training days, fewer on rest days' },
    { icon: 'sparkles', text: 'Whole foods first — minimise ultra-processed products' },
  ],
  maintain: [
    { icon: 'sparkles', text: 'Balanced plate: quality protein, slow carbs and healthy fats' },
    { icon: 'bolt',     text: 'Monitor your weight weekly and adjust portions if it drifts' },
    { icon: 'heart',    text: 'Consistency over perfection — small habits compound over time' },
  ],
}

function macroPercentages(macros, goal) {
  if (macros) {
    const protKcal  = (macros.protG  || 0) * 4
    const carbsKcal = (macros.carbsG || 0) * 4
    const fatKcal   = (macros.fatG   || 0) * 9
    const total     = protKcal + carbsKcal + fatKcal
    if (total > 0) {
      const prot  = Math.round(protKcal  / total * 100)
      const fat   = Math.round(fatKcal   / total * 100)
      const carbs = 100 - prot - fat
      return { prot, carbs, fat }
    }
  }
  return FALLBACK_PCT[goal] || FALLBACK_PCT.maintain
}

export default function NutriPlan({ goal, macros, target, workoutsPerWeek }) {
  if (!goal) return null

  const tips   = GOAL_TIPS[goal] || GOAL_TIPS.maintain
  const color  = GOAL_COLOR[goal] || 'var(--acc)'
  const pct    = macroPercentages(macros, goal)
  const trainN = Math.min(Math.max(Math.round(workoutsPerWeek) || 3, 0), 6)
  const restN  = 7 - trainN
  const hasSplit = target != null && trainN > 0 && restN > 0

  const trainTarget = hasSplit ? Math.round(target + EXTRA_TRAIN) : null
  const restTarget  = hasSplit ? Math.round(target - EXTRA_TRAIN * trainN / restN) : null

  const macroItems = [
    { label: 'Protein',        pct: pct.prot,  g: macros?.protG,  bg: 'var(--nut-prot)' },
    { label: 'Carbohydrates',  pct: pct.carbs, g: macros?.carbsG, bg: 'var(--nut-carbs)' },
    { label: 'Fat',            pct: pct.fat,   g: macros?.fatG,   bg: 'var(--nut-fat)' },
  ]

  return (
    <div className="sect" style={{ marginTop: 8 }}>
      <h2 className="sect-t">{t('Nutrition plan')}</h2>
      <div className="sect-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Macro distribution bar */}
        <div className="card" style={{ padding: 16 }}>
          <div className="small" style={{ color: 'var(--label-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
            {t('Macro distribution')}
          </div>
          <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', gap: 3, marginBottom: 14 }}>
            <div style={{ flex: pct.prot,  background: 'var(--nut-prot)',  transition: 'flex .5s ease' }} />
            <div style={{ flex: pct.carbs, background: 'var(--nut-carbs)', transition: 'flex .5s ease' }} />
            <div style={{ flex: pct.fat,   background: 'var(--nut-fat)',   transition: 'flex .5s ease' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
            {macroItems.map(m => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: m.bg, display: 'inline-block', marginBottom: 4 }} />
                <div className="small" style={{ color: 'var(--label-3)', marginBottom: 2 }}>{t(m.label)}</div>
                <div style={{ fontWeight: 700, fontSize: 20, lineHeight: 1.1 }}>{m.pct}<span style={{ fontSize: 13, fontWeight: 500 }}>%</span></div>
                {m.g != null && <div className="small" style={{ color: 'var(--label-3)', marginTop: 1 }}>{m.g} g</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Training vs rest day calorie split */}
        {hasSplit && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="card" style={{ padding: '14px 14px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Icon name="figureRun" style={{ fontSize: 13, color: 'var(--orange)', flexShrink: 0 }} />
                  <span className="small" style={{ color: 'var(--orange)', fontWeight: 600 }}>{t('Training day')}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1 }}>{trainTarget}</div>
                <div className="small" style={{ color: 'var(--label-3)', marginTop: 2 }}>kcal</div>
              </div>
              <div className="card" style={{ padding: '14px 14px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Icon name="moon" style={{ fontSize: 13, color: 'var(--blue)', flexShrink: 0 }} />
                  <span className="small" style={{ color: 'var(--blue)', fontWeight: 600 }}>{t('Rest day')}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1 }}>{restTarget}</div>
                <div className="small" style={{ color: 'var(--label-3)', marginTop: 2 }}>kcal</div>
              </div>
            </div>
            <div className="small" style={{ color: 'var(--label-3)', padding: '0 4px', marginTop: -2 }}>
              {t('{0} training days + {1} rest days/week · average {2} kcal/day', trainN, restN, target)}
            </div>
          </>
        )}

        {/* Goal-specific tips */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="small" style={{ color: 'var(--label-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
            {t('Key recommendations')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: `color-mix(in srgb,${color} 14%,var(--surface-2))`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name={tip.icon} style={{ fontSize: 15, color }} />
                </div>
                <span style={{ fontSize: 14, color: 'var(--label-2)', lineHeight: 1.5, paddingTop: 6 }}>
                  {t(tip.text)}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
