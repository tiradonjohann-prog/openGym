import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { supersetUnits, cleanupSg, exLine } from '../lib/history.js'
import { SPORTS, BLOCK_TYPES, INTENSITIES, isCardioSport, blockSummary, blockDurationMin, routineTotalDuration, isHybrid, hybridExItems } from '../lib/sports.js'
import { Thumb } from '../components/Media.jsx'
import { glyphPicker, exercisePicker, exConfigSheet, confirmSheet, swapExerciseSheet } from '../sheets.jsx'
import { pickImage, isUserImage } from '../lib/imageUtils.js'
import Icon from '../components/Icon.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button, SelectRow, Switch } from '../components/ui.jsx'
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


/* ─── multi-block cardio picker ─── */
const BLOCK_DEFAULTS = {
  warmup:   { type: 'warmup',   duration: 10, intensity: 1 },
  steady:   { type: 'steady',   duration: 20, intensity: 3 },
  interval: { type: 'interval', repeat: 6, workSec: 60, restSec: 90, workIntensity: 4, restIntensity: 2 },
  cooldown: { type: 'cooldown', duration: 5,  intensity: 1 },
}

// fixedSport: set for pure-cardio sessions (blocks go to r.blocks, sport already on routine)
// null: hybrid mode (sport picker shown first, blocks go to r.items with sport per block)
function CardioBlocksPickerSheet({ routineId, close, fixedSport = null }) {
  const updateStore = useStore(s => s.update)
  const { openSheet } = useUI()
  const [sport, setSport] = useState(fixedSport)
  // Pure cardio: nothing pre-selected, user must choose at least one
  // Hybrid: warmup + steady + cooldown pre-selected as sensible defaults
  const [selected, setSelected] = useState(
    fixedSport
      ? { warmup: false, steady: false, interval: false, cooldown: false }
      : { warmup: true, steady: true, interval: false, cooldown: true }
  )

  const toggle = key => setSelected(prev => ({ ...prev, [key]: !prev[key] }))
  const anySelected = Object.values(selected).some(Boolean)

  const confirm = () => {
    const selectedTypes = Object.entries(BLOCK_TYPES)
      .filter(([key]) => selected[key])
      .map(([type]) => type)

    const configured = []

    const configureNext = idx => {
      if (idx >= selectedTypes.length) {
        updateStore(s => {
          const rt = s.routines.find(x => x.id === routineId)
          if (fixedSport) {
            if (!rt.blocks) rt.blocks = []
            rt.blocks.push(...configured)
          } else {
            if (!rt.items) { rt.items = (rt.ex || []).map(e => ({ kind: 'ex', ...e })); delete rt.ex }
            rt.items.push(...configured.map(b => ({ kind: 'block', sport, ...b })))
          }
        })
        return
      }
      const type = selectedTypes[idx]
      const draft = { id: uid(), ...BLOCK_DEFAULTS[type] }
      openSheet(sheetClose => (
        <BlockConfigSheet
          block={draft}
          close={sheetClose}
          onSave={cfg => {
            configured.push({ ...cfg, id: uid() })
            configureNext(idx + 1)
          }}
        />
      ))
    }

    close()
    configureNext(0)
  }

  if (!sport) {
    const cardioSports = Object.entries(SPORTS).filter(([, sp]) => sp.cardio)
    return <>
      <h3>{t('Ajouter blocs cardio')}</h3>
      <div className="small muted" style={{ marginBottom: 12 }}>{t('Choisissez un sport')}</div>
      <div className="list">
        {cardioSports.map(([key, sp]) => (
          <div key={key} className="item" onClick={() => setSport(key)}>
            <span className="lrow-i" style={{ background: 'var(--teal)' }}><Icon name={sp.icon} /></span>
            <div className="grow"><div className="tt">{t(sp.label)}</div></div>
            <Icon name="chevronRight" className="chev" />
          </div>
        ))}
      </div>
      <div style={{ height: 8 }} />
      <Button onClick={close}>{t('Annuler')}</Button>
    </>
  }

  const sp = SPORTS[sport]
  return <>
    <h3>{t('Blocs cardio')}</h3>
    {!fixedSport && sp && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--sep)' }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={sp.icon} style={{ color: '#fff' }} />
        </span>
        <div style={{ flex: 1, fontWeight: 500 }}>{t(sp.label)}</div>
        <button className="iconbtn" onClick={() => setSport(null)} aria-label={t('Change sport')}><Icon name="shuffle" /></button>
      </div>
    )}
    <div className="small muted" style={{ marginBottom: 8 }}>{t('Sélectionnez les blocs à ajouter')}</div>
    <div className="list" style={{ marginBottom: 16 }}>
      {Object.entries(BLOCK_TYPES).map(([key, bt]) => (
        <div key={key} className="item" onClick={() => toggle(key)} style={{ cursor: 'pointer' }}>
          <span className="lrow-i" style={{ background: selected[key] ? bt.color : 'var(--surface-3)', transition: 'background .2s' }}>
            <Icon name={bt.icon} />
          </span>
          <div className="grow"><div className="tt">{t(bt.label)}</div></div>
          <span onClick={e => e.stopPropagation()}>
            <Switch checked={!!selected[key]} onChange={() => toggle(key)} />
          </span>
        </div>
      ))}
    </div>
    <Button variant="primary" disabled={!anySelected} onClick={confirm} icon="plus">{t('Ajouter')}</Button>
    <div style={{ height: 8 }} />
    <Button onClick={close}>{t('Annuler')}</Button>
  </>
}

/* ─── cardio block editor ─── */
function CardioEditor({ r, id, update, onAddExercise }) {
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
    openSheet(close => <CardioBlocksPickerSheet routineId={id} close={close} fixedSport={r.sport} />)
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
    <div style={{ display: 'flex', gap: 8 }}>
      <Button variant="primary" style={{ flex: 1 }} icon="plus" onClick={openBlockTypePicker}>{t('Add block')}</Button>
      {onAddExercise && (
        <Button style={{ flex: 1 }} icon="dumbbell" onClick={onAddExercise}>{t('Add exercise')}</Button>
      )}
    </div>
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
  const [initSnap] = useState(() => r ? JSON.stringify(r) : null)
  const [showNameError, setShowNameError] = useState(false)
  useEffect(() => { if (!r) nav('/plan') }, [!!r])
  if (!r) return null
  const isDirty = JSON.stringify(r) !== initSnap

  const isCardio = isCardioSport(r.sport)
  const hybrid = isHybrid(r)
  const { openSheet } = useUI()

  const deleteSession = () => {
    update(s => {
      s.routines = s.routines.filter(x => x.id !== id);
      (s.programmes || []).forEach(p => { p.routineIds = (p.routineIds || []).filter(rid => rid !== id) });
      Object.keys(s.week).forEach(k => { if (s.week[k] === id) delete s.week[k] });
      Object.keys(s.dayPlan || {}).forEach(k => { if (s.dayPlan[k] === id) delete s.dayPlan[k] });
    })
    nav('/plan', { replace: true })
  }

  const moveItem = (i, dir) => update(s => {
    const items = s.routines.find(x => x.id === id).items
    const j = i + dir
    if (j < 0 || j >= items.length) return
    ;[items[i], items[j]] = [items[j], items[i]]
  })

  const addCardioBlock = () => {
    openSheet(close => <CardioBlocksPickerSheet routineId={id} close={close} />)
  }

  const addExerciseToCardioSession = () => {
    update(s => {
      const rt = s.routines.find(x => x.id === id)
      const sportKey = rt.sport
      rt.items = (rt.blocks || []).map(b => ({ kind: 'block', id: b.id || uid(), sport: sportKey, ...b }))
      delete rt.blocks
      rt.sport = null
    })
    exercisePicker(ex => exConfigSheet(ex, null, cfg => update(s => {
      s.routines.find(x => x.id === id).items.push({ kind: 'ex', id: ex.id, ...cfg })
    }), null, r))
  }

  const handleBack = () => {
    if (isNew) {
      const isEmpty = !isCardio && (r.ex || []).length === 0 && !(r.items || []).length
      if (isEmpty) { deleteSession(); return }
      confirmSheet({
        title: t('Sauvegarder cette séance ?'),
        message: t('Si vous ne sauvegardez pas, la séance sera définitivement supprimée.'),
        confirmText: t('Sauvegarder'),
        cancelText: t('Supprimer'),
        onConfirm: () => nav('/plan', { replace: true }),
        onCancel: deleteSession,
      })
      return
    }
    window.history.state?.idx > 0 ? nav(-1) : nav('/plan', { replace: true })
  }

  const isNameOk = r.name && r.name.trim() && r.name !== t('Nouvelle séance')
  const canSave = isNew ? (isCardio || (r.ex || []).length > 0 || (r.items || []).length > 0) : isDirty

  const handleSave = () => {
    if (isNew && !isNameOk) {
      setShowNameError(true)
      useUI.getState().openSheet(errClose => (
        <div style={{ textAlign: 'center', padding: '8px 4px' }}>
          <Icon name="info" style={{ fontSize: 52, color: 'var(--yellow)', marginBottom: 14 }} />
          <h3 style={{ marginBottom: 6 }}>{t('Nommez votre séance')}</h3>
          <p className="muted small" style={{ marginBottom: 20 }}>{t('Donnez un nom à cette séance avant de pouvoir la sauvegarder.')}</p>
          <Button variant="primary" style={{ width: '100%' }} onClick={errClose}>{t('OK')}</Button>
        </div>
      ), { kind: 'center' })
      return
    }
    const savedName = r.name
    useUI.getState().openSheet(successClose => (
      <div style={{ textAlign: 'center', padding: '8px 4px' }}>
        <Icon name="checkCircle" style={{ fontSize: 52, color: 'var(--teal)', marginBottom: 14 }} />
        <h3 style={{ marginBottom: 6 }}>{t('Séance sauvegardée !')}</h3>
        <p className="muted small" style={{ marginBottom: 20 }}>{savedName}</p>
        <Button variant="primary" style={{ width: '100%' }} onClick={() => { successClose(); nav('/plan', { replace: true }) }}>{t('OK')}</Button>
      </div>
    ), { kind: 'center' })
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
        <input className="input" defaultValue={r.name}
          style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-.021em', ...(showNameError ? { outline: '2px solid var(--red)', borderRadius: 6 } : {}) }}
          onChange={e => {
            const val = e.target.value.trim() || t('Séance')
            update(s => { s.routines.find(x => x.id === id).name = val })
            if (showNameError && val !== t('Nouvelle séance')) setShowNameError(false)
          }} />
      </div>
      {!isCardio && <button className="iconbtn" aria-label={t('Pick an icon')} onClick={() => glyphPicker(r.emoji, g => update(s => { s.routines.find(x => x.id === id).emoji = g }))}><Icon name={glyphOf(r.emoji)} /></button>}
      <button className="iconbtn" onClick={handleBack} aria-label={t('Done')} style={{ color: 'var(--acc)', fontWeight: 700 }}>
        <Icon name="checkmark" />
      </button>
    </div>
    {showNameError && isNew && (
      <div style={{ color: 'var(--red)', fontSize: 12, margin: '4px 2px 12px', padding: '7px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 8, lineHeight: 1.5 }}>
        {t('Donnez un nom à cette séance avant de sauvegarder.')}
      </div>
    )}

    {/* ── cover image ── */}
    {r.imageUrl ? (
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ position: 'relative', width: 120, height: 120, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)' }}>
          <img src={r.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: 6, boxSizing: 'border-box' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.68) 100%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 7, left: 7, right: 7, fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-.01em', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            {r.name}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
          <button
            onClick={async () => { const url = await pickImage(); if (url) update(s => { s.routines.find(x => x.id === id).imageUrl = url }) }}
            style={{ background: 'var(--surface-3)', border: 'none', borderRadius: 8, padding: '8px 14px', color: 'var(--label)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >{t('Changer')}</button>
          {isUserImage(r.imageUrl) && (
            <button
              onClick={() => update(s => { s.routines.find(x => x.id === id).imageUrl = null })}
              style={{ background: 'rgba(220,38,38,0.1)', border: 'none', borderRadius: 8, padding: '8px 14px', color: 'var(--red)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >{t('Supprimer')}</button>
          )}
        </div>
      </div>
    ) : (
      <button
        onClick={async () => { const url = await pickImage(); if (url) update(s => { s.routines.find(x => x.id === id).imageUrl = url }) }}
        style={{
          width: 120, height: 120, marginBottom: 16, borderRadius: 12,
          border: '1.5px dashed var(--sep)', background: 'var(--surface-2)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          color: 'var(--label-3)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}
      >
        <Icon name="photo" style={{ fontSize: 22 }} />
        {t('Ajouter photo')}
      </button>
    )}

    {/* Cardio: block editor — also shows "Add exercise" to convert to hybrid */}
    {isCardio ? (
      <CardioEditor r={r} id={id} update={update} onAddExercise={addExerciseToCardioSession} />
    ) : (
      <>
        <div className="sect-b" style={{ marginBottom: 16 }}>
          <SelectRow icon="chartLine" title={t('Progression')} sheetTitle={t('Progression')}
            value={r.prog || 'linear'} onChange={v => update(s => { s.routines.find(x => x.id === id).prog = v })}
            options={POLICIES_FOR.reps.map(p => ({ value: p, label: t(POLICY_NAME[p]), subtitle: t(POLICY_DESC[p]) }))} />
        </div>
        <div className="small dim" style={{ margin: '-10px 2px 16px' }}>
          {t('S\'applique à chaque exercice de cette séance qui ne définit pas sa propre règle.')}
        </div>

        {hybrid ? (
          /* ── Hybrid list: exercises + cardio blocks interleaved ── */
          (r.items || []).length ? (
            <div className="list">
              {(r.items || []).map((item, i) => {
                const numBadge = <span style={{ minWidth: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontSize: 13, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', background: item.kind === 'block' ? 'color-mix(in srgb, var(--teal) 15%, var(--surface-2))' : 'var(--surface-2)', color: item.kind === 'block' ? 'var(--teal)' : 'var(--label-2)', border: '1.5px solid var(--sep)' }}>{i + 1}</span>
                if (item.kind === 'block') {
                  const bt = BLOCK_TYPES[item.type] || {}
                  const sp = SPORTS[item.sport] || {}
                  return (
                    <div key={item.id || i} className="item" style={{ borderLeft: '3px solid var(--teal)' }}
                      onClick={() => openSheet(close => (
                        <BlockConfigSheet block={item} close={close} onSave={configured => {
                          update(s => {
                            const rt = s.routines.find(x => x.id === id)
                            rt.items[i] = { kind: 'block', id: item.id, sport: item.sport, ...configured }
                          })
                        }} />
                      ))}>
                      {numBadge}
                      <span className="lrow-i" style={{ background: 'var(--teal)' }}><Icon name={sp.icon || 'bolt'} /></span>
                      <div className="grow">
                        <div className="tt">{t(sp.label || item.sport)} <span className="dim" style={{ fontSize: 12 }}>· {t(bt.label || item.type)}</span></div>
                        <div className="ss">{blockSummary(item)}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button className="iconbtn" style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={ev => { ev.stopPropagation(); moveItem(i, -1) }}><Icon name="chevronUp" /></button>
                          <button className="iconbtn" style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={ev => { ev.stopPropagation(); moveItem(i, 1) }}><Icon name="chevronDown" /></button>
                        </div>
                        <button className="iconbtn" style={{ width: 28, height: 24, fontSize: 13, color: 'var(--red)' }} onClick={ev => { ev.stopPropagation(); update(s => { s.routines.find(x => x.id === id).items.splice(i, 1) }) }}><Icon name="trash" /></button>
                      </div>
                    </div>
                  )
                }
                const ex = exOr(item.id)
                return (
                  <div key={item.id || i} className="item"
                    onClick={() => exConfigSheet(ex, item, cfg => update(s => {
                      const rt = s.routines.find(x => x.id === id)
                      rt.items[i] = { kind: 'ex', id: item.id, ...cfg }
                    }), () => update(s => { s.routines.find(x => x.id === id).items.splice(i, 1) }), r)}>
                    {numBadge}
                    <Thumb ex={ex} />
                    <div className="grow"><div className="tt capitalize">{ex.n}</div><div className="ss">{exLine(item, S.unit)}</div></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="iconbtn" aria-label={t('Switch exercise')} style={{ width: 28, height: 28, borderRadius: 8, fontSize: 14 }} onClick={ev => { ev.stopPropagation(); swapExerciseSheet(item.id, newEx => update(s => { s.routines.find(x => x.id === id).items[i] = { ...s.routines.find(x => x.id === id).items[i], id: newEx.id } })) }}><Icon name="shuffle" /></button>
                      </div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="iconbtn" style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={ev => { ev.stopPropagation(); moveItem(i, -1) }}><Icon name="chevronUp" /></button>
                        <button className="iconbtn" style={{ width: 28, height: 24, borderRadius: 7, fontSize: 12 }} onClick={ev => { ev.stopPropagation(); moveItem(i, 1) }}><Icon name="chevronDown" /></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty"><div className="ico"><Icon name="dumbbell" /></div>{t('No exercises yet — add your first one.')}</div>
          )
        ) : (
          /* ── Pure strength list ── */
          (r.ex || []).length ? <div className="list">{(r.ex || []).map((e, i) => {
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
                  return <span style={{ minWidth: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontSize: 13, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', background: ord.letter ? 'var(--acc)' : 'var(--surface-2)', color: ord.letter ? 'var(--on-acc)' : 'var(--label-2)', border: `1.5px solid ${ord.letter ? 'transparent' : 'var(--sep)'}` }}>{label}</span>
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
          })}</div> : <div className="empty"><div className="ico"><Icon name="dumbbell" /></div>{t('No exercises yet — add your first one.')}</div>
        )}

        {(() => {
          const exList = hybrid ? hybridExItems(r) : (r.ex || [])
          if (!exList.length) return null
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

        {!hybrid && <div className="small dim row" style={{ margin: '10px 2px', gap: 5 }}><Icon name="link" style={{ fontSize: 13 }} />{t("Tap the link button on an exercise to superset it with the one above — you'll do them back-to-back.")}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Button variant="primary" style={{ flex: 1 }} onClick={() => {
            if (hybrid) {
              exercisePicker(ex => exConfigSheet(ex, null, cfg => update(s => {
                s.routines.find(x => x.id === id).items.push({ kind: 'ex', id: ex.id, ...cfg })
              }), null, r))
            } else {
              exercisePicker(ex => exConfigSheet(ex, null, cfg => edit(x => { x.push({ id: ex.id, ...cfg }) }), null, r))
            }
          }} icon="plus">{t('Add exercise')}</Button>
          <Button style={{ flex: 1 }} onClick={addCardioBlock} icon="bolt">{t('+ Cardio')}</Button>
        </div>
      </>
    )}

    <div style={{ height: 10 }} />
    <Button variant="primary" onClick={handleSave} disabled={!canSave} style={{ opacity: canSave ? 1 : 0.45 }}>
      {t('Sauvegarder')}
    </Button>
    <div style={{ height: 10 }} />
    <Button variant="danger" onClick={() => confirmSheet({
      title: t('Supprimer la séance ?'), message: t('"{0}" will be removed. Your workout history is preserved.', r.name), confirmText: t('Delete'), danger: true,
      onConfirm: () => {
        update(s => {
          s.routines = s.routines.filter(x => x.id !== id)
          Object.keys(s.week).forEach(k => { if (s.week[k] === id) delete s.week[k] })
          Object.keys(s.dayPlan).forEach(k => { if (s.dayPlan[k] === id) delete s.dayPlan[k] })
        })
        nav('/plan')
      }
    })}>{t('Supprimer la séance')}</Button>
  </div>
}
