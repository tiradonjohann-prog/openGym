import { useState } from 'react'
import { isoOf, todayISO, MONTHS_LONG } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

function isoToDate(iso) {
  return new Date(iso + 'T12:00:00')
}

function fmtDur(minutes) {
  if (!minutes) return ''
  if (minutes < 60) return minutes + 'm'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? h + 'h' + m : h + 'h'
}

function shortName(name) {
  if (!name) return ''
  // keep first meaningful word, max 7 chars
  const w = name.trim().split(/\s+/)
  return w[0].length > 7 ? w[0].slice(0, 6) + '.' : w[0]
}

export default function Heatmap({ S, onDay }) {
  const today = todayISO()
  const todayDate = isoToDate(today)

  const byDate = {}
  S.workouts.forEach(w => {
    if (!byDate[w.d]) byDate[w.d] = []
    byDate[w.d].push(w)
  })

  const [viewYear,  setViewYear]  = useState(todayDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth())

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    const isCur = viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth()
    if (isCur) return
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }
  const isCurrentMonth = viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth()

  const firstOfMonth  = new Date(viewYear, viewMonth, 1)
  const firstDayOfWk  = (firstOfMonth.getDay() + 6) % 7
  const gridStart     = new Date(firstOfMonth)
  gridStart.setDate(1 - firstDayOfWk)

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const totalCells  = Math.ceil((firstDayOfWk + daysInMonth) / 7) * 7

  const cells = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push(d)
  }

  const DOW_LABELS = [t('Mon'), t('Tue'), t('Wed'), t('Thu'), t('Fri'), t('Sat'), t('Sun')]

  const monthWorkouts = Object.entries(byDate).filter(([iso]) => {
    const d = isoToDate(iso)
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth
  })
  const monthCount   = monthWorkouts.length
  const monthMinutes = monthWorkouts.reduce((s, [, ws]) => s + ws.reduce((n, w) =>
    n + Math.max(0, Math.round(((w.end || w.start) - w.start) / 60000)), 0), 0)

  return (
    <div>
      {/* ── Month navigation ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button className="iconbtn" style={{ width: 34, height: 34, background: 'var(--surface-2)', borderRadius: 9 }}
          onClick={prevMonth} aria-label={t('Previous month')}>
          <Icon name="chevronLeft" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--label)', lineHeight: 1.1 }}>
            {t(MONTHS_LONG[viewMonth])} {viewYear}
          </div>
          {monthCount > 0 && (
            <div style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 2 }}>
              {t(monthCount === 1 ? '{0} workout' : '{0} workouts', monthCount)}
              {monthMinutes > 0 && ' · ' + fmtDur(monthMinutes)}
            </div>
          )}
        </div>
        <button className="iconbtn"
          style={{ width: 34, height: 34, background: 'var(--surface-2)', borderRadius: 9, opacity: isCurrentMonth ? 0.3 : 1 }}
          onClick={nextMonth} disabled={isCurrentMonth} aria-label={t('Next month')}>
          <Icon name="chevronRight" />
        </button>
      </div>

      {/* ── Day-of-week headers ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {DOW_LABELS.map(lbl => (
          <div key={lbl} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--label-4)', padding: '0 0 2px' }}>
            {lbl}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((d, idx) => {
          const iso      = isoOf(d)
          const inMonth  = d.getMonth() === viewMonth
          const isToday  = iso === today
          const isFuture = d > todayDate
          const ws       = byDate[iso] || []
          const hasWork  = ws.length > 0 && inMonth
          const w0       = ws[0]
          const name     = hasWork ? (w0?.name || '') : ''
          const dur      = hasWork
            ? ws.reduce((s, w) => s + Math.max(0, Math.round(((w.end || w.start) - w.start) / 60000)), 0)
            : 0
          const dist     = hasWork && w0?.distance ? w0.distance : null

          return (
            <div key={idx}
              onClick={hasWork ? () => onDay(iso) : undefined}
              style={{
                minHeight: 52,
                borderRadius: 9,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                position: 'relative',
                cursor: hasWork ? 'pointer' : 'default',
                background: hasWork
                  ? 'var(--acc)'
                  : isToday
                    ? 'color-mix(in srgb, var(--acc) 18%, var(--surface-2))'
                    : inMonth ? 'var(--surface-2)' : 'transparent',
                border: isToday && !hasWork
                  ? '2px solid var(--acc)'
                  : hasWork ? '2px solid color-mix(in srgb, var(--acc) 70%, transparent)'
                    : '2px solid transparent',
                opacity: isFuture ? 0.25 : !inMonth ? 0.15 : 1,
                transition: 'background .15s',
                gap: 1,
                padding: '3px 2px',
              }}
            >
              {/* Date number */}
              <span style={{
                fontSize: 11,
                fontWeight: hasWork || isToday ? 700 : 500,
                color: hasWork ? 'var(--on-acc)' : isToday ? 'var(--acc)' : 'var(--label-3)',
                lineHeight: 1.1,
              }}>
                {d.getDate()}
              </span>

              {/* Session name */}
              {hasWork && name && (
                <span style={{
                  fontSize: 9, fontWeight: 700, lineHeight: 1.1,
                  color: 'var(--on-acc)',
                  opacity: 0.9,
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {shortName(name)}
                </span>
              )}

              {/* Duration (and distance if available) */}
              {hasWork && dur > 0 && (
                <span style={{
                  fontSize: 8, fontWeight: 500, lineHeight: 1,
                  color: 'var(--on-acc)',
                  opacity: 0.75,
                }}>
                  {fmtDur(dur)}{dist ? ' · ' + dist + 'km' : ''}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
