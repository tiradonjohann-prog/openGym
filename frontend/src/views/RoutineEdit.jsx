import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { supersetUnits, cleanupSg, exLine } from '../lib/history.js'
import { SPORTS, BLOCK_TYPES, INTENSITIES, isCardioSport, blockSummary, blockDurationMin, routineTotalDuration, defaultCardioBlocks } from '../lib/sports.js'
import { Thumb } from '../components/Media.jsx'
import { glyphPicker, exercisePicker, exConfigSheet, confirmSheet, swapExerciseSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button, SelectRow } from '../components/ui.jsx'
import { POLICIES_FOR, POLICY_NAME, POLICY_DESC } from '../lib/progression.js'
import BodyMap from '../components/BodyMap.jsx'
import { loadOfRoutine, rankOf, MUSCLE_NAME } from '../lib/muscles.js'

/* ─── block config sheet ─── */
function IntensityPicker({ value, onChange }) {
  return (
    <div className="chips" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {INTENSITIES.map(i => (
        <button
          key={i.level}
          className={'chip' + (value === i.level ? ' on' : '')}
          style={value === i.level ? { background: i.color, color: '#fff', border: 'none' } : {}}
          onClick={() => onChange(i.level)}
        >
          {i.level} – {t(i.label)}
        </button>
      ))}
    </div>
  )
}

function DurationStepper({ value, onChange, min = 1, max = 120, label = 'min' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
      <button className="iconbtn" style={{ width: 36, height: 36 }} onClick={() => onChange(Math.max(min, value - 1))}><Icon name="minus" /></button>
      <div style={{ minWidth: 80, textAlign: 'center', fontSize: 22, fontWeight: 600 }}>{value} <span className="muted" style={{ fontSize: 13 }}>{label}</span></div>
      <button className="iconbtn" style={{ width: 36, height: 36 }} onClick={() => onChange(Math.min(max, value + 1))}><Icon name="plus" /></button>
    </div>
  )
}

function BlockConfigSheet({ block, close, onSave }) {
  const [b, setB] = useState({ ...block })
  const upd = patch => setB(prev => ({ ...prev, ...patch }))

  return <>
    <h3>{t(BLOCK_TYPES[b.type]?.label || b.type)}</h3>

    {(b.type === 'warmup' || b.type === 'cooldown' || b.type === 'steady') && <>
      <div className="small muted" style={{ marginBottom: 4 }}>{t('Duration')}</div>
      <DurationStepper value={b.duration || 5} onChange={v => upd({ duration: v })} min={1} max={120} label="min" />
    </>}

    {b.type === 'steady' && <>
      <div className="small muted" style={{ marginTop: 14, marginBottom: 4 }}>{t('Distance (optional)')}</div>
      <DurationStepper
        value={b.distKm != null ? b.distKm : 0}
        onChange={v => upd({ distKm: v > 0 ? v : null })}
        min={0} max={100} label="km"
      />
    </>}

    {b.type === 'interval' && <>
      <div className="small muted" style={{ marginBottom: 4 }}>{t('Repeats')}</div>
      <DurationStepper value={b.repeat || 1} onChange={v => upd({ repeat: v })} min={1} max={50} label="×" />

      <div className="small muted" style={{ marginTop: 14, marginBottom: 4 }}>{t('Work duration (seconds)')}</div>
      <DurationStepper value={b.workSec || 60} onChange={v => upd({ workSec: v })} min={10} max={600} label="s" />

      <div className="small muted" style={{ marginTop: 14, marginBottom: 4 }}>{t('Rest duration (seconds)')}</div>
      <DurationStepper value={b.restSec || 90} onChange={v => upd({ restSec: v })} min={10} max={600} label="s" />
    </>}

    {b.type !== 'interval' && <>
      <div className="small muted" style={{ marginTop: 14, marginBottom: 2 }}>{t('Intensity')}</div>
      <IntensityPicker value={b.intensity || 3} onChange={v => upd({ intensity: v })} />
    </>}

    {b.type === 'interval' && <>
      <div className="small muted" style={{ marginTop: 14, marginBottom: 2 }}>{t('Work intensity')}</div>
      <IntensityPicker value={b.workIntensity || 4} onChange={v => upd({ workIntensity: v })} />
      <div className="small muted" style={{ marginTop: 10, marginBottom: 2 }}>{t('Rest intensity')}</div>
      <IntensityPicker value={b.restIntensity || 2} onChange={v => upd({ restIntensity: v })} />
    </>}

    <div style={{ height: 16 }} />
    <Button variant="primary" onClick={() => { close(); onSave(b) }}>{t('Save block')}</Button>
  </>
}

function BlockTypePicker({ close, onPick }) {
  return <>
    <h3>{t('Add block')}</h3>
    <div className="list">
      {Object.entries(BLOCK_TYPES).map(([key, bt]) => (
        <div key={key} className="item" onClick={() => { close(); onPick(key) }}>
          <span className="lrow-i" style={{ background: bt.color }}><Icon name={bt.icon} /></span>
          <div className="grow"><div className="tt">{t(bt.label)}</div></div>
          <Icon name="chevronRight" className="chev" />
        </div>
      ))}
    </div>
  </>
}

/* ─── cardio block editor ─── */
function CardioEditor({ r, id, update }) {
  const { openSheet } = useUI()
  const blocks = r.blocks || []

  const editBlocks = fn => update(s => { fn(s.routines.find(x => x.id === id).blocks) })
  const move = (i, dir) => editBlocks(bl => { const j = i + dir; if (j < 0 || j >= bl.length) return;[bl[i], bl[j]] = [bl[j], bl[i]] })

  const openBlockConfig = (block, idx) => {
    openSheet(close => (
      <BlockConfigSheet block={block} close={close} onSave={updated => {
        editBlocks(bl => { bl[idx] = { ...updated } })
      }} />
    ))
  }

  const openBlockTypePicker = () => {
    openSheet(close => (
      <BlockTypePicker close={close} onPick={type => {
        const defaults = {
          warmup:   { type: 'warmup',   duration: 10, intensity: 1 },
          steady:   { type: 'steady',   duration: 20, intensity: 3, distKm: null },
          interval: { type: 'interval', repeat: 6, workSec: 60, restSec: 90, workIntensity: 4, restIntensity: 2 },
          cooldown: { type: 'cooldown', duration: 5,  intensity: 1 },
        }
        editBlocks(bl => { bl.push({ id: uid(), ...defaults[type] }) })
      }} />
    ))
  }

  const totalMin = routineTotalDuration(blocks)
  const sport = SPORTS[r.sport]

  return <>
    {sport && (
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 0 }}>
        <span className="lrow-i" style={{ background: 'var(--teal)' }}><Icon name={sport.icon} /></span>
        <div>
          <div style={{ fontWeight: 600 }}>{t(sport.label)}</div>
          <div className="dim small">{totalMin} min {t('total')}</div>
        </div>
      </div>
    )}

    {blocks.length ? (
      <div className="list" style={{ marginTop: 12 }}>
        {blocks.map((b, i) => {
          const bt = BLOCK_TYPES[b.type] || {}
          return (
            <div key={b.id || i} className="item" onClick={() => openBlockConfig(b, i)}>
              <span className="lrow-i" style={{ background: bt.color }}><Icon name={bt.icon} /></span>
              <div className="grow">
                <div className="tt">{t(bt.label || b.type)}</div>
                <div className="ss">{blockSummary(b)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="iconbtn" aria-label={t('Move up')} style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={ev => { ev.stopPropagation(); move(i, -1) }}><Icon name="chevronUp" /></button>
                  <button className="iconbtn" aria-label={t('Move down')} style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={ev => { ev.stopPropagation(); move(i, 1) }}><Icon name="chevronDown" /></button>
                </div>
                <button className="iconbtn" style={{ width: 28, height: 24, fontSize: 13, color: 'var(--red)' }} onClick={ev => { ev.stopPropagation(); editBlocks(bl => bl.splice(i, 1)) }}><Icon name="trash" /></button>
              </div>
            </div>
          )
        })}
      </div>
    ) : (
      <div className="empty"><div className="ico"><Icon name="bolt" /></div>{t('No blocks yet — add your first one.')}</div>
    )}

    <div style={{ height: 10 }} />
    <Button variant="primary" icon="plus" onClick={openBlockTypePicker}>{t('Add block')}</Button>
  </>
}

/* ─── main component ─── */
export default function RoutineEdit() {
  const nav = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const isNew = !!(location.state?.isNew)
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const r = S.routines.find(x => x.id === id)
  useEffect(() => { if (!r) nav('/plan') }, [!!r])
  if (!r) return null

  const isCardio = isCardioSport(r.sport)

  const handleBack = () => {
    if (isNew) {
      confirmSheet({
        title: t('Sauvegarder cette séance ?'),
        message: t('Si vous ne sauvegardez pas, la séance sera définitivement supprimée.'),
        confirmText: t('Sauvegarder'),
        cancelText: t('Supprimer'),
        onConfirm: () => nav('/plan', { replace: true }),
        onCancel: () => {
          update(s => {
            s.routines = s.routines.filter(x => x.id !== id)
            Object.keys(s.week).forEach(k => { if (s.week[k] === id) delete s.week[k] })
            Object.keys(s.dayPlan || {}).forEach(k => { if (s.dayPlan[k] === id) delete s.dayPlan[k] })
          })
          nav('/plan', { replace: true })
        },
      })
      return
    }
    window.history.state?.idx > 0 ? nav(-1) : nav('/plan', { replace: true })
  }

  const edit = fn => update(s => { fn(s.routines.find(x => x.id === id).ex) })
  const move = (i, dir) => edit(ex => { const j = i + dir; if (j < 0 || j >= ex.length) return;[ex[i], ex[j]] = [ex[j], ex[i]]; cleanupSg(ex) })
  const toggleLink = i => edit(ex => {
    if (i < 1) return
    const cur = ex[i], prev = ex[i - 1]
    if (cur.sg && prev.sg && cur.sg === prev.sg) delete cur.sg
    else { const gid = prev.sg || ('sg' + uid()); prev.sg = gid; cur.sg = gid }
    cleanupSg(ex)
  })

  const units = isCardio ? [] : supersetUnits(r.ex || [])
  const unitFirst = new Set(units.filter(u => u.length > 1).map(u => u[0]))
  const inSS = new Set(units.filter(u => u.length > 1).flat())
  const exOrder = {}
  units.forEach((unit, unitIdx) => {
    unit.forEach((exIdx, letterIdx) => {
      exOrder[exIdx] = { num: unitIdx + 1, letter: unit.length > 1 ? String.fromCharCode(65 + letterIdx) : null }
    })
  })

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={handleBack} aria-label={t('Plan')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px' }}>
        <input className="input" defaultValue={r.name} style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-.021em' }}
          onChange={e => update(s => { s.routines.find(x => x.id === id).name = e.target.value.trim() || t('Routine') })} />
      </div>
      <button className="iconbtn" aria-label={t('Pick an icon')} onClick={() => glyphPicker(r.emoji, g => update(s => { s.routines.find(x => x.id === id).emoji = g }))}><Icon name={glyphOf(r.emoji)} /></button>
    </div>

    {/* Cardio: block editor only */}
    {isCardio ? (
      <CardioEditor r={r} id={id} update={update} />
    ) : (
      <>
        <div className="sect-b" style={{ marginBottom: 16 }}>
          <SelectRow icon="chartLine" title={t('Progression')} sheetTitle={t('Progression')}
            value={r.prog || 'linear'} onChange={v => update(s => { s.routines.find(x => x.id === id).prog = v })}
            options={POLICIES_FOR.reps.map(p => ({ value: p, label: t(POLICY_NAME[p]), subtitle: t(POLICY_DESC[p]) }))} />
        </div>
        <div className="small dim" style={{ margin: '-10px 2px 16px' }}>
          {t('Applies to every exercise in this routine that does not set its own rule.')}
        </div>

        {(r.ex || []).length ? <div className="list">{(r.ex || []).map((e, i) => {
          const ex = exOr(e.id)
          const linkedPrev = i > 0 && e.sg && r.ex[i - 1].sg === e.sg
          return <div key={i}>
            {unitFirst.has(i) && <div className="ss-label"><Icon name="link" />{t('Superset')}</div>}
            <div className={'item' + (inSS.has(i) ? ' in-ss' : '')} onClick={() => {
              exConfigSheet(ex, e, cfg => edit(x => { x[i] = { id: x[i].id, sg: x[i].sg, ...cfg } }), () => edit(x => { x.splice(i, 1); cleanupSg(x) }), r)
            }}>
              {(() => {
                const ord = exOrder[i]
                if (!ord) return null
                const label = ord.letter ? `${ord.num}${ord.letter}` : `${ord.num}`
                return <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: ord.letter ? 'var(--acc)' : 'var(--surface-3)', color: ord.letter ? 'var(--on-acc)' : 'var(--label-2)' }}>{label}</span>
              })()}
              <Thumb ex={ex} />
              <div className="grow"><div className="tt capitalize">{ex.n}</div><div className="ss">{exLine(e, S.unit)}</div></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="iconbtn" aria-label={t('Switch exercise')} title={t('Switch exercise')} style={{ width: 28, height: 28, borderRadius: 8, fontSize: 14 }} onClick={ev => { ev.stopPropagation(); swapExerciseSheet(e.id, newEx => edit(x => { x[i] = { ...x[i], id: newEx.id } })) }}><Icon name="shuffle" /></button>
                  {i > 0 && <button className={'iconbtn' + (linkedPrev ? ' on-ss' : '')} title={t('Superset with exercise above')} style={{ width: 28, height: 28, borderRadius: 8, fontSize: 15 }} onClick={ev => { ev.stopPropagation(); toggleLink(i) }}><Icon name="link" /></button>}
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="iconbtn" aria-label={t('Move up')} style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={ev => { ev.stopPropagation(); move(i, -1) }}><Icon name="chevronUp" /></button>
                  <button className="iconbtn" aria-label={t('Move down')} style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={ev => { ev.stopPropagation(); move(i, 1) }}><Icon name="chevronDown" /></button>
                </div>
              </div>
            </div>
          </div>
        })}</div> : <div className="empty"><div className="ico"><Icon name="dumbbell" /></div>{t('No exercises yet — add your first one.')}</div>}

        {(r.ex || []).length > 0 && (() => {
          const load = loadOfRoutine(r)
          const { worked } = rankOf(load)
          return <div className="card" style={{ marginTop: 12 }}>
            <h2>{t('What this session hits')}</h2>
            <BodyMap load={load} body={S.body} />
            <div className="mchips">
              {worked.slice(0, 6).map(m => <span key={m} className="mchip">{t(MUSCLE_NAME[m])}</span>)}
            </div>
          </div>
        })()}

        <div className="small dim row" style={{ margin: '10px 2px', gap: 5 }}><Icon name="link" style={{ fontSize: 13 }} />{t("Tap the link button on an exercise to superset it with the one above — you'll do them back-to-back.")}</div>
        <Button variant="primary" onClick={() => exercisePicker(ex => exConfigSheet(ex, null, cfg => edit(x => { x.push({ id: ex.id, ...cfg }) }), null, r))} icon="plus">{t('Add exercise')}</Button>
      </>
    )}

    <div style={{ height: 10 }} />
    <Button variant="danger" onClick={() => confirmSheet({
      title: t('Delete routine?'), message: t('"{0}" will be removed. Your workout history is preserved.', r.name), confirmText: t('Delete'), danger: true,
      onConfirm: () => {
        update(s => {
          s.routines = s.routines.filter(x => x.id !== id)
          Object.keys(s.week).forEach(k => { if (s.week[k] === id) delete s.week[k] })
          Object.keys(s.dayPlan).forEach(k => { if (s.dayPlan[k] === id) delete s.dayPlan[k] })
        })
        nav('/plan')
      }
    })}>{t('Delete routine')}</Button>
  </div>
}
