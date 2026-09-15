import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { DAYN, uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { SPORTS, isCardioSport, defaultCardioBlocks, routineTotalDuration } from '../lib/sports.js'
import { isProgrammeComplete, completedWeekCount } from '../lib/programme.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet, programmeCreateSheet, programmeEditSheet, deleteProgramme } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { TutorialButton } from '../components/TutorialOverlay.jsx'
import { PLAN_STEPS } from '../lib/tutorials.js'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'

const DAYN_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function SportPicker({ close, onCreate }) {
  return <>
    <h3>{t('Type of routine')}</h3>
    <div className="list">
      {Object.entries(SPORTS).map(([key, sp]) => (
        <div key={key} className="item" onClick={() => { close(); onCreate(key) }}>
          <span className="lrow-i" style={{ background: sp.cardio ? 'var(--teal)' : 'var(--acc)', opacity: 0.85 }}>
            <Icon name={sp.icon} />
          </span>
          <div className="grow">
            <div className="tt">{t(sp.label)}</div>
            <div className="ss">{sp.cardio ? t('Cardio — timer-based blocks') : t('Strength — sets & reps')}</div>
          </div>
          <Icon name="chevronRight" className="chev" />
        </div>
      ))}
    </div>
  </>
}

function routineSubtitle(r) {
  if (isCardioSport(r.sport)) {
    const min = routineTotalDuration(r.blocks || [])
    const sportLabel = t(SPORTS[r.sport]?.label || r.sport)
    return min ? `${sportLabel} \xB7 ${min} min` : sportLabel
  }
  return exCount(r.ex?.length ?? 0)
}

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { openSheet } = useUI()

  const programmes = S.programmes || []

  const addRoutine = () => {
    openSheet(close => (
      <SportPicker close={close} onCreate={sport => {
        const isCardio = isCardioSport(sport)
        const r = {
          id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH,
          sport,
          ...(isCardio ? { blocks: defaultCardioBlocks(sport) } : { ex: [] }),
        }
        update(s => { s.routines.push(r) })
        nav('/plan/r/' + r.id, { state: { isNew: true } })
      }} />
    ))
  }

  return <>
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{t('Your weekly routine')}</div></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TutorialButton steps={PLAN_STEPS} />
        <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
      </div>
    </div>

    {/* ── Programmes section ── */}
    <div data-tuto="plan-programmes" style={{ marginBottom: 24 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Programmes')}</h4>
        <Button size="sm" variant="tinted" icon="plus" onClick={programmeCreateSheet}>{t('New')}</Button>
      </div>
      {programmes.length === 0 ? (
        <div className="empty" style={{ padding: '14px 0' }}>
          <div className="ico"><Icon name="clipboard" /></div>
          {t('No programmes yet.')}
          <br />
          <span className="small muted">{t('Group your routines into a multi-week training plan.')}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {programmes.map(prog => {
            const complete = isProgrammeComplete(prog)
            const doneWeeks = completedWeekCount(prog)
            const sessionCount = prog.routineIds.length
            if (!complete) {
              // Active programme — highlighted card
              return (
                <div key={prog.id} className="plan-prog-active" style={{ borderRadius: 14, overflow: 'hidden', border: '2px solid color-mix(in srgb,var(--acc) 55%,transparent)', cursor: 'pointer' }}
                  onClick={() => programmeEditSheet(prog)}>
                  <div style={{ padding: '7px 14px', background: 'var(--acc-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--acc)' }}>{t('Active')}</span>
                    <button className="iconbtn" style={{ width: 26, height: 26, color: 'var(--red)' }} aria-label={t('Delete')} onClick={e => { e.stopPropagation(); deleteProgramme(prog.id) }}><Icon name="trash" /></button>
                  </div>
                  <div style={{ padding: '12px 14px 14px', background: 'var(--surface)' }}>
                    <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-.02em', marginBottom: 3 }}>{prog.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--label-3)', marginBottom: 10 }}>
                      {t('Week {0} · {1} weeks total', prog.currentWeek, prog.totalWeeks)}{' · '}{t('{0} sessions', sessionCount)}
                    </div>
                    <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                      <div className="prog-fill" style={{ height: '100%', background: 'linear-gradient(90deg,var(--acc-2),var(--acc))', width: Math.min(100, (doneWeeks / prog.totalWeeks) * 100) + '%', borderRadius: 99 }} />
                    </div>
                  </div>
                </div>
              )
            }
            // Complete programme — compact list item
            return (
              <div key={prog.id} className="item" style={{ opacity: 0.6 }} onClick={() => programmeEditSheet(prog)}>
                <span className="lrow-i" style={{ background: 'var(--surface-3)' }}>
                  <Icon name="checkCircle" style={{ color: 'var(--label-2)' }} />
                </span>
                <div className="grow">
                  <div className="tt">{prog.name}</div>
                  <div className="ss">{t('{0} sessions', sessionCount)}{' · '}{t('Complete')}</div>
                </div>
                <button className="iconbtn" style={{ width: 32, height: 32, color: 'var(--red)' }} aria-label={t('Delete')} onClick={e => { e.stopPropagation(); deleteProgramme(prog.id) }}>
                  <Icon name="trash" />
                </button>
                <Icon name="chevronRight" className="chev" />
              </div>
            )
          })}
        </div>
      )}
    </div>

    {/* ── Week schedule grid ── */}
    <div data-tuto="plan-week" style={{ marginBottom: 24 }}>
      <h4 className="sec">{t('Week schedule')}</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {[1, 2, 3, 4, 5, 6, 0].map(d => {
          const r = S.routines.find(x => x.id === S.week[d])
          const isCardio = r && isCardioSport(r.sport)
          const color = r ? (isCardio ? 'var(--teal)' : 'var(--acc)') : null
          const today = new Date().getDay()
          const isToday = d === today
          return (
            <button key={d} onClick={() => dayAssignSheet(d)} style={{
              background: color
                ? `linear-gradient(160deg,color-mix(in srgb,${color} 18%,var(--surface-2)),color-mix(in srgb,${color} 8%,var(--surface-2)))`
                : 'var(--surface-2)',
              border: isToday
                ? `2px solid ${color || 'var(--acc)'}44`
                : `1px solid ${color ? `color-mix(in srgb,${color} 18%,transparent)` : 'var(--sep)'}`,
              borderRadius: 12,
              padding: '10px 4px 8px',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              position: 'relative',
            }}>
              {isToday && (
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 5, height: 5, borderRadius: '50%',
                  background: color || 'var(--acc)',
                }} />
              )}
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', color: color || 'var(--label-4)', textTransform: 'uppercase' }}>
                {DAYN_SHORT[d]}
              </span>
              {r ? (
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: color ? `color-mix(in srgb,${color} 22%,transparent)` : 'var(--surface-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: color || 'var(--label-2)', fontSize: 14,
                }}>
                  <Icon name={isCardio ? (SPORTS[r.sport]?.icon || 'bolt') : glyphOf(r.emoji)} />
                </div>
              ) : (
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--label-4)', fontSize: 14,
                }}>
                  <Icon name="moon" />
                </div>
              )}
              <span style={{ fontSize: 9, color: color || 'var(--label-4)', fontWeight: r ? 600 : 400, textAlign: 'center', lineHeight: 1.2, letterSpacing: '.01em', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                {r ? r.name : t('Rest')}
              </span>
            </button>
          )
        })}
      </div>
    </div>

    {/* ── Routines list ── */}
    <div data-tuto="plan-routines">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
        <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
      </div>
      {S.routines.length ? (
        <div className="list">
          {S.routines.map(r => {
            const isCardio = isCardioSport(r.sport)
            const color = isCardio ? 'var(--teal)' : 'var(--acc)'
            return (
              <div key={r.id} className="item" onClick={() => nav('/plan/r/' + r.id)}
                style={{ borderLeft: `3px solid color-mix(in srgb,${color} 55%,transparent)` }}>
                <span className="lrow-i" style={{
                  background: `color-mix(in srgb,${color} 18%,var(--surface-3))`,
                  color,
                }}>
                  <Icon name={isCardio ? (SPORTS[r.sport]?.icon || 'bolt') : glyphOf(r.emoji)} />
                </span>
                <div className="grow">
                  <div className="tt">{r.name}</div>
                  <div className="ss">{routineSubtitle(r)}</div>
                </div>
                <Icon name="chevronRight" className="chev" />
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}<br />{t('Create one or load the starter plan.')}</div>
          <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
        </>
      )}
    </div>
  </>
}
