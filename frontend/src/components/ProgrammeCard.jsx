import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { glyphOf } from '../lib/glyphs.js'
import { isCardioSport, SPORTS } from '../lib/sports.js'
import { sessionStates, isWeekComplete, isProgrammeComplete, completedWeekCount } from '../lib/programme.js'
import { startFlowForProgramme, programmeEditSheet } from '../sheets.jsx'
import Icon from './Icon.jsx'

// ── design tokens (all derived from existing CSS vars — no new variables) ──
// Next-session row:  3px left border var(--acc), text var(--acc), weight 700
// Done-session row:  opacity 0.4, color var(--label-3)
// Progress bar:      height 2px, track var(--surface-3), fill var(--acc)
// Session chip:      var(--surface-3) bg, var(--label-2) text, 11px 600 uppercase

function ProgressBar({ value }) {
  return (
    <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 99, marginTop: 10, overflow: 'hidden' }}>
      <div className="prog-fill" style={{
        height: '100%', background: 'linear-gradient(90deg,var(--acc-2),var(--acc))', borderRadius: 99,
        width: Math.min(100, Math.max(0, value * 100)) + '%',
      }} />
    </div>
  )
}

function SessionChip({ label }) {
  return (
    <span style={{
      display: 'inline-block',
      background: 'var(--surface-3)', color: 'var(--label-2)',
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em',
      padding: '3px 8px', borderRadius: 5, lineHeight: 1.4,
    }}>{label}</span>
  )
}

export default function ProgrammeCard({ prog }) {
  const [open, setOpen] = useState(false)
  const [weekView, setWeekView] = useState(prog.currentWeek)
  const routines = useStore(s => s.S.routines)
  const update = useStore(s => s.update)

  // Follow when currentWeek advances (auto-advance or manual skip)
  useEffect(() => { setWeekView(prog.currentWeek) }, [prog.currentWeek])

  const complete = isProgrammeComplete(prog)
  const doneWeeks = completedWeekCount(prog)
  const progressPct = prog.totalWeeks > 0 ? doneWeeks / prog.totalWeeks : 0

  const states = sessionStates(prog, weekView)
  const isCurrentWeek = weekView === prog.currentWeek

  const skipWeek = () => {
    const next = prog.currentWeek + 1
    update(s => {
      const p = (s.programmes || []).find(x => x.id === prog.id)
      if (p && p.currentWeek < p.totalWeeks) p.currentWeek = next
    })
    setWeekView(next)
  }

  const goToCurrentWeek = () => setWeekView(prog.currentWeek)

  const getRoutine = rid => routines.find(r => r.id === rid)

  const routineLabel = rid => {
    const r = getRoutine(rid)
    return r ? r.name : t('Unknown session')
  }

  return (
    <div
      className="card"
      style={{
        padding: 0, overflow: 'hidden', marginBottom: 12,
        border: open ? '1px solid var(--surface-3)' : '1px solid transparent',
        transition: 'border-color .2s',
      }}
    >
      {/* ── closed header (always visible) ── */}
      <div
        className="prog-hd"
        onClick={() => setOpen(o => !o)}
        style={{ padding: '14px 16px' }}
        role="button"
        aria-expanded={open}
      >
        {/* Ganbaru-style teal eyebrow */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--acc)', marginBottom: 4 }}>
          {complete ? t('Programme complete') : t('Current programme')}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: 20, letterSpacing: '-.024em', lineHeight: 1.15, color: 'var(--label)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{prog.name}</div>
          </div>
          <Icon
            name={open ? 'chevronUp' : 'chevronDown'}
            style={{ fontSize: 14, color: 'var(--acc)', flexShrink: 0, marginTop: 4 }}
          />
        </div>
        {/* week / total subline */}
        <div style={{ fontSize: 13, color: 'var(--label-3)', marginBottom: 8 }}>
          {complete
            ? t('{0} weeks — finished!', prog.totalWeeks)
            : t('Week {0} · {1} weeks total', prog.currentWeek, prog.totalWeeks)}
        </div>

        {/* session chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: complete ? 0 : 4 }}>
          {prog.routineIds.map((rid, i) => (
            <SessionChip key={i} label={routineLabel(rid)} />
          ))}
        </div>

        {!complete && <ProgressBar value={progressPct} />}
        {complete && (
          <div style={{ height: 4, background: 'linear-gradient(90deg,var(--acc-2),var(--acc))', borderRadius: 99, marginTop: 10 }} />
        )}
      </div>

      {/* ── expanded content ── */}
      {open && (
        <div className="prog-body" style={{ borderTop: '1px solid var(--surface-3)', paddingBottom: 8 }}>
          {/* week navigation */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px 8px', borderBottom: '1px solid var(--surface-3)',
          }}>
            <button
              className="iconbtn"
              style={{ width: 30, height: 30, flexShrink: 0 }}
              disabled={weekView <= 1}
              onClick={e => { e.stopPropagation(); setWeekView(w => Math.max(1, w - 1)) }}
              aria-label={t('Previous week')}
            >
              <Icon name="chevronLeft" />
            </button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--label-2)' }}>
                {t('Week {0}', weekView)}
              </div>
              {!isCurrentWeek && (
                <button
                  onClick={e => { e.stopPropagation(); goToCurrentWeek() }}
                  style={{
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em',
                    color: 'var(--acc)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 0',
                  }}
                >
                  {t('Active: W{0}', prog.currentWeek)}
                </button>
              )}
            </div>
            <button
              className="iconbtn"
              style={{ width: 30, height: 30, flexShrink: 0 }}
              disabled={weekView >= prog.totalWeeks}
              onClick={e => { e.stopPropagation(); setWeekView(w => Math.min(prog.totalWeeks, w + 1)) }}
              aria-label={t('Next week')}
            >
              <Icon name="chevronRight" />
            </button>
          </div>

          {/* session rows */}
          <div style={{ padding: '4px 0' }}>
            {prog.routineIds.map((rid, i) => {
              const state = states[i]
              const isDone = state === 'done'
              const isNext = state === 'next'

              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px',
                    borderLeft: isNext ? '3px solid var(--acc)' : '3px solid transparent',
                    opacity: isDone ? 0.45 : 1,
                    transition: 'opacity .2s',
                  }}
                >
                  {/* status icon */}
                  <div style={{ width: 20, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                    {isDone
                      ? <Icon name="check" style={{ fontSize: 13, color: 'var(--label-3)' }} />
                      : <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: isNext ? 'var(--acc)' : 'var(--surface-3)',
                          flexShrink: 0,
                        }} />
                    }
                  </div>

                  {/* session name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: isNext ? 700 : 500,
                      color: isNext ? 'var(--acc)' : isDone ? 'var(--label-3)' : 'var(--label)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {routineLabel(rid)}
                    </div>
                  </div>

                  {/* start CTA — available for any non-done session */}
                  {!isDone && (
                    <button
                      className="prog-start"
                      onClick={e => { e.stopPropagation(); startFlowForProgramme(prog.id, weekView, i) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: isNext ? 'var(--acc)' : 'var(--surface-3)',
                        color: isNext ? 'var(--on-acc)' : 'var(--label-2)',
                        fontSize: 12, fontWeight: 700,
                        padding: '5px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
                        letterSpacing: '.01em', flexShrink: 0,
                      }}
                    >
                      {t('Start')}
                      <Icon name="chevronRight" style={{ fontSize: 11 }} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* skip week / programme complete actions */}
          <div style={{ padding: '4px 16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {complete && (
              <div style={{
                textAlign: 'center', padding: '10px 0',
                fontSize: 13, fontWeight: 600, color: 'var(--acc)',
              }}>
                <Icon name="flag" style={{ marginRight: 6 }} />
                {t('Programme complete — all {0} weeks done!', prog.totalWeeks)}
              </div>
            )}
            {!complete && isCurrentWeek && prog.currentWeek < prog.totalWeeks && (
              <button
                className="prog-action"
                onClick={e => { e.stopPropagation(); skipWeek() }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: 'var(--label-3)',
                  padding: '6px 0', letterSpacing: '.02em',
                }}
              >
                {t('Skip to week {0}', prog.currentWeek + 1)}
                <Icon name="chevronRight" style={{ fontSize: 11 }} />
              </button>
            )}
            <button
              className="prog-action"
              onClick={e => { e.stopPropagation(); programmeEditSheet(prog) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 500, color: 'var(--label-3)', padding: '4px 0',
              }}
            >
              <Icon name="pencil" style={{ fontSize: 11 }} />
              {t('Edit programme')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
