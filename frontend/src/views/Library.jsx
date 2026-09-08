import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { EXDB, BODYPARTS, allExercises, equipmentOf } from '../lib/exercises.js'
import { bestWeightFor } from '../lib/history.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { Thumb } from '../components/Media.jsx'
import { exerciseDetailSheet, addToRoutineSheet, customExSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, SearchField } from '../components/ui.jsx'

const BP_COLOR = {
  chest:       'var(--acc)',
  back:        'var(--blue)',
  shoulders:   'var(--purple)',
  'upper arms': 'var(--orange)',
  'lower arms': 'var(--yellow)',
  waist:       'var(--teal)',
  'upper legs': 'var(--pink, var(--red))',
  'lower legs': 'var(--indigo, var(--blue))',
  neck:        'var(--label-3)',
  cardio:      'var(--teal)',
}
function bpColor(bp) { return BP_COLOR[bp] || 'var(--label-3)' }

export default function Library() {
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const [bp, setBp] = useState('')
  const [eq, setEq] = useState('')
  const [shown, setShown] = useState(40)
  const ql = q.toLowerCase().trim()
  const base = allExercises(S).filter(e => (!bp || e.bp === bp) && (!ql || e.n.toLowerCase().includes(ql) || e.tg.includes(ql) || e.eq.includes(ql) || (e.desc || '').toLowerCase().includes(ql)))
  const eqOpts = equipmentOf(base)
  const eqOn = eqOpts.includes(eq) ? eq : ''
  const f = eqOn ? base.filter(e => e.eq === eqOn) : base
  const activeBpColor = bp ? bpColor(bp) : null

  return <>
    <div className="hdr"><div><h1>{t('Exercises')}</h1><div className="sub">{t('{0} exercises with animations', EXDB.length)}</div></div></div>
    <div style={{ marginBottom: 10 }}>
      <SearchField value={q} onChange={e => { setQ(e.target.value); setShown(40) }} onClear={() => { setQ(''); setShown(40) }} placeholder={t('Search…')} />
    </div>

    {/* Body part chips with color dots */}
    <div className="chips" style={{ marginBottom: eqOpts.length > 1 ? 8 : 12 }}>
      <button className={'chip nocap' + (!bp ? ' on' : '')} onClick={() => { setBp(''); setEq(''); setShown(40) }}>{t('All')}</button>
      {BODYPARTS.map(b => {
        const c = bpColor(b)
        const isOn = bp === b
        return (
          <button
            key={b}
            className={'chip' + (isOn ? ' on' : '')}
            style={isOn ? { background: `color-mix(in srgb,${c} 20%,var(--surface-2))`, color: c, borderColor: `color-mix(in srgb,${c} 35%,transparent)` } : {}}
            onClick={() => { setBp(b); setEq(''); setShown(40) }}
          >
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: c, marginRight: 5, flexShrink: 0, verticalAlign: 'middle', marginBottom: 1 }} />
            {t(b)}
          </button>
        )
      })}
    </div>

    {eqOpts.length > 1 && <div className="chips" style={{ marginBottom: 12 }}>
      <button className={'chip nocap' + (!eqOn ? ' on' : '')} onClick={() => { setEq(''); setShown(40) }}>{t('Any equipment')}</button>
      {eqOpts.map(x => <button key={x} className={'chip' + (eqOn === x ? ' on' : '')} onClick={() => { setEq(x); setShown(40) }}>{t(x)}</button>)}
    </div>}

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

      {f.slice(0, shown).map(e => {
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
                <span style={{ color: c, fontWeight: 600, fontSize: 12 }}>{t(e.tg || e.bp)}</span>
                <span style={{ color: 'var(--label-4)' }}>·</span>
                {t(e.eq)}
              </div>
            </div>
            {best > 0 && <span className="tag nocap pr-ref">{fmtNum(best)}</span>}
            <Button size="sm" variant="tinted" icon="plus" onClick={ev => { ev.stopPropagation(); addToRoutineSheet(e) }}>{t('Plan')}</Button>
          </div>
        )
      })}
      {f.length === 0 && <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>}
    </div>
    {f.length > shown && <><div style={{ height: 10 }} /><Button onClick={() => setShown(s => s + 40)}>{t('Show more')}</Button></>}
  </>
}
