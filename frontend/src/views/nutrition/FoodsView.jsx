import { useState, useMemo } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { uid, todayISO } from '../../lib/format.js'
import { scaleItem } from '../../lib/foodSearch.js'
import Icon from '../../components/Icon.jsx'
import { NumberField, Button } from '../../components/ui.jsx'
import FoodSearch from '../../components/FoodSearch.jsx'

// ─── Macro badge ────────────────────────────────────────────────────────────
function MacroBadge({ value, color, label }) {
  if (value == null) return null
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 700,
      background: `color-mix(in srgb,${color} 16%,var(--surface-2))`,
      color,
    }}>
      {value}g {label}
    </span>
  )
}

// ─── Quick-add sheet ─────────────────────────────────────────────────────────
function QuickAddSheet({ item, meals, onConfirm, onCancel }) {
  const isDish = item.type === 'dish'
  const defaultQty = isDish ? 1 : (item.qty || 100)
  const [qty, setQty] = useState(defaultQty)
  const [slotId, setSlotId] = useState(meals[0]?.id || null)

  const preview = useMemo(() => scaleItem(item, qty), [item, qty])

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>{item.name}</div>

      {/* Qty */}
      <div className="input-metric-card" style={{ marginBottom: 12 }}>
        <div className="imc-label">{t('Quantity')}</div>
        <div className="imc-row">
          <NumberField
            value={qty}
            decimal={false}
            onChange={v => setQty(Math.max(1, v || 1))}
            className="imc-input"
          />
          <span className="imc-unit">{isDish ? t('portion') : 'g'}</span>
        </div>
      </div>

      {/* Preview */}
      {preview.kcal != null && (
        <div className="small" style={{ color: 'var(--label-3)', textAlign: 'center', marginBottom: 14 }}>
          {preview.kcal} kcal · {preview.prot ?? '?'}g P · {preview.carbs ?? '?'}g G · {preview.fat ?? '?'}g L
        </div>
      )}

      {/* Meal slot picker */}
      <div className="small" style={{ color: 'var(--label-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        {t('Add to meal')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {meals.map(m => (
          <button
            key={m.id}
            className={'chip' + (slotId === m.id ? ' on' : '')}
            onClick={() => setSlotId(m.id)}
          >
            {t(m.name)}
          </button>
        ))}
      </div>

      <button
        style={{
          width: '100%', padding: '13px 0', borderRadius: 13, border: 'none', cursor: 'pointer',
          background: 'var(--acc)', color: 'var(--on-acc)', fontWeight: 700, fontSize: 15,
          marginBottom: 8,
        }}
        disabled={!slotId}
        onClick={() => onConfirm(slotId, { ...scaleItem(item, qty), id: uid(), name: item.name, source: item.source || 'custom' })}
      >
        {t('Add to today')}
      </button>
      <button
        style={{ width: '100%', padding: '13px 0', borderRadius: 13, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--label-2)', fontWeight: 600, fontSize: 15 }}
        onClick={onCancel}
      >
        {t('Cancel')}
      </button>
    </div>
  )
}

// ─── Food card in the library ────────────────────────────────────────────────
function FoodCard({ item, onDelete, onQuickAdd }) {
  const isDish = item.type === 'dish'
  const accent = isDish ? 'var(--purple)' : 'var(--teal)'
  const per = item.unit === 'serving' || item.unit === 'portion' ? t('/ portion') : '/ 100 g'
  return (
    <div className="card" style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0, marginTop: 1,
        background: accent + '1A', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={isDish ? 'utensils' : 'bolt'} style={{ fontSize: 15, color: accent }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </div>
        <div className="small" style={{ color: 'var(--label-3)', margin: '2px 0 6px' }}>
          {item.kcal != null ? item.kcal + ' kcal ' + per : t('Kcal unknown')}
          {isDish && item.ingredients?.length
            ? ' · ' + item.ingredients.length + ' ' + t('ingredients')
            : ''}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <MacroBadge value={item.prot}  color="var(--nut-prot)"  label="P" />
          <MacroBadge value={item.carbs} color="var(--nut-carbs)" label="G" />
          <MacroBadge value={item.fat}   color="var(--nut-fat)"   label="L" />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, marginTop: 2 }}>
        <button
          className="iconbtn"
          style={{ color: 'var(--acc)', width: 30, height: 30 }}
          onClick={() => onQuickAdd(item)}
          aria-label={t('Add to today')}
        >
          <Icon name="plus" style={{ fontSize: 15 }} />
        </button>
        <button
          className="iconbtn"
          style={{ color: 'var(--red)', opacity: .55, width: 30, height: 30 }}
          onClick={() => onDelete(item.id)}
          aria-label={t('Delete')}
        >
          <Icon name="trash" style={{ fontSize: 13 }} />
        </button>
      </div>
    </div>
  )
}

// ─── Create food sheet ───────────────────────────────────────────────────────
function CreateFoodSheet({ onSave, onCancel }) {
  const [name,  setName]  = useState('')
  const [kcal,  setKcal]  = useState(null)
  const [prot,  setProt]  = useState(null)
  const [carbs, setCarbs] = useState(null)
  const [fat,   setFat]   = useState(null)
  const [fiber, setFiber] = useState(null)

  const canSave = name.trim() && kcal != null && kcal > 0

  const save = () => {
    if (!canSave) return
    onSave({
      id: uid(), type: 'food', name: name.trim(),
      qty: 100, unit: 'g',
      kcal, prot, carbs, fat, fiber,
      source: 'custom',
      complete: prot != null && carbs != null && fat != null,
      savedAt: Date.now(),
    })
  }

  const Field = ({ label, value, onChange, unit }) => (
    <div className="lrow" style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
      <span className="lrow-m"><span className="lrow-t">{label}</span></span>
      <NumberField value={value} nullable onChange={onChange} style={{ width: 72, textAlign: 'right' }} placeholder="—" />
      <span style={{ fontSize: 13, color: 'var(--label-3)', marginLeft: 6, minWidth: 28 }}>{unit}</span>
    </div>
  )

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div className="lrow" style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
        <span className="lrow-m"><span className="lrow-t">{t('Name')}</span></span>
        <input
          className="num"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('e.g. Chicken breast')}
          style={{ width: 150, textAlign: 'right' }}
          autoFocus
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
      <Button variant="primary" style={{ width: '100%', marginBottom: 8 }} onClick={save} disabled={!canSave}>
        {t('Save food')}
      </Button>
      <Button variant="plain" style={{ width: '100%' }} onClick={onCancel}>{t('Cancel')}</Button>
    </div>
  )
}

// ─── Dish builder sheet ──────────────────────────────────────────────────────
function DishBuilderSheet({ favorites, onSave, onCancel }) {
  const [step, setStep] = useState('meta')  // 'meta' | 'addIngredient' | 'review'
  const [name, setName] = useState('')
  const [servings, setServings] = useState(1)
  const [ingredients, setIngredients] = useState([])  // { name, qty, kcal, prot, carbs, fat, fiber }
  const [pendingItem, setPendingItem] = useState(null)
  const [pendingQty, setPendingQty] = useState(100)
  const [searchMode, setSearchMode] = useState('fav')  // 'fav' | 'search' | 'manual'

  // Summed totals for ONE serving
  const totals = useMemo(() => {
    const sum = (k) => {
      const vals = ingredients.map(i => i[k]).filter(v => v != null)
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / servings) : null
    }
    return { kcal: sum('kcal'), prot: sum('prot'), carbs: sum('carbs'), fat: sum('fat'), fiber: sum('fiber') }
  }, [ingredients, servings])

  const addIngredient = () => {
    if (!pendingItem) return
    const scaled = scaleItem(pendingItem, pendingQty)
    setIngredients(prev => [...prev, { ...scaled, _sourceQty: pendingQty, name: pendingItem.name }])
    setPendingItem(null)
    setPendingQty(100)
    setStep('review')
  }

  const removeIngredient = (i) => setIngredients(prev => prev.filter((_, idx) => idx !== i))

  const save = () => {
    if (!name.trim() || ingredients.length === 0) return
    onSave({
      id: uid(), type: 'dish', name: name.trim(),
      qty: 1, unit: 'serving',
      kcal: totals.kcal, prot: totals.prot, carbs: totals.carbs, fat: totals.fat, fiber: totals.fiber,
      ingredients: ingredients.map(i => ({ name: i.name, qty: i._sourceQty, kcal: i.kcal, prot: i.prot, carbs: i.carbs, fat: i.fat })),
      servings,
      source: 'custom', complete: totals.prot != null && totals.carbs != null && totals.fat != null,
      savedAt: Date.now(),
    })
  }

  // Step: pick ingredient via favorites
  if (step === 'addIngredient' && !pendingItem) {
    return (
      <>
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
          {['fav', 'search', 'manual'].map(m => (
            <button
              key={m}
              className={'chip' + (searchMode === m ? ' on' : '')}
              onClick={() => setSearchMode(m)}
            >
              {m === 'fav' ? t('Favorites') : m === 'search' ? t('Search') : t('Manual')}
            </button>
          ))}
        </div>
        {searchMode === 'fav' && (
          favorites.length === 0
            ? <p className="sect-f">{t('No favorites yet.')}</p>
            : <div style={{ padding: '0 16px' }}>
                {favorites.map(f => (
                  <button key={f.id} className="lrow tap" style={{ width: '100%', marginBottom: 4 }} onClick={() => { setPendingItem(f); setPendingQty(f.qty || 100) }}>
                    <span className="lrow-m">
                      <span className="lrow-t">{f.name}</span>
                      <span className="lrow-s">{f.kcal} kcal / {f.unit === 'serving' ? 'portion' : '100 g'}</span>
                    </span>
                    <Icon name="chevronRight" className="chev" />
                  </button>
                ))}
              </div>
        )}
        {searchMode === 'search' && (
          <FoodSearch onSelect={item => { setPendingItem(item); setPendingQty(100) }} />
        )}
        {searchMode === 'manual' && (
          <div style={{ padding: '0 16px 16px' }}>
            {/* Inline minimal manual entry for dish ingredient */}
            <InlineManualIngredient
              onAdd={item => { setPendingItem(item); setPendingQty(100) }}
              onCancel={() => setStep('review')}
            />
          </div>
        )}
        <div style={{ padding: '0 16px' }}>
          <Button variant="plain" style={{ width: '100%' }} onClick={() => setStep('review')}>{t('Back')}</Button>
        </div>
      </>
    )
  }

  // Step: adjust quantity of selected ingredient
  if (step === 'addIngredient' && pendingItem) {
    const preview = scaleItem(pendingItem, pendingQty)
    return (
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 12 }}>{pendingItem.name}</div>
        <div className="input-metric-card" style={{ marginBottom: 12 }}>
          <div className="imc-label">{t('Quantity')}</div>
          <div className="imc-row">
            <NumberField
              value={pendingQty}
              decimal={false}
              onChange={v => setPendingQty(Math.max(1, v || 1))}
              className="imc-input"
              placeholder="100"
            />
            <span className="imc-unit">{pendingItem.unit === 'serving' ? t('portion') : 'g'}</span>
          </div>
        </div>
        {preview.kcal != null && (
          <div className="small" style={{ color: 'var(--label-3)', textAlign: 'center', marginBottom: 14 }}>
            {preview.kcal} kcal · {preview.prot ?? '?'}g P · {preview.carbs ?? '?'}g G · {preview.fat ?? '?'}g L
          </div>
        )}
        <Button variant="primary" style={{ width: '100%', marginBottom: 8 }} onClick={addIngredient}>
          {t('Add ingredient')}
        </Button>
        <Button variant="plain" style={{ width: '100%' }} onClick={() => setPendingItem(null)}>{t('Back')}</Button>
      </div>
    )
  }

  // Step: meta + review
  return (
    <div style={{ padding: '0 16px 16px' }}>
      {/* Name */}
      <div className="lrow" style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
        <span className="lrow-m"><span className="lrow-t">{t('Dish name')}</span></span>
        <input
          className="num"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('e.g. Evening bowl')}
          style={{ width: 150, textAlign: 'right' }}
          autoFocus={step === 'meta'}
        />
      </div>
      <div className="lrow" style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
        <span className="lrow-m">
          <span className="lrow-t">{t('Number of servings')}</span>
          <span className="lrow-s">{t('Recipe makes how many portions?')}</span>
        </span>
        <NumberField value={servings} decimal={false} onChange={v => setServings(Math.max(1, v || 1))} style={{ width: 60, textAlign: 'right' }} />
      </div>

      {/* Ingredient list */}
      {ingredients.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div className="small" style={{ color: 'var(--label-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            {t('Ingredients')} ({ingredients.length})
          </div>
          {ingredients.map((ing, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 10 }}>
              <span style={{ flex: 1, fontSize: 14 }}>{ing.name}</span>
              <span className="small" style={{ color: 'var(--label-3)' }}>{ing._sourceQty}{ing.unit === 'serving' ? '' : ' g'}</span>
              <span className="small" style={{ color: 'var(--label-2)', minWidth: 60, textAlign: 'right' }}>{ing.kcal} kcal</span>
              <button className="iconbtn" style={{ color: 'var(--red)', opacity: .55 }} onClick={() => removeIngredient(i)}>
                <Icon name="minus" style={{ fontSize: 13 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Totals */}
      {ingredients.length > 0 && totals.kcal != null && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
          <div className="small" style={{ color: 'var(--label-3)', marginBottom: 4 }}>
            {t('Per serving')} ({servings > 1 ? t('total ÷ {0}', servings) : t('total')})
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{totals.kcal} kcal</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <MacroBadge value={totals.prot}  color="var(--nut-prot)"  label="P" />
            <MacroBadge value={totals.carbs} color="var(--nut-carbs)" label="G" />
            <MacroBadge value={totals.fat}   color="var(--nut-fat)"   label="L" />
          </div>
        </div>
      )}

      <Button
        variant="tinted"
        style={{ width: '100%', marginBottom: 8 }}
        onClick={() => setStep('addIngredient')}
      >
        <Icon name="plus" style={{ fontSize: 14, marginRight: 6 }} />
        {t('Add ingredient')}
      </Button>

      <Button
        variant="primary"
        style={{ width: '100%', marginBottom: 8 }}
        onClick={save}
        disabled={!name.trim() || ingredients.length === 0}
      >
        {t('Save dish')}
      </Button>
      <Button variant="plain" style={{ width: '100%' }} onClick={onCancel}>{t('Cancel')}</Button>
    </div>
  )
}

// Minimal manual ingredient form (no onAdd to meal, just creates an item object)
function InlineManualIngredient({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState(null)
  const [prot, setProt] = useState(null)
  const [carbs, setCarbs] = useState(null)
  const [fat, setFat] = useState(null)
  const canAdd = name.trim() && kcal != null

  return (
    <>
      <div className="lrow" style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
        <span className="lrow-m"><span className="lrow-t">{t('Name')}</span></span>
        <input className="num" value={name} onChange={e => setName(e.target.value)} placeholder={t('Ingredient')} style={{ width: 140, textAlign: 'right' }} autoFocus />
      </div>
      {[
        [t('Calories'), kcal, setKcal, 'kcal'],
        [t('Protein'), prot, setProt, 'g'],
        [t('Carbohydrates'), carbs, setCarbs, 'g'],
        [t('Fat'), fat, setFat, 'g'],
      ].map(([label, val, setter, unit]) => (
        <div key={label} className="lrow" style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
          <span className="lrow-m"><span className="lrow-t">{label}</span></span>
          <NumberField value={val} nullable onChange={setter} style={{ width: 72, textAlign: 'right' }} placeholder="—" />
          <span style={{ fontSize: 13, color: 'var(--label-3)', marginLeft: 6, minWidth: 28 }}>{unit}</span>
        </div>
      ))}
      <p className="sect-f" style={{ marginBottom: 12 }}>{t('Values per 100 g. Only calories are required.')}</p>
      <Button variant="primary" style={{ width: '100%', marginBottom: 8 }} onClick={() => canAdd && onAdd({ id: uid(), name: name.trim(), qty: 100, unit: 'g', kcal, prot, carbs, fat, source: 'manual', complete: prot != null && carbs != null && fat != null })} disabled={!canAdd}>
        {t('Use ingredient')}
      </Button>
      <Button variant="plain" style={{ width: '100%' }} onClick={onCancel}>{t('Back')}</Button>
    </>
  )
}

const FALLBACK_MEALS = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch',     name: 'Lunch' },
  { id: 'dinner',    name: 'Dinner' },
  { id: 'snack',     name: 'Snack' },
]

// ─── Main FoodsView ───────────────────────────────────────────────────────────
export default function FoodsView() {
  const { update } = useStore()
  const { openSheet } = useUI()
  const favorites = useStore(s => s.S.nutritionFavorites || [])
  const todayMeals = useStore(s => {
    const log = s.S.nutritionLog?.[todayISO()]
    return log?.meals?.length ? log.meals : null
  })
  const [query, setQuery] = useState('')

  const meals = todayMeals || FALLBACK_MEALS

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? favorites.filter(f => f.name.toLowerCase().includes(q)) : favorites
  }, [favorites, query])

  const foods = filtered.filter(f => f.type !== 'dish')
  const dishes = filtered.filter(f => f.type === 'dish')

  const deleteItem = (id) => update(s => {
    s.nutritionFavorites = (s.nutritionFavorites || []).filter(f => f.id !== id)
  })

  const saveToFavorites = (item) => update(s => {
    if (!s.nutritionFavorites) s.nutritionFavorites = []
    s.nutritionFavorites.unshift(item)
  })

  const openQuickAdd = (item) => openSheet(close => (
    <>
      <h3>{t('Add to today')}</h3>
      <QuickAddSheet
        item={item}
        meals={meals}
        onConfirm={(slotId, entry) => {
          const today = todayISO()
          update(s => {
            if (!s.nutritionLog) s.nutritionLog = {}
            if (!s.nutritionLog[today]) s.nutritionLog[today] = { meals: FALLBACK_MEALS.map(m => ({ ...m, items: [] })), sport: [] }
            const day = s.nutritionLog[today]
            const meal = day.meals.find(m => m.id === slotId)
            if (meal) {
              meal.items = [...(meal.items || []), entry]
            } else {
              day.meals[0].items = [...(day.meals[0].items || []), entry]
            }
          })
          close()
        }}
        onCancel={close}
      />
    </>
  ))

  const openCreateFood = () => openSheet(close => (
    <>
      <h3>{t('New food')}</h3>
      <CreateFoodSheet
        onSave={item => { saveToFavorites(item); close() }}
        onCancel={close}
      />
    </>
  ))

  const openCreateDish = () => openSheet(close => (
    <>
      <h3>{t('New dish')}</h3>
      <DishBuilderSheet
        favorites={favorites}
        onSave={item => { saveToFavorites(item); close() }}
        onCancel={close}
      />
    </>
  ))

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Header actions */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 4px', alignItems: 'center' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px',
        }}>
          <Icon name="magnifier" style={{ fontSize: 16, color: 'var(--label-3)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('Search foods…')}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--label)', flex: 1 }}
          />
          {query && (
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--label-3)' }} onClick={() => setQuery('')}>
              <Icon name="xmark" style={{ fontSize: 14 }} />
            </button>
          )}
        </div>
      </div>

      {/* Create buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 16px 16px' }}>
        <button
          onClick={openCreateFood}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            background: 'color-mix(in srgb,var(--teal) 12%,var(--surface))',
            border: '1.5px solid color-mix(in srgb,var(--teal) 28%,transparent)',
            borderRadius: 12, cursor: 'pointer', color: 'var(--teal)',
          }}
        >
          <Icon name="bolt" style={{ fontSize: 15 }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{t('New food')}</span>
        </button>
        <button
          onClick={openCreateDish}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            background: 'color-mix(in srgb,var(--purple) 12%,var(--surface))',
            border: '1.5px solid color-mix(in srgb,var(--purple) 28%,transparent)',
            borderRadius: 12, cursor: 'pointer', color: 'var(--purple)',
          }}
        >
          <Icon name="utensils" style={{ fontSize: 15 }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{t('New dish')}</span>
        </button>
      </div>

      {/* Empty state */}
      {favorites.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          <Icon name="star" style={{ fontSize: 40, color: 'var(--label-3)', opacity: .4 }} />
          <div style={{ fontWeight: 600, marginTop: 12, fontSize: 16 }}>{t('No saved foods yet')}</div>
          <div className="small" style={{ color: 'var(--label-3)', marginTop: 6, lineHeight: 1.5 }}>
            {t('Create a food or dish above, or star an item when adding it to a meal.')}
          </div>
        </div>
      )}

      {/* Foods section */}
      {foods.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          <div className="small" style={{ color: 'var(--teal)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
            {t('Foods')} · {foods.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {foods.map(f => <FoodCard key={f.id} item={f} onDelete={deleteItem} onQuickAdd={openQuickAdd} />)}
          </div>
        </div>
      )}

      {/* Dishes section */}
      {dishes.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          <div className="small" style={{ color: 'var(--purple)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
            {t('Dishes')} · {dishes.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {dishes.map(d => <FoodCard key={d.id} item={d} onDelete={deleteItem} onQuickAdd={openQuickAdd} />)}
          </div>
        </div>
      )}

      {/* No results for search */}
      {query && filtered.length === 0 && favorites.length > 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--label-3)' }}>
          <div className="small">{t('No results for "{0}"', query)}</div>
        </div>
      )}
    </div>
  )
}
