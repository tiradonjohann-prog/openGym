// frontend/src/views/Library.jsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { EXDB, BODYPARTS, allExercises, musclesOf } from '../lib/exercises.js'
import { bodyPartLabel, equipmentLabel, mechanicsLabel, lateralityLabel, muscleLabel } from '../lib/exerciseLabels.js'
import { bestWeightFor } from '../lib/history.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { Thumb } from '../components/Media.jsx'
import { exerciseDetailSheet, addToRoutineSheet, customExSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, SearchField, SelectRow } from '../components/ui.jsx'

const BP_COLOR = {
  ABS: 'var(--teal)', BACK: 'var(--blue)', BICEPS: 'var(--orange)', CHEST: 'var(--acc)',
  FOREARMS: 'var(--yellow)', GLUTEUS: 'var(--pink, var(--red))', LEGS: 'var(--indigo, var(--blue))',
  SHOULDERS: 'var(--purple)', TRICEPS: 'var(--orange)', CARDIO: 'var(--teal)',
}
function bpColor(bp) { return BP_COLOR[bp] || 'var(--label-3)' }

const ACTIVATION_THRESHOLDS = [0, 10, 25, 50, 75]

function uniq(arr) { return [...new Set(arr.filter(Boolean))].sort() }

function equipmentListOf(ex) { return Array.isArray(ex.equipments) ? ex.equipments : [] }

function matchesFilters(ex, f, ql) {
  if (f.bp && ex.bp !== f.bp) return false
  if (f.mechanics && ex.mechanics !== f.mechanics) return false
  if (f.laterality && ex.laterality !== f.laterality) return false
  if (f.equipment) {
    const eq = equipmentListOf(ex)
    if (f.equipment === 'Bodyweight') { if (eq.length !== 0) return false }
    else if (!eq.includes(f.equipment)) return false
  }
  if (f.muscle || f.activation > 0) {
    const muscles = musclesOf(ex)
    if (f.muscle) {
      const match = muscles.find(m => m.key === f.muscle)
      if (!match) return false
      if (f.activation > 0 && match.value < f.activation) return false
    } else if (!muscles.some(m => m.value >= f.activation)) return false
  }
  if (ql && !(ex.n.toLowerCase().includes(ql) || (ex.desc || '').toLowerCase().includes(ql))) return false
  return true
}

export default function Library() {
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({ bp: '', equipment: '', mechanics: '', laterality: '', muscle: '', activation: 0 })
  const [showFilters, setShowFilters] = useState(false)
  const [shown, setShown] = useState(40)
  const ql = q.toLowerCase().trim()
  const nav = useNavigate()

  const base = useMemo(() => allExercises(S).filter(e => matchesFilters(e, filters, ql)), [S, filters, ql])

  const opts = useMemo(() => ({
    equipments: uniq(base.flatMap(equipmentListOf)),
    mechanics: uniq(base.map(e => e.mechanics)),
    lateralities: uniq(base.map(e => e.laterality)),
    muscles: uniq(base.flatMap(e => musclesOf(e).map(m => m.key))),
  }), [base])

  const hasFilter = Object.entries(filters).some(([k, v]) => k === 'activation' ? v > 0 : Boolean(v))
  const set = key => e => { setFilters(f => ({ ...f, [key]: e.target.value })); setShown(40) }
  const reset = () => { setFilters({ bp: '', equipment: '', mechanics: '', laterality: '', muscle: '', activation: 0 }); setShown(40) }

  return <>
    <div className="hdr">
      <div><h1>{t('Exercises')}</h1><div className="sub">{t('{0} exercises with animations', EXDB.length)}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>
    <div style={{ marginBottom: 10 }}>
      <SearchField value={q} onChange={e => { setQ(e.target.value); setShown(40) }} onClear={() => { setQ(''); setShown(40) }} placeholder={t('Search…')} />
    </div>

    {/* Body part chips with color dots */}
    <div className="chips" style={{ marginBottom: 8 }}>
      <button className={'chip nocap' + (!filters.bp ? ' on' : '')} onClick={() => setFilters(f => ({ ...f, bp: '' }))}>{t('All')}</button>
      {BODYPARTS.map(b => {
        const c = bpColor(b)
        const isOn = filters.bp === b
        return (
          <button
            key={b}
            className={'chip' + (isOn ? ' on' : '')}
            style={isOn ? { background: `color-mix(in srgb,${c} 20%,var(--surface-2))`, color: c, borderColor: `color-mix(in srgb,${c} 35%,transparent)` } : {}}
            onClick={() => setFilters(f => ({ ...f, bp: b }))}
          >
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: c, marginRight: 5, flexShrink: 0, verticalAlign: 'middle', marginBottom: 1 }} />
            {bodyPartLabel(b)}
          </button>
        )
      })}
    </div>

    {/* Equipment chips — same row style as body parts */}
    <div className="chips" style={{ marginBottom: 8 }}>
      <button className={'chip nocap' + (!filters.equipment ? ' on' : '')} onClick={() => setFilters(f => ({ ...f, equipment: '' }))}>{t('Any equipment')}</button>
      <button className={'chip nocap' + (filters.equipment === 'Bodyweight' ? ' on' : '')} onClick={() => setFilters(f => ({ ...f, equipment: 'Bodyweight' }))}>{t('Bodyweight only')}</button>
      {opts.equipments.map(x => (
        <button key={x} className={'chip' + (filters.equipment === x ? ' on' : '')} onClick={() => setFilters(f => ({ ...f, equipment: x }))}>
          {equipmentLabel(x)}
        </button>
      ))}
    </div>

    <button className="chip nocap" style={{ marginBottom: 12 }} onClick={() => setShowFilters(s => !s)}>
      <Icon name="filter" /> {t('More filters')} {hasFilter && <span className="tag acc" style={{ marginLeft: 4 }}>•</span>}
    </button>

    {showFilters && <div className="sect-b" style={{ marginBottom: 12 }}>
      <SelectRow
        title={t('Mechanics')}
        value={filters.mechanics}
        onChange={v => { setFilters(f => ({ ...f, mechanics: v })); setShown(40) }}
        options={[{ value: '', label: t('All') }, ...opts.mechanics.map(x => ({ value: x, label: mechanicsLabel(x) }))]}
      />
      <SelectRow
        title={t('Laterality')}
        value={filters.laterality}
        onChange={v => { setFilters(f => ({ ...f, laterality: v })); setShown(40) }}
        options={[{ value: '', label: t('All') }, ...opts.lateralities.map(x => ({ value: x, label: lateralityLabel(x) }))]}
      />
      <SelectRow
        title={t('Muscle')}
        value={filters.muscle}
        onChange={v => { setFilters(f => ({ ...f, muscle: v })); setShown(40) }}
        options={[{ value: '', label: t('All') }, ...opts.muscles.map(x => ({ value: x, label: muscleLabel(x) }))]}
      />
      <SelectRow
        title={t('Minimum activation')}
        value={filters.activation}
        onChange={v => { setFilters(f => ({ ...f, activation: Number(v) })); setShown(40) }}
        options={ACTIVATION_THRESHOLDS.map(v => ({ value: v, label: v === 0 ? t('Any') : `≥ ${v}%` }))}
      />
    </div>}
    {showFilters && hasFilter && <div style={{ marginBottom: 12 }}><Button size="sm" variant="tinted" onClick={reset}>{t('Reset filters')}</Button></div>}

    <div className="list">
      {/* Create custom exercise — accent entry */}
      <div className="item" onClick={() => customExSheet(null, ex => exerciseDetailSheet(ex), q.trim())}
        style={{ background: `linear-gradient(135deg,color-mix(in srgb,var(--acc) 7%,var(--surface)),var(--surface))` }}>
        <div className="thumb thumb-x" style={{ background: 'color-mix(in srgb,var(--acc) 16%,var(--surface-2))', color: 'var(--acc)' }}>
          <Icon name="sparkles" />
        </div>
        <div className="grow">
          <div className="tt">{t('Create your own exercise')}</div>
          <div className="ss">{t('name + body part, no animation')}</div>
        </div>
        <Icon name="plus" className="chev" style={{ color: 'var(--acc)' }} />
      </div>

      {base.slice(0, shown).map(e => {
        const best = bestWeightFor(S, e.id)
        const c = bpColor(e.bp)
        return (
          <div key={e.id} className="item" onClick={() => exerciseDetailSheet(e)}
            style={{ borderLeft: `3px solid color-mix(in srgb,${c} 50%,transparent)` }}>
            <Thumb ex={e} />
            <div className="grow">
              <div className="tt capitalize">{e.n}</div>
              <div className="ss capitalize" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
                <span style={{ color: c, fontWeight: 600, fontSize: 12 }}>{e.tg ? muscleLabel(e.tg) : bodyPartLabel(e.bp)}</span>
                <span style={{ color: 'var(--label-4)' }}>·</span>
                {equipmentLabel(e.eq)}
              </div>
            </div>
            {best > 0 && <span className="tag nocap pr-ref">{fmtNum(best)}</span>}
            <Button size="sm" variant="tinted" icon="plus" onClick={ev => { ev.stopPropagation(); addToRoutineSheet(e) }}>{t('Plan')}</Button>
          </div>
        )
      })}
      {base.length === 0 && <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>}
    </div>
    {base.length > shown && <><div style={{ height: 10 }} /><Button onClick={() => setShown(s => s + 40)}>{t('Show more')}</Button></>}
  </>
}
