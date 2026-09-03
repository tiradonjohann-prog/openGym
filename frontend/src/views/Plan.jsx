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
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'

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
        nav('/plan/r/' + r.id)
      }} />
    ))
  }

  return <>
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{t('Your weekly routine')}</div></div>
      <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
    </div>

    {/* ── Programmes section ── */}
    <div style={{ marginBottom: 24 }}>
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

    <div className="cols"><div>
      <h4 className="sec">{t('Week schedule')}</h4>
      <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {[1, 2, 3, 4, 5, 6, 0].map(d => {
          const r = S.routines.find(x => x.id === S.week[d])
          return <div key={d} className="item" onClick={() => dayAssignSheet(d)}>
            <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
            {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{r.name}</span> : <span className="tag">{t('Rest')}</span>}
            <Icon name="chevronRight" className="chev" /></div>
        })}
      </div>
    </div><div>
      <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
        <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
      </div>
      {S.routines.length ? <div className="list">{S.routines.map(r => <div key={r.id} className="item" onClick={() => nav('/plan/r/' + r.id)}>
        <span className="lrow-i" style={isCardioSport(r.sport) ? { background: 'var(--teal)' } : undefined}>
          <Icon name={isCardioSport(r.sport) ? (SPORTS[r.sport]?.icon || 'bolt') : glyphOf(r.emoji)} />
        </span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{routineSubtitle(r)}</div></div>
        <Icon name="chevronRight" className="chev" /></div>)}</div> : <>
        <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}<br />{t('Create one or load the starter plan.')}</div>
        <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
      </>}
    </div></div>
  </>
}
