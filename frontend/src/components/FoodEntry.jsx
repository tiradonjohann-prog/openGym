import { useState } from 'react'
import { scaleItem } from '../lib/foodSearch.js'
import { t } from '../lib/i18n.js'
import { NumberField, Button } from './ui.jsx'

// Lets the user adjust the gram quantity of a food item (from OFF or manual)
// before adding it to the meal slot.
export function FoodQty({ item, onAdd, onCancel }) {
  const [qty, setQty] = useState(item.qty || 100)

  const scaled = scaleItem(item, qty)
  const macroLine = [
    scaled.prot  != null ? scaled.prot  + 'g P' : null,
    scaled.carbs != null ? scaled.carbs + 'g C' : null,
    scaled.fat   != null ? scaled.fat   + 'g F' : null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>{item.name}</p>
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

  const canAdd = name.trim() && kcal != null && kcal > 0

  const add = () => {
    if (!canAdd) return
    const complete = prot != null && carbs != null && fat != null
    onAdd({
      id: null, name: name.trim(), qty: 100, unit: 'g',
      kcal, prot, carbs, fat, fiber, source: 'manual', complete,
    })
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
      <Button variant="primary" style={{ width: '100%', marginBottom: 8 }} onClick={add} disabled={!canAdd}>
        {t('Add to meal')}
      </Button>
      <Button variant="plain" style={{ width: '100%' }} onClick={onCancel}>
        {t('Cancel')}
      </Button>
    </div>
  )
}
