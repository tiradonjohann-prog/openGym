import { useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { t } from '../../lib/i18n.js'
import { todayISO, isoOf, fmtDate, fmtNum } from '../../lib/format.js'
import { weekAverages, dayTotals } from '../../lib/foodSearch.js'
import NutriBar from '../../components/NutriBar.jsx'
import Icon from '../../components/Icon.jsx'

function last7Dates(anchor) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor + 'T12:00:00')
    d.setDate(d.getDate() - (6 - i))
    return isoOf(d)
  })
}

const shiftDate = (iso, days) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return isoOf(d)
}

export default function WeekView() {
  const S    = useStore(s => s.S)
  const log  = S.nutritionLog || {}
  const n    = S.nutrition    || {}
  const today = todayISO()

  const [anchor, setAnchor] = useState(today)
  const isCurrentWeek = anchor === today

  const avg  = weekAverages(log, anchor)
  const macros = n.macros
  const target = n.targetKcal

  const dates = last7Dates(anchor)

  // Sparkline data
  const sparks = dates.map(d => dayTotals(log, d).kcal)
  const maxSpark = Math.max(...sparks, target || 0, 1)

  // Compliance metrics
  const trackedDays  = sparks.filter(k => k > 0).length
  const onTargetDays = target
    ? sparks.filter(k => k > 0 && k >= target * 0.85 && k <= target * 1.1).length
    : 0
  const compliancePct = trackedDays > 0 && target ? Math.round(onTargetDays / trackedDays * 100) : null

  // Nutrition streak: consecutive days from today (not the anchor)
  const todayDates = last7Dates(today)
  const todaySparks = todayDates.map(d => dayTotals(log, d).kcal)
  let streak = 0
  for (let i = todaySparks.length - 1; i >= 0; i--) {
    if (todaySparks[i] > 0) streak++
    else break
  }

  const weekStart = dates[0]
  const weekEnd   = dates[6]

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* ── Week navigation ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 6px', gap: 8,
      }}>
        <button
          className="iconbtn"
          style={{ width: 36, height: 36, background: 'var(--surface-2)', borderRadius: 10 }}
          onClick={() => setAnchor(d => shiftDate(d, -7))}
          aria-label={t('Previous week')}
        >
          <Icon name="chevronLeft" />
        </button>
        <button
          style={{
            flex: 1, background: 'var(--surface-2)', border: 'none', borderRadius: 10,
            padding: '7px 12px', cursor: isCurrentWeek ? 'default' : 'pointer', textAlign: 'center',
          }}
          onClick={() => { if (!isCurrentWeek) setAnchor(today) }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)', lineHeight: 1.2 }}>
            {isCurrentWeek ? t('This week') : fmtDate(weekStart) + ' – ' + fmtDate(weekEnd)}
          </div>
          {!isCurrentWeek && (
            <div style={{ fontSize: 11, color: 'var(--acc)', marginTop: 1 }}>{t('Tap to return to today')}</div>
          )}
        </button>
        <button
          className="iconbtn"
          style={{
            width: 36, height: 36, background: 'var(--surface-2)', borderRadius: 10,
            opacity: isCurrentWeek ? 0.3 : 1,
          }}
          onClick={() => { if (!isCurrentWeek) setAnchor(d => shiftDate(d, 7)) }}
          disabled={isCurrentWeek}
          aria-label={t('Next week')}
        >
          <Icon name="chevronRight" />
        </button>
      </div>

      {/* ── Compliance stats row ── */}
      {trackedDays > 0 && (() => {
        const logColor = 'var(--nut-carbs)'
        const streakColor = streak > 0 ? 'var(--orange)' : 'var(--label-3)'
        const compColor = compliancePct === null ? 'var(--label-3)'
          : compliancePct >= 80 ? 'var(--green)'
          : compliancePct >= 50 ? 'var(--yellow)'
          : 'var(--label-2)'
        const statCard = (color, value, label) => (
          <div style={{
            flex: 1, padding: '12px 10px 10px', borderRadius: 14, textAlign: 'center',
            background: `linear-gradient(135deg,color-mix(in srgb,${color} 15%,var(--surface)),color-mix(in srgb,${color} 5%,var(--surface)))`,
            border: `1px solid color-mix(in srgb,${color} 22%,transparent)`,
          }}>
            <div style={{ fontWeight: 700, fontSize: 22, lineHeight: 1, color, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--label-3)', marginTop: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
          </div>
        )
        return (
          <div style={{ display: 'flex', gap: 8, padding: '8px 16px 4px' }}>
            {statCard(logColor, <>{trackedDays}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--label-3)' }}>/7</span></>, t('Days logged'))}
            {statCard(streakColor, streak, t('Streak'))}
            {statCard(compColor, compliancePct === null ? '—' : compliancePct + '%', t('On target'))}
          </div>
        )
      })()}

      {/* ── Calorie rows ── */}
      <div className="card" style={{ margin: '12px 16px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--label-3)' }}>
            {t('Calories / day')}
          </span>
          {target && (
            <span style={{ fontSize: 11, color: 'var(--label-4)' }}>
              {t('cible')}: {fmtNum(target)} kcal
            </span>
          )}
        </div>
        {dates.map((d, i) => {
          const kcal    = sparks[i]
          const isToday = d === today
          const notLogged = kcal === 0
          const over    = target && kcal > target * 1.1
          const onTgt   = target && kcal >= target * 0.85 && kcal <= target * 1.1
          const pct     = target && kcal > 0 ? Math.min(kcal / target, 1.15) : (kcal > 0 ? 0.9 : 0)
          const barColor = notLogged ? 'var(--surface-3)' : onTgt ? 'var(--green)' : over ? 'var(--orange)' : 'var(--blue)'
          const numColor = notLogged ? 'var(--label-4)' : onTgt ? 'var(--green)' : over ? 'var(--orange)' : 'var(--blue)'
          const dt = new Date(d + 'T12:00:00')
          const dayName = dt.toLocaleDateString(undefined, { weekday: 'short' })
          const dayNum  = dt.getDate()
          return (
            <div key={d} style={{ padding: '7px 14px', borderTop: '1px solid var(--sep)', display: 'flex', alignItems: 'center', gap: 10, background: isToday ? 'color-mix(in srgb, var(--acc) 5%, transparent)' : undefined }}>
              {/* Day label */}
              <div style={{ width: 48, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--acc)' : 'var(--label-2)', lineHeight: 1.1 }}>
                  {dayName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--label-4)', lineHeight: 1.1 }}>{dayNum}</div>
              </div>
              {/* Progress bar */}
              <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                {!notLogged && (
                  <div style={{
                    height: '100%', width: (pct * 100) + '%',
                    background: barColor, borderRadius: 3,
                    transition: 'width .4s var(--ease)',
                  }} />
                )}
              </div>
              {/* Kcal value */}
              <div style={{ width: 74, textAlign: 'right', fontSize: 13, fontWeight: 600, color: numColor, flexShrink: 0, lineHeight: 1.1 }}>
                {notLogged
                  ? <span style={{ fontSize: 11, fontWeight: 400 }}>{t('Not logged')}</span>
                  : <>{fmtNum(kcal)}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--label-4)' }}> kcal</span></>
                }
              </div>
              {/* Status dot */}
              {!notLogged && (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: barColor, flexShrink: 0 }} />
              )}
            </div>
          )
        })}
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
