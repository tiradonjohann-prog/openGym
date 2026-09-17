import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { DAYN, uid, exCount, isoOf } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { SPORTS, isCardioSport, defaultCardioBlocks, routineTotalDuration, isHybrid } from '../lib/sports.js'
import { isProgrammeComplete, completedWeekCount } from '../lib/programme.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet, programmeCreateSheet, programmeEditSheet, deleteProgramme } from '../sheets.jsx'
import { pickImage, isUserImage } from '../lib/imageUtils.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { TutorialButton } from '../components/TutorialOverlay.jsx'
import { PLAN_STEPS } from '../lib/tutorials.js'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import ProgrammeCard from '../components/ProgrammeCard.jsx'
import RoutineCard from '../components/RoutineCard.jsx'

const DAYN_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function SportPicker({ close, onCreate }) {
  return <>
    <h3>{t('Type de séance')}</h3>
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
  if (isHybrid(r)) {
    const nEx = (r.items || []).filter(x => x.kind === 'ex').length
    const nBlocks = (r.items || []).filter(x => x.kind === 'block').length
    return `${exCount(nEx)} + ${nBlocks} bloc${nBlocks > 1 ? 's' : ''} cardio`
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
          id: uid(), name: t('Nouvelle séance'), emoji: DEFAULT_GLYPH,
          sport,
          ...(isCardio ? { blocks: defaultCardioBlocks(sport) } : { ex: [] }),
        }
        update(s => { s.routines.push(r) })
        nav('/plan/r/' + r.id, { state: { isNew: true } })
      }} />
    ))
  }

  const now = new Date()
  const todayDow = now.getDay()
  const mondayOffset = todayDow === 0 ? -6 : 1 - todayDow
  const monday = new Date(now)
  monday.setDate(monday.getDate() + mondayOffset)

  return <>
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{t('Votre planning hebdomadaire')}</div></div>
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
        <Button size="sm" variant="tinted" icon="plus" onClick={programmeCreateSheet}>{t('Créer programme')}</Button>
      </div>
      {programmes.length === 0 ? (
        <div className="empty" style={{ padding: '14px 0' }}>
          <div className="ico"><Icon name="clipboard" /></div>
          {t('No programmes yet.')}
          <br />
          <span className="small muted">{t('Regroupez vos séances en plan d\'entraînement multi-semaines.')}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {programmes.map(prog => (
            <div key={prog.id} style={{ width: 'calc(50% - 5px)', flexShrink: 0 }}>
              <ProgrammeCard prog={prog} />
            </div>
          ))}
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
          const isToday = d === todayDow
          const offset = d === 0 ? 6 : d - 1
          const cellDate = new Date(monday)
          cellDate.setDate(monday.getDate() + offset)
          const isoDate = isoOf(cellDate)
          const doneWorkouts = (S.workouts || []).filter(w => w.d === isoDate)
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
              {doneWorkouts.length > 0 && (
                <>
                  {doneWorkouts.slice(0, 2).map(w => (
                    <span key={w.id} style={{
                      fontSize: 8, color: 'var(--teal)', fontWeight: 700,
                      textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      padding: '1px 3px', maxWidth: '100%',
                      background: 'color-mix(in srgb,var(--teal) 14%,transparent)',
                      borderRadius: 3, lineHeight: 1.3,
                    }}>
                      ✓ {w.name}
                    </span>
                  ))}
                  {doneWorkouts.length > 2 && (
                    <span style={{ fontSize: 8, color: 'var(--teal)', fontWeight: 700, textAlign: 'center' }}>+{doneWorkouts.length - 2}</span>
                  )}
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>

    {/* ── Routines list ── */}
    <div data-tuto="plan-routines">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Entrainements / Séances')}</h4>
        <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('Créer séance')}</Button>
      </div>
      {S.routines.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {S.routines.map(r => (
            <div key={r.id} style={{ width: 'calc(50% - 5px)', flexShrink: 0 }}>
              <RoutineCard routine={r} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('Aucun entrainement pour l\'instant.')}<br />{t('Créez-en un ou chargez le plan de démarrage.')}</div>
          <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
        </>
      )}
    </div>
  </>
}
