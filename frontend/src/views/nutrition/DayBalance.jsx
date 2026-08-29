import { useStore } from '../../store/useStore.js'
import { t } from '../../lib/i18n.js'
import { todayISO, fmtNum, fmtDate } from '../../lib/format.js'
import { lastBW } from '../../lib/history.js'
import { dayTotals } from '../../lib/foodSearch.js'
import { dayCardioKcal } from '../../lib/cardio.js'
import NutriBar from '../../components/NutriBar.jsx'

function last7Dates(today) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
}

export default function DayBalance() {
  const S      = useStore(s => s.S)
  const today  = todayISO()
  const log    = S.nutritionLog || {}
  const n      = S.nutrition    || {}

  const tdee   = n.tdee || 0
  const goal   = n.targetKcal
  const goalDelta = n.goalDelta || 0

  const totals      = dayTotals(log, today)
  const sportKcal   = dayCardioKcal(log, today)
  const intake      = totals.kcal
  const baseExpend  = tdee
  const totalExpend = baseExpend + sportKcal
  const deficit     = intake - totalExpend   // negative = deficit, positive = surplus

  // Colour semantic: deficit (negative) is the goal for cuts
  const deficitClass = deficit === 0 ? ''
    : deficit < 0
      ? 'bt-deficit'
      : Math.abs(deficit) < Math.abs(goalDelta) * 1.1 ? 'bt-surplus-ok'
        : Math.abs(deficit) < Math.abs(goalDelta) * 1.4 ? 'bt-surplus-warn'
          : 'bt-surplus-max'

  const deficitLabel = deficit < 0
    ? t('{0} kcal deficit', fmtNum(Math.abs(deficit)))
    : deficit > 0
      ? t('{0} kcal surplus', fmtNum(deficit))
      : t('Perfect balance')

  // Accessibility: also show icon/text, not just color
  const deficitIcon = deficit < 0 ? '↓' : deficit > 0 ? '↑' : '='

  // Weekly balance sparkline: one bar per day (deficit shown as negative, capped for display)
  const dates = last7Dates(today)
  const dailyBalances = dates.map(d => {
    const t2    = dayTotals(log, d)
    const sport = dayCardioKcal(log, d)
    if (t2.kcal === 0) return null
    return t2.kcal - (n.tdee || 0) - sport
  })
  const absMax = Math.max(...dailyBalances.filter(Boolean).map(Math.abs), 1)

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* ── Context note ── */}
      <p className="sect-f" style={{ marginTop: 12 }}>
        {t('Sport calories add to your expenditure — they widen your deficit rather than adjusting your food target.')}
      </p>

      {/* ── Big deficit number ── */}
      {tdee > 0 ? (
        <div className="balance-total">
          <div className={`bt-delta ${deficitClass}`} aria-label={deficitLabel}>
            {deficitIcon} {fmtNum(Math.abs(deficit))}
          </div>
          <div className="bt-label">{deficitLabel}</div>
        </div>
      ) : (
        <p className="sect-f" style={{ textAlign: 'center', marginTop: 20 }}>
          {t('Complete your profile to see your caloric balance.')}
        </p>
      )}

      {/* ── Three expenditure bars ── */}
      {tdee > 0 && (
        <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <NutriBar
            label={t('Base expenditure (TDEE)')}
            value={baseExpend}
            max={Math.max(baseExpend, intake, 1)}
            color="var(--blue)"
            unit="kcal"
          />
          {sportKcal > 0 && (
            <NutriBar
              label={t('Sport expenditure')}
              value={sportKcal}
              max={Math.max(baseExpend, intake, 1)}
              color="var(--orange)"
              unit="kcal"
            />
          )}
          <NutriBar
            label={t('Food intake')}
            value={intake}
            max={Math.max(totalExpend, intake, 1)}
            color="var(--green)"
            unit="kcal"
          />
        </div>
      )}

      {/* ── Summary row ── */}
      {tdee > 0 && (
        <section className="sect" style={{ marginTop: 16 }}>
          <div className="sect-b">
            <div className="lrow">
              <span className="lrow-m"><span className="lrow-t">{t('Base expenditure')}</span></span>
              <span className="lrow-v">{fmtNum(baseExpend)} kcal</span>
            </div>
            {sportKcal > 0 && (
              <div className="lrow">
                <span className="lrow-m"><span className="lrow-t">{t('Sport')}</span></span>
                <span className="lrow-v">+{fmtNum(sportKcal)} kcal</span>
              </div>
            )}
            <div className="lrow">
              <span className="lrow-m"><span className="lrow-t">{t('Total expenditure')}</span></span>
              <span className="lrow-v" style={{ fontWeight: 600 }}>{fmtNum(totalExpend)} kcal</span>
            </div>
            <div className="lrow">
              <span className="lrow-m"><span className="lrow-t">{t('Food intake')}</span></span>
              <span className="lrow-v">{fmtNum(intake)} kcal</span>
            </div>
            <div className="lrow" style={{ borderTop: 'var(--hair) solid var(--sep)' }}>
              <span className="lrow-m"><span className="lrow-t" style={{ fontWeight: 600 }}>{t('Balance')}</span></span>
              <span className={`lrow-v ${deficitClass}`} style={{ fontWeight: 600 }}>
                {deficit >= 0 ? '+' : ''}{fmtNum(deficit)} kcal
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── Weekly balance sparkline ── */}
      {dailyBalances.some(Boolean) && (
        <section className="sect" style={{ marginTop: 8 }}>
          <h2 className="sect-t">{t('7-day balance')}</h2>
          <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', gap: 4, height: 60 }}>
            {dates.map((d, i) => {
              const b = dailyBalances[i]
              if (b == null) return <div key={d} style={{ flex: 1 }} />
              const h = Math.max(4, Math.round((Math.abs(b) / absMax) * 50))
              const isDeficit = b < 0
              return (
                <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  {!isDeficit && <div style={{ flex: 1 }} />}
                  <div style={{ height: h, width: '100%', borderRadius: 3, background: isDeficit ? 'var(--blue)' : 'var(--orange)', opacity: d === today ? 1 : 0.65 }} />
                  {isDeficit && <div style={{ flex: 1 }} />}
                  <span style={{ fontSize: 10, color: 'var(--label-4)' }}>
                    {new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="sect-f">{t('Blue = deficit · Orange = surplus')}</p>
        </section>
      )}
    </div>
  )
}
