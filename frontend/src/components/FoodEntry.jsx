import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { scaleItem } from '../lib/foodSearch.js'
import { t } from '../lib/i18n.js'
import { uid } from '../lib/format.js'
import { NumberField, Button } from './ui.jsx'
import Icon from './Icon.jsx'

function useFavoriteSave() {
  const update = useStore(s => s.update)
  const favorites = useStore(s => s.S.nutritionFavorites || [])
  return (item) => {
    const base = { id: uid(), name: item.name, qty: item.qty || 100, unit: item.unit || 'g', kcal: item.kcal, prot: item.prot, carbs: item.carbs, fat: item.fat, fiber: item.fiber, source: item.source || 'manual', complete: item.complete ?? true, savedAt: Date.now() }
    if (favorites.some(f => f.name === item.name)) return false
    update(s => { if (!s.nutritionFavorites) s.nutritionFavorites = []; s.nutritionFavorites.unshift(base) })
    return true
  }
}

// Lets the user adjust the gram quantity of a food item (from OFF or manual)
// before adding it to the meal slot.
export function FoodQty({ item, onAdd, onCancel }) {
  const [qty, setQty] = useState(item.qty || 100)
  const [saved, setSaved] = useState(false)
  const saveToFavorites = useFavoriteSave()

  const scaled = scaleItem(item, qty)
  const macroLine = [
    scaled.prot  != null ? scaled.prot  + 'g P' : null,
    scaled.carbs != null ? scaled.carbs + 'g C' : null,
    scaled.fat   != null ? scaled.fat   + 'g F' : null,
  ].filter(Boolean).join(' · ')

  const handleFavorite = () => {
    const ok = saveToFavorites(item)
    if (ok) setSaved(true)
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <p style={{ fontSize: 17, fontWeight: 600, margin: 0, flex: 1 }}>{item.name}</p>
        <button
          onClick={handleFavorite}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: saved ? 'var(--yellow)' : 'var(--label-3)', flexShrink: 0 }}
          title={t('Save to favorites')}
          aria-label={t('Save to favorites')}
        >
          <Icon name={saved ? 'starFill' : 'star'} style={{ fontSize: 20 }} />
        </button>
      </div>
      <div className="lrow" style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 12 }}>
        <span className="lrow-m">
          <span className="lrow-t">{t('Quantity')}</span>
          <span className="lrow-s">{item.unit || 'g'}</span>
        </span>
        <NumberField
          value={qty}
          decimal={false}
          onChange={v => setQty(Math.max(1, v || 1))}
          style={{ width: 72, textAlign: 'right' }}
        />
      </div>
      <p style={{ fontSize: 14, color: 'var(--label-2)', marginBottom: 16, textAlign: 'center' }}>
        {scaled.kcal != null ? scaled.kcal + ' kcal' : t('Kcal unknown')}
        {macroLine ? '  ·  ' + macroLine : ''}
      </p>
      <Button variant="primary" style={{ width: '100%', marginBottom: 8 }} onClick={() => onAdd(scaled)}>
        {t('Add to meal')}
      </Button>
      <Button variant="plain" style={{ width: '100%' }} onClick={onCancel}>
        {t('Cancel')}
      </Button>
    </div>
  )
}

// Manual food entry form — for items not in Open Food Facts
export function ManualEntry({ onAdd, onCancel }) {
  const [name,  setName]  = useState('')
  const [kcal,  setKcal]  = useState(null)
  const [prot,  setProt]  = useState(null)
  const [carbs, setCarbs] = useState(null)
  const [fat,   setFat]   = useState(null)
  const [fiber, setFiber] = useState(null)
  const [favSaved, setFavSaved] = useState(false)
  const saveToFavorites = useFavoriteSave()

  const canAdd = name.trim() && kcal != null && kcal > 0

  const add = (alsoSaveFav = false) => {
    if (!canAdd) return
    const complete = prot != null && carbs != null && fat != null
    const item = { id: null, name: name.trim(), qty: 100, unit: 'g', kcal, prot, carbs, fat, fiber, source: 'manual', complete }
    if (alsoSaveFav) { saveToFavorites(item); setFavSaved(true) }
    onAdd(item)
  }

  const Field = ({ label, value, onChange, unit }) => (
    <div className="lrow" style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 6 }}>
      <span className="lrow-m"><span className="lrow-t">{label}</span></span>
      <NumberField value={value} nullable onChange={onChange} style={{ width: 72, textAlign: 'right' }} placeholder="—" />
      <span style={{ fontSize: 13, color: 'var(--label-3)', marginLeft: 6, minWidth: 28 }}>{unit}</span>
    </div>
  )

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div className="lrow" style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 6 }}>
        <span className="lrow-m"><span className="lrow-t">{t('Name')}</span></span>
        <input
          className="num"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('e.g. Salad')}
          style={{ width: 140, textAlign: 'right' }}
        />
      </div>
      <Field label={t('Calories')}      value={kcal}  onChange={setKcal}  unit="kcal" />
      <Field label={t('Protein')}       value={prot}  onChange={setProt}  unit="g" />
      <Field label={t('Carbohydrates')} value={carbs} onChange={setCarbs} unit="g" />
      <Field label={t('Fat')}           value={fat}   onChange={setFat}   unit="g" />
      <Field label={t('Fiber')}         value={fiber} onChange={setFiber} unit="g" />
      <p className="sect-f" style={{ marginBottom: 16 }}>
        {t('Values per 100 g. Only calories are required.')}
      </p>
      <Button variant="primary" style={{ width: '100%', marginBottom: 8 }} onClick={() => add()} disabled={!canAdd}>
        {t('Add to meal')}
      </Button>
      <Button variant="tinted" style={{ width: '100%', marginBottom: 8 }} onClick={() => add(true)} disabled={!canAdd || favSaved}>
        <Icon name={favSaved ? 'starFill' : 'star'} style={{ fontSize: 15, marginRight: 6 }} />
        {favSaved ? t('Saved to favorites') : t('Add to meal & save to favorites')}
      </Button>
      <Button variant="plain" style={{ width: '100%' }} onClick={onCancel}>
        {t('Cancel')}
      </Button>
    </div>
  )
}
