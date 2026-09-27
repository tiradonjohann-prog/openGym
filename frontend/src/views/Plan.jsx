import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { DAYN, uid, isoOf } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { SPORTS, isCardioSport, defaultCardioBlocks, routineTotalDuration } from '../lib/sports.js'
import { isProgrammeComplete, completedWeekCount, activeProgramme, addRoutineToProgramme } from '../lib/programme.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet, programmeCreateSheet, programmeEditSheet, deleteProgramme } from '../sheets.jsx'
import { pickImage, isUserImage } from '../lib/imageUtils.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { TutorialButton } from '../components/TutorialOverlay.jsx'
import { PLAN_STEPS } from '../lib/tutorials.js'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import ProgrammeCard from '../components/ProgrammeCard.jsx'

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

function routineTileSubtitle(r) {
  if (isCardioSport(r.sport)) {
    const min = routineTotalDuration(r.blocks || [])
    const label = t(SPORTS[r.sport]?.label || r.sport)
    return min ? `${label} · ${min} min` : label
  }
  const n = r.ex?.length || r.items?.filter(i => i.kind === 'ex').length || 0
  return `${n} ${t('exercices')}`
}

function RoutineLibraryRow({ routines, nav, onAddToProgramme, canAdd }) {
  return (
    <div className="no-scrollbar" style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', gap: 10, paddingBottom: 2 }}>
      {routines.map(r => {
        const isCardio = isCardioSport(r.sport)
        const color = isCardio ? 'var(--teal)' : 'var(--acc)'
        const icon = isCardio ? (SPORTS[r.sport]?.icon || 'bolt') : glyphOf(r.emoji)
        const hasImg = !!r.imageUrl
        return (
          <div key={r.id} style={{ flex: '0 0 160px', scrollSnapAlign: 'start' }}>
            <div style={{
              position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden',
              border: `2px solid color-mix(in srgb,${color} 40%,transparent)`,
              background: hasImg ? 'var(--surface-2)' : `linear-gradient(135deg,color-mix(in srgb,${color} 22%,var(--surface-2)),var(--surface-3))`,
            }}>
              {hasImg ? (
                <img src={r.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 8, boxSizing: 'border-box' }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={icon} style={{ fontSize: 34, color, opacity: .45 }} />
                </div>
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 45%,rgba(0,0,0,.65) 100%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 9px' }}>
                <div className="capitalize" style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.25, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)', marginTop: 1, textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                  {routineTileSubtitle(r)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
              <button
                className="chip"
                style={{ flex: 1, fontSize: 11, padding: '7px 4px', textAlign: 'center' }}
                onClick={() => nav('/plan/r/' + r.id)}
              >
                {t('Consulter')}
              </button>
              <button
                className="chip"
                disabled={!canAdd}
                style={{ flex: 1, fontSize: 11, padding: '7px 4px', textAlign: 'center', opacity: canAdd ? 1 : .4 }}
                onClick={() => canAdd && onAddToProgramme(r)}
              >
                {t('+ Programme')}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { openSheet } = useUI()

  const programmes = S.programmes || []
  const hasActiveProgramme = activeProgramme(S) != null
  const [showClassic, setShowClassic] = useState(false)

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
      <div><h1 className="font-display">{t('Plan')}</h1><div className="sub">{t('Votre planning hebdomadaire')}</div></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TutorialButton steps={PLAN_STEPS} />
        <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
      </div>
    </div>

    <button className="btn cta" style={{ marginBottom: 20 }} onClick={programmeCreateSheet}>
      <Icon name="plus" />
      <span>{t('Créer un programme')}</span>
    </button>

    {/* ── Programmes section ── */}
    <div data-tuto="plan-programmes" style={{ marginBottom: 24 }}>
      <h4 className="sec" style={{ margin: '0 0 10px' }}>{t('Programmes')}</h4>
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

    {/* ── Week schedule grid (collapsed behind a toggle once a programme is active) ── */}
    {hasActiveProgramme && !showClassic ? (
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setShowClassic(true)}
          style={{
            width: '100%', background: 'transparent', border: '1px solid var(--glass-border)',
            color: 'var(--label-2)', fontWeight: 500, fontSize: 13, padding: 11,
            borderRadius: 12, cursor: 'pointer',
          }}
        >
          {t('Voir le planning classique')}
        </button>
      </div>
    ) : (
    <div data-tuto="plan-week" style={{ marginBottom: 24 }}>
      <div className="row between" style={{ marginBottom: 4 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Week schedule')}</h4>
        {hasActiveProgramme && (
          <button
            onClick={() => setShowClassic(false)}
            style={{
              background: 'none', border: 'none', padding: '8px 4px', margin: '-8px -4px',
              fontSize: 12, fontWeight: 600, color: 'var(--acc)', cursor: 'pointer',
            }}
          >
            {t('Masquer')}
          </button>
        )}
      </div>
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
    )}

    {/* ── Routines list ── */}
    <div data-tuto="plan-routines">
      <h4 className="sec" style={{ margin: '0 0 10px' }}>{t('Bibliothèque de séances')}</h4>
      <button className="btn cta blue" style={{ marginBottom: 14 }} onClick={addRoutine}>
        <Icon name="plus" />
        <span>{t('Créer une séance')}</span>
      </button>
      {S.routines.length ? (
        <RoutineLibraryRow
          routines={S.routines}
          nav={nav}
          canAdd={hasActiveProgramme}
          onAddToProgramme={r => {
            update(s => {
              const prog = activeProgramme(s)
              if (prog) addRoutineToProgramme(prog, r.id)
            })
            useUI.getState().toast(t('Ajouté au programme'))
          }}
        />
      ) : (
        <>
          <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('Aucun entrainement pour l\'instant.')}<br />{t('Créez-en un ou chargez le plan de démarrage.')}</div>
          <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
        </>
      )}
    </div>
  </>
}
