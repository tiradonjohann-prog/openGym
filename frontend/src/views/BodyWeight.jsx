import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { fmtNum, fmtDate, todayISO, uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { bwSheet, goalSheet, bwDeltaColor, measurementsSheet } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Check } from '../components/ui.jsx'
import { TutorialButton } from '../components/TutorialOverlay.jsx'
import { BODYWEIGHT_STEPS } from '../lib/tutorials.js'
import { MEASURE_FIELDS, latestMeasurements, measureSeries, MEASURE_COLORS } from '../lib/measurements.js'

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS
const PROJECTION_WEEKS = 8
const KCAL_PER_KG = 7700

function linearRegression(pts) {
  const n = pts.length
  if (n < 2) return null
  const t0 = pts[0].t
  const xs = pts.map(p => (p.t - t0) / DAY_MS)
  const ys = pts.map(p => p.y)
  const meanX = xs.reduce((s, x) => s + x, 0) / n
  const meanY = ys.reduce((s, y) => s + y, 0) / n
  const num = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0)
  const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0)
  if (den === 0) return null
  const slope = num / den
  const intercept = meanY - slope * meanX
  return { slope, intercept, t0 }
}

function movingAvg(pts, windowDays = 7) {
  return pts.map((p, i) => {
    const windowStart = p.t - windowDays * DAY_MS
    const inWindow = pts.slice(0, i + 1).filter(q => q.t >= windowStart)
    const avg = inWindow.reduce((s, q) => s + q.y, 0) / inWindow.length
    return { t: p.t, y: +avg.toFixed(3) }
  })
}

function evalReg(reg, t) {
  return reg.intercept + reg.slope * ((t - reg.t0) / DAY_MS)
}

const RANGES = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
  { label: t('All'), days: null },
]

export default function BodyWeight() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)

  const [rangeDays, setRangeDays] = useState(90)
  const [showMA, setShowMA] = useState(true)
  const [showTrend, setShowTrend] = useState(true)
  const [showProjection, setShowProjection] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [measOpen, setMeasOpen] = useState(false)

  const HISTORY_LIMIT = 5

  const sorted = useMemo(
    () => [...S.bodyweight].sort((a, b) => (a.t || new Date(a.d).getTime()) - (b.t || new Date(b.d).getTime())),
    [S.bodyweight]
  )

  const cutoff = rangeDays ? Date.now() - rangeDays * DAY_MS : 0
  const visible = sorted.filter(e => (e.t || new Date(e.d).getTime()) >= cutoff)
  const pts = visible.map(e => ({ t: e.t || new Date(e.d).getTime(), y: e.w, d: e.d }))

  const reg = useMemo(() => linearRegression(pts), [pts])
  const maPts = useMemo(() => (pts.length >= 3 ? movingAvg(pts) : []), [pts])

  const latest = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]

  const delta = latest && prev ? +(latest.w - prev.w).toFixed(2) : null

  const weeklyKgPerWeek = reg ? +(reg.slope * 7).toFixed(2) : null
  const projectedW = reg && latest
    ? +(evalReg(reg, (latest.t || new Date(latest.d).getTime()) + PROJECTION_WEEKS * WEEK_MS)).toFixed(1)
    : null

  const trendLinePts = reg && pts.length >= 2 ? [
    { t: pts[0].t, y: +evalReg(reg, pts[0].t).toFixed(2) },
    { t: pts[pts.length - 1].t, y: +evalReg(reg, pts[pts.length - 1].t).toFixed(2) },
  ] : []

  const projectionPts = reg && latest ? [
    { t: latest.t || new Date(latest.d).getTime(), y: +evalReg(reg, latest.t || new Date(latest.d).getTime()).toFixed(2) },
    { t: (latest.t || new Date(latest.d).getTime()) + PROJECTION_WEEKS * WEEK_MS, y: projectedW },
  ] : []

  // ── Days-to-goal estimation ──
  const kgToGoal = S.targetW && latest ? +(latest.w - S.targetW).toFixed(2) : null
  const goalReached = kgToGoal !== null && Math.abs(kgToGoal) < 0.2
  const trendGoingRight = kgToGoal !== null && weeklyKgPerWeek !== null && (
    (kgToGoal > 0.2 && weeklyKgPerWeek < 0) || (kgToGoal < -0.2 && weeklyKgPerWeek > 0)
  )
  const daysToGoalTrend = trendGoingRight && Math.abs(weeklyKgPerWeek) >= 0.01
    ? Math.round(Math.abs(kgToGoal) / Math.abs(weeklyKgPerWeek) * 7)
    : null
  const dailyKcalDelta = S.nutrition?.goalDelta && Math.abs(S.nutrition.goalDelta) > 50
    ? S.nutrition.goalDelta
    : (S.nutrition?.tdee && S.nutrition?.targetKcal)
      ? S.nutrition.targetKcal - S.nutrition.tdee
      : null
  const daysToGoalKcal = kgToGoal !== null && !goalReached && dailyKcalDelta && Math.abs(dailyKcalDelta) > 50
    ? Math.round(Math.abs(kgToGoal) * KCAL_PER_KG / Math.abs(dailyKcalDelta))
    : null
  const bestDays = goalReached ? 0 : (daysToGoalTrend ?? daysToGoalKcal)
  const daysEstimateSource = daysToGoalTrend !== null ? 'trend' : daysToGoalKcal !== null ? 'kcal' : null

  const extraLines = [
    showMA && maPts.length >= 2 && {
      pts: maPts, color: 'var(--teal)', thin: true, label: '7-day avg',
    },
    showTrend && trendLinePts.length === 2 && {
      pts: trendLinePts, color: 'var(--yellow)', dashed: true, thin: true, label: 'Trend',
    },
    showProjection && projectionPts.length === 2 && {
      pts: projectionPts, color: 'var(--yellow)', dashed: true, thin: true, projection: true,
    },
  ].filter(Boolean)

  const deleteEntry = id => {
    update(s => { s.bodyweight = s.bodyweight.filter(e => e.id !== id) })
  }

  return (
    <div className="narrow">
      <div className="hdr">
        <button className="iconbtn" onClick={() => nav(-1)} aria-label={t('Back')}>
          <Icon name="chevronLeft" />
        </button>
        <h1>{t('Body weight')}</h1>
        <div className="row" style={{ gap: 8 }}>
          <TutorialButton steps={BODYWEIGHT_STEPS} />
          <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>
            {S.targetW ? fmtNum(S.targetW) : t('Goal')}
          </Button>
          <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
        </div>
      </div>

      {/* ── Summary stats ── */}
      {latest && (
        <div className="tiles" data-tuto="bw-summary">
          <div className="tile colored tappable" style={{ '--card-color': 'var(--acc)' }} onClick={() => bwSheet()}>
            <div className="l">{t('Current')}</div>
            <div className="v">{fmtNum(latest.w)} <span style={{ fontSize: '0.55em', fontWeight: 400, color: 'var(--label-2)' }}>{S.unit}</span></div>
            {delta !== null && (
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: bwDeltaColor(delta, latest.w), display: 'flex', alignItems: 'center', gap: 3 }}>
                <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 10 }} />
                {fmtNum(Math.abs(delta))} {t('vs prev')}
              </div>
            )}
          </div>
          {weeklyKgPerWeek !== null ? (
            <div className="tile colored" style={{ '--card-color': weeklyKgPerWeek < 0 ? 'var(--teal)' : weeklyKgPerWeek > 0 ? 'var(--orange)' : 'var(--label-3)' }}>
              <div className="l">{t('Trend / week')}</div>
              <div className="v">{weeklyKgPerWeek > 0 ? '+' : ''}{fmtNum(weeklyKgPerWeek)} <span style={{ fontSize: '0.55em', fontWeight: 400 }}>{S.unit}</span></div>
            </div>
          ) : <div />}
          {projectedW !== null && (
            <div className="tile colored" style={{ '--card-color': S.targetW && Math.abs(projectedW - S.targetW) < 0.5 ? 'var(--teal)' : 'var(--purple)' }}>
              <div className="l">{t('In {0} weeks', PROJECTION_WEEKS)}</div>
              <div className="v">{fmtNum(projectedW)} <span style={{ fontSize: '0.55em', fontWeight: 400 }}>{S.unit}</span></div>
              {S.targetW && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--label-2)' }}>{t('Goal')} {fmtNum(S.targetW)}</div>}
            </div>
          )}
          {S.targetW && latest && (
            <div className="tile colored tappable" style={{ '--card-color': goalReached ? 'var(--teal)' : trendGoingRight ? 'var(--yellow)' : bestDays !== null ? 'var(--yellow)' : 'var(--label-3)' }} onClick={goalSheet}>
              <div className="l">{t('To goal')}</div>
              {goalReached ? (
                <div className="v" style={{ fontSize: '1rem', fontWeight: 700 }}>{t('Reached!')}</div>
              ) : bestDays !== null ? (
                <>
                  <div className="v">
                    {Math.min(bestDays, 999)}<span style={{ fontSize: '0.45em', fontWeight: 400 }}> {t('d')}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--label-2)', lineHeight: 1.3 }}>
                    ~{Math.round(Math.min(bestDays, 999) / 7)} {t('wk')}
                    {daysEstimateSource === 'kcal' && <span> · {t('kcal')}</span>}
                  </div>
                </>
              ) : (
                <>
                  <div className="v">—</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--label-2)' }}>{fmtNum(Math.abs(kgToGoal))} {S.unit} {kgToGoal > 0 ? t('to lose') : t('to gain')}</div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Days-to-goal explanation row ── */}
      {S.targetW && latest && !goalReached && bestDays !== null && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 4px', marginTop: -4, marginBottom: 8 }}>
          <Icon name="target" style={{ fontSize: 14, color: 'var(--yellow)', marginTop: 1, flexShrink: 0 }} />
          <div className="small" style={{ color: 'var(--label-3)', lineHeight: 1.45 }}>
            {daysEstimateSource === 'trend' && weeklyKgPerWeek !== null
              ? t('At {0} {1}/week → {2} kg goal in ~{3} days', (weeklyKgPerWeek > 0 ? '+' : '') + fmtNum(weeklyKgPerWeek), S.unit, fmtNum(S.targetW), Math.min(bestDays, 999))
              : daysEstimateSource === 'kcal' && dailyKcalDelta !== null
                ? S.nutrition?.workoutsPerWeek
                  ? t('{0} kcal deficit/day · {1} training + {2} rest days/week → ~{3} days to goal',
                      Math.abs(Math.round(dailyKcalDelta)),
                      S.nutrition.workoutsPerWeek,
                      7 - (S.nutrition.workoutsPerWeek || 0),
                      Math.min(bestDays, 999))
                  : t('{0} kcal/day × 7 700 kcal/kg → ~{1} days to goal', Math.abs(Math.round(dailyKcalDelta)), Math.min(bestDays, 999))
                : null}
          </div>
        </div>
      )}

      {/* ── Chart + controls ── */}
      <div className="card" data-tuto="bw-chart">
        {/* Range selector */}
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          {RANGES.map(r => (
            <button
              key={r.label}
              className={'tag' + (rangeDays === r.days ? ' acc' : '')}
              style={{ cursor: 'pointer', fontWeight: rangeDays === r.days ? 700 : 400 }}
              onClick={() => setRangeDays(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {pts.length >= 2 ? (
          <>
            <div className="chart">
              <LineChart
                points={pts}
                h={180}
                unit={S.unit}
                goal={S.targetW}
                extraLines={extraLines}
              />
            </div>

            {/* Legend toggles */}
            <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              <div className="row" style={{ gap: 6, fontSize: 13 }}>
                <Check checked={showMA} onChange={setShowMA} size={22} />
                <span style={{ width: 16, height: 2, background: 'var(--teal)', display: 'inline-block', borderRadius: 2 }} />
                <span className="dim">{t('7-day avg')}</span>
              </div>
              <div className="row" style={{ gap: 6, fontSize: 13 }}>
                <Check checked={showTrend} onChange={setShowTrend} size={22} />
                <span style={{ width: 16, height: 2, borderTop: '2px dashed var(--yellow)', display: 'inline-block' }} />
                <span className="dim">{t('Trend')}</span>
              </div>
              <div className="row" style={{ gap: 6, fontSize: 13 }}>
                <Check checked={showProjection} onChange={setShowProjection} size={22} />
                <span style={{ width: 16, height: 2, borderTop: '2px dashed var(--yellow)', display: 'inline-block', opacity: 0.5 }} />
                <span className="dim">{t('{0}-week projection', PROJECTION_WEEKS)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="muted small">{t('Log at least 2 entries to see the chart.')}</div>
        )}
      </div>

      {/* ── History list (collapsible) ── */}
      <div className="card">
        <div className="row between" style={{ marginBottom: sorted.length > 0 ? 10 : 0 }}>
          <h2 style={{ margin: 0 }}>{t('History')}</h2>
          {sorted.length > HISTORY_LIMIT && (
            <button
              className="chip"
              style={{ fontSize: 12 }}
              onClick={() => setHistoryOpen(v => !v)}
            >
              {historyOpen ? t('Show less') : t('Show all {0}', sorted.length)}
            </button>
          )}
        </div>
        {sorted.length === 0 ? (
          <div className="muted small">{t('No entries yet.')}</div>
        ) : (
          <div>
            {[...sorted].reverse().slice(0, historyOpen ? undefined : HISTORY_LIMIT).map(e => (
              <div key={e.id || e.d} className="lrow">
                <div className="row" style={{ gap: 8, flex: 1 }}>
                  <span className="lrow-i" style={{ background: 'var(--surface-3)', fontSize: 16 }}>
                    <Icon name="scalemass" />
                  </span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{fmtNum(e.w)} {S.unit}</div>
                    <div className="dim small">{fmtDate(e.d, true)}</div>
                  </div>
                </div>
                <button
                  className="iconbtn"
                  style={{ color: 'var(--red)', opacity: 0.7 }}
                  onClick={() => deleteEntry(e.id || e.d)}
                  aria-label={t('Delete')}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
            {!historyOpen && sorted.length > HISTORY_LIMIT && (
              <button
                className="lrow"
                style={{ width: '100%', justifyContent: 'center', color: 'var(--label-3)', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', paddingTop: 6 }}
                onClick={() => setHistoryOpen(true)}
              >
                {t('+ {0} more', sorted.length - HISTORY_LIMIT)}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Body measurements ── */}
      {(() => {
        const latest = latestMeasurements(S)
        const hasAny = Object.keys(latest).length > 0
        const tracked = MEASURE_FIELDS.filter(f => latest[f.key])
        const allSessions = [...(S.measurements || [])].sort((a, b) => a.d < b.d ? 1 : -1)
        const MEAS_LIMIT = 3

        const monthlyRate = (series) => {
          if (series.length < 2) return null
          const first = series[0], last = series[series.length - 1]
          const days = (last.t - first.t) / 86400000
          if (days < 7) return null
          return Math.round((last.y - first.y) / days * 30 * 10) / 10
        }

        return (
          <div className="card">
            <div className="row between" style={{ marginBottom: hasAny ? 14 : 0 }}>
              <h2 style={{ margin: 0 }}>{t('Measurements')}</h2>
              <Button size="sm" icon="plus" onClick={measurementsSheet}>{t('Log')}</Button>
            </div>
            {hasAny ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {tracked.map(f => {
                    const series = measureSeries(S, f.key)
                    const cur = latest[f.key]
                    const prev = series.length >= 2 ? series[series.length - 2].y : null
                    const delta = prev !== null ? Math.round((cur.v - prev) * 10) / 10 : null
                    const rate = monthlyRate(series)
                    const color = MEASURE_COLORS[f.key] || 'var(--acc)'
                    const trendColor = rate === null || Math.abs(rate) < 0.2 ? 'var(--label-4)'
                      : rate > 0 ? 'var(--orange)' : 'var(--teal)'
                    return (
                      <div key={f.key} style={{
                        background: `linear-gradient(135deg,color-mix(in srgb,${color} 13%,var(--surface-2)),color-mix(in srgb,${color} 5%,var(--surface-2)))`,
                        border: `1px solid color-mix(in srgb,${color} 22%,transparent)`,
                        borderRadius: 12, padding: '10px 12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, opacity: 0.9 }} />
                          <div style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '.06em', color,
                          }}>
                            {f.name}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, fontSize: 17 }}>{cur.v}</span>
                          <span style={{ fontSize: 11, color: 'var(--label-3)' }}>cm</span>
                          {delta !== null && (
                            <span style={{
                              fontSize: 11, fontWeight: 600, marginLeft: 'auto',
                              color: delta === 0 ? 'var(--label-4)' : delta < 0 ? 'var(--teal)' : 'var(--orange)',
                            }}>
                              {delta > 0 ? '+' : ''}{delta}
                            </span>
                          )}
                        </div>
                        {rate !== null && (
                          <div style={{ fontSize: 10, color: trendColor, fontWeight: 600, marginBottom: 4 }}>
                            {rate > 0.2 ? '↑' : rate < -0.2 ? '↓' : '→'}{' '}
                            {rate > 0 ? '+' : ''}{rate} cm/{t('mo')}
                          </div>
                        )}
                        {series.length >= 2 && (
                          <div style={{ marginTop: 4 }}>
                            <LineChart points={series} h={42} unit="cm" color={color} axes={false} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Collapsible session history */}
                {allSessions.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div className="row between" style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('Sessions')}</span>
                      {allSessions.length > MEAS_LIMIT && (
                        <button className="chip" style={{ fontSize: 12 }} onClick={() => setMeasOpen(v => !v)}>
                          {measOpen ? t('Show less') : t('Show all {0}', allSessions.length)}
                        </button>
                      )}
                    </div>
                    {allSessions.slice(0, measOpen ? undefined : MEAS_LIMIT).map(entry => (
                      <div key={entry.d} style={{
                        background: 'var(--surface-2)', borderRadius: 10,
                        padding: '8px 12px', marginBottom: 6,
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--label-3)', marginBottom: 5, fontWeight: 600 }}>
                          {fmtDate(entry.d, true)}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                          {MEASURE_FIELDS.filter(f => (entry.values || {})[f.key] > 0).map(f => (
                            <span key={f.key} style={{ fontSize: 12 }}>
                              <span style={{ color: MEASURE_COLORS[f.key] || 'var(--label-3)', fontSize: 10, fontWeight: 700 }}>{f.name} </span>
                              <b>{entry.values[f.key]}</b>
                              <span style={{ color: 'var(--label-4)', fontSize: 10 }}> cm</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!measOpen && allSessions.length > MEAS_LIMIT && (
                      <button
                        style={{ width: '100%', color: 'var(--label-3)', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 0' }}
                        onClick={() => setMeasOpen(true)}
                      >
                        {t('+ {0} more', allSessions.length - MEAS_LIMIT)}
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="muted small">{t('No measurements yet — log your first set to track progress.')}</div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
