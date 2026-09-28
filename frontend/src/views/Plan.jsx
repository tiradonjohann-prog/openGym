import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { DAYN, uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { SPORTS, isCardioSport, defaultCardioBlocks, routineSubtitle } from '../lib/sports.js'
import { isProgrammeComplete, completedWeekCount, activeProgramme, addRoutineToProgramme } from '../lib/programme.js'
import { planToolsSheet, programmeCreateSheet, programmeEditSheet, deleteProgramme } from '../sheets.jsx'
import { pickImage, isUserImage } from '../lib/imageUtils.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { TutorialButton } from '../components/TutorialOverlay.jsx'
import { PLAN_STEPS } from '../lib/tutorials.js'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import ProgrammeCard from '../components/ProgrammeCard.jsx'


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

function RoutineLibraryRow({ routines, nav, onAddToProgramme, canAdd }) {
  return (
    <div className="no-scrollbar" style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', gap: 10, paddingBottom: 2 }}>
      {routines.map(r => {
        const isCardio = isCardioSport(r.sport)
        const color = isCardio ? 'var(--teal)' : 'var(--acc)'
        const icon = isCardio ? (SPORTS[r.sport]?.icon || 'bolt') : glyphOf(r.emoji)
        const hasImg = !!r.imageUrl
        return (
          <div key={r.id} style={{ flex: '0 0 188px', scrollSnapAlign: 'start' }}>
            <div style={{
              position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden',
              border: `2px solid color-mix(in srgb,${color} 40%,transparent)`,
              background: hasImg ? 'var(--surface-2)' : `linear-gradient(135deg,color-mix(in srgb,${color} 22%,var(--surface-2)),var(--surface-3))`,
            }}>
              {hasImg && (
                <img src={r.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 3, boxSizing: 'border-box' }} />
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 40%,rgba(0,0,0,.72) 100%)', pointerEvents: 'none' }} />
              {hasImg ? (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 9px' }}>
                  <div className="capitalize" style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.25, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)', marginTop: 1, textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                    {routineSubtitle(r)}
                  </div>
                </div>
              ) : (
                /* No cover image: a small icon up top, then the name
                   vertically centered and large in the remaining space — a
                   short name still fills most of the tile instead of sitting
                   as one compact line at the bottom. */
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '9px 9px' }}>
                  <Icon name={icon} style={{ fontSize: 18, color, opacity: .5, alignSelf: 'center' }} />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: 0 }}>
                    <div className="capitalize font-display" style={{
                      fontWeight: 700, fontSize: 16, lineHeight: 1.15, color: '#fff', overflow: 'hidden',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                      textShadow: '0 1px 4px rgba(0,0,0,.5)',
                    }}>
                      {r.name}
                    </div>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.75)', textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                    {routineSubtitle(r)}
                  </div>
                </div>
              )}
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

  return <>
    <div className="hdr">
      <div><h1 className="font-display">{t('Plan')}</h1><div className="sub">{t('Vos programmes et séances')}</div></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TutorialButton steps={PLAN_STEPS} />
        <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
      </div>
    </div>

    <button className="btn cta" data-tuto="plan-create" style={{ marginBottom: 20 }} onClick={programmeCreateSheet}>
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
        <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('Aucun entrainement pour l\'instant.')}<br />{t('Créez-en un ci-dessus.')}</div>
      )}
    </div>
  </>
}
