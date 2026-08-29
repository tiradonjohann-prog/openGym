import { useStore } from '../../store/useStore.js'
import { t } from '../../lib/i18n.js'
import { todayISO, fmtDate, fmtNum } from '../../lib/format.js'
import { weekAverages, dayTotals } from '../../lib/foodSearch.js'
import NutriBar from '../../components/NutriBar.jsx'

function last7Dates(today) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
}

export default function WeekView() {
  const S    = useStore(s => s.S)
  const log  = S.nutritionLog || {}
  const n    = S.nutrition    || {}
  const today = todayISO()
  const avg  = weekAverages(log, today)
  const macros = n.macros
  const target = n.targetKcal

  const dates = last7Dates(today)

  // Sparkline data: kcal per day over the last 7 days
  const sparks = dates.map(d => dayTotals(log, d).kcal)
  const maxSpark = Math.max(...sparks, target || 0, 1)

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* ── Header note ── */}
      <p className="sect-f" style={{ marginTop: 12, marginBottom: 4 }}>
        {t('Weekly averages smooth out day-to-day variation — a more realistic way to track progress than a single daily target.')}
      </p>

      {/* ── Calorie sparkline ── */}
      <div className="card" style={{ margin: '12px 16px', padding: '14px 14px 10px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--label-3)', marginBottom: 10 }}>
          {t('Calories / day — last 7 days')}
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52 }}>
          {dates.map((d, i) => {
            const kcal = sparks[i]
            const h = kcal > 0 ? Math.max(4, Math.round((kcal / maxSpark) * 52)) : 2
            const isToday = d === today
            const onTarget = target && kcal >= target * 0.85 && kcal <= target * 1.1
            const color = kcal === 0 ? 'var(--surface-3)'
              : onTarget ? 'var(--green)'
              : (target && kcal > target * 1.1) ? 'var(--orange)'
              : 'var(--nut-kcal)'
            return (
              <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div className="ws-bar" style={{ height: h, width: '100%', background: color, opacity: isToday ? 1 : 0.7, borderRadius: '3px 3px 0 0' }} />
                <span style={{ fontSize: 10, color: 'var(--label-4)' }}>
                  {new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
                </span>
              </div>
            )
          })}
        </div>
        {target && (
          <p style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 6, textAlign: 'right' }}>
            {t('Target: {0} kcal/day', fmtNum(target))}
          </p>
        )}
      </div>

      {/* ── Weekly averages ── */}
      {avg ? (
        <div style={{ padding: '0 16px 8px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--label-3)', margin: '16px 0 10px' }}>
            {t('{0}-day average', avg.days)}
          </p>

          {/* Calorie average vs target */}
          <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 17 }}>{fmtNum(avg.kcal)}<span style={{ fontWeight: 400, fontSize: 14, color: 'var(--label-2)' }}> kcal</span></span>
              {target && (
                <span style={{ fontSize: 14, color: 'var(--label-2)' }}>
                  {avg.kcal <= target ? '−' : '+'}{Math.abs(avg.kcal - target)} vs {t('target')}
                </span>
              )}
            </div>
            <span style={{ fontSize: 13, color: 'var(--label-3)' }}>{t('Average daily calories')}</span>
          </div>

          {/* Macro average bars */}
          {macros?.protG && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <NutriBar label={t('Protein')}       value={avg.prot}  max={macros.protG}  color="var(--nut-prot)"  unit="g" important />
              <NutriBar label={t('Carbohydrates')} value={avg.carbs} max={macros.carbsG} color="var(--nut-carbs)" unit="g" />
              <NutriBar label={t('Fat')}           value={avg.fat}   max={macros.fatG}   color="var(--nut-fat)"   unit="g" />
              <NutriBar label={t('Fiber')}         value={avg.fiber} max={macros.fiberG || 25} color="var(--nut-fiber)" unit="g" />
            </div>
          )}
        </div>
      ) : (
        <p className="sect-f" style={{ marginTop: 16, textAlign: 'center' }}>
          {t('Log meals for at least one day to see weekly averages.')}
        </p>
      )}

      {/* ── Day-by-day breakdown ── */}
      {avg && (
        <section className="sect" style={{ marginTop: 16 }}>
          <h2 className="sect-t">{t('Daily breakdown')}</h2>
          <div className="sect-b">
            {dates.slice().reverse().map(d => {
              const tot = dayTotals(log, d)
              if (tot.kcal === 0) return null
              return (
                <div key={d} className="lrow">
                  <span className="lrow-m">
                    <span className="lrow-t">{fmtDate(d, true)}</span>
                    <span className="lrow-s">
                      {tot.prot > 0 ? tot.prot + 'g P · ' : ''}
                      {tot.carbs > 0 ? tot.carbs + 'g C · ' : ''}
                      {tot.fat > 0 ? tot.fat + 'g F' : ''}
                    </span>
                  </span>
                  <span className="lrow-v">{fmtNum(tot.kcal)} kcal</span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
