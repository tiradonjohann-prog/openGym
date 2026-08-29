import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { todayISO, uid, fmtNum } from '../../lib/format.js'
import { lastBW } from '../../lib/history.js'
import { dayTotals, pruneLog } from '../../lib/foodSearch.js'
import { getActiveTips } from '../../lib/tips.js'
import { suggestRecipes } from '../../lib/recipes.js'
import { calcMacros } from '../../lib/macros.js'
import NutriRing from '../../components/NutriRing.jsx'
import NutriBar  from '../../components/NutriBar.jsx'
import NutriTip  from '../../components/NutriTip.jsx'
import FoodSearch from '../../components/FoodSearch.jsx'
import { FoodQty, ManualEntry } from '../../components/FoodEntry.jsx'
import RecipeCard from '../../components/RecipeCard.jsx'
import Icon from '../../components/Icon.jsx'
import { Segmented } from '../../components/ui.jsx'

const MEAL_NAMES_BY_COUNT = {
  1: ['Meal'],
  2: ['Lunch', 'Dinner'],
  3: ['Breakfast', 'Lunch', 'Dinner'],
  4: ['Breakfast', 'Lunch', 'Dinner', 'Evening meal'],
  5: ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Supper'],
  6: ['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner', 'Evening snack'],
}
const SNACK_NAMES = ['Snack', 'Snack 2', 'Snack 3', 'Snack 4']

function buildDefaultSlots(diet) {
  const mealCount  = diet?.mealsPerDay  ?? 3
  const snackCount = diet?.snacksPerDay ?? 1
  const mealNames  = MEAL_NAMES_BY_COUNT[Math.max(1, Math.min(6, mealCount))] || MEAL_NAMES_BY_COUNT[3]
  const slots = mealNames.map(name => ({ id: uid(), name, items: [] }))
  for (let i = 0; i < snackCount; i++) slots.push({ id: uid(), name: SNACK_NAMES[i] || 'Snack', items: [] })
  return slots
}

// Proper React component for the add-food sheet — hooks are valid here
function AddFoodSheet({ slotName, onAdd, suggestions }) {
  const [mode, setMode]       = useState('search')
  const [pending, setPending] = useState(null)

  if (pending) {
    return (
      <>
        <h3>{slotName}</h3>
        <FoodQty item={pending} onAdd={onAdd} onCancel={() => setPending(null)} />
      </>
    )
  }

  return (
    <>
      <h3>{slotName}</h3>
      <Segmented
        style={{ margin: '0 16px 12px' }}
        options={[
          { value: 'search',  label: t('Search') },
          { value: 'manual',  label: t('Manual') },
          { value: 'recipes', label: t('Suggestions') },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'search' && <FoodSearch onSelect={item => setPending(item)} />}
      {mode === 'manual' && <ManualEntry onAdd={onAdd} onCancel={() => setPending(null)} />}
      {mode === 'recipes' && (
        <div className="sect-b" style={{ margin: '0 0 16px' }}>
          {suggestions.length === 0 && (
            <p className="sect-f">{t('No suggestions match your current filters.')}</p>
          )}
          {suggestions.map(r => (
            <RecipeCard key={r.id} recipe={r} onAdd={recipe => onAdd({
              id: recipe.id, name: recipe.name, qty: 1, unit: 'serving',
              kcal: recipe.kcal, prot: recipe.prot, carbs: recipe.carbs,
              fat: recipe.fat, fiber: recipe.fiber || null,
              source: 'recipe', complete: true,
            })} />
          ))}
        </div>
      )}
    </>
  )
}

export default function DayView() {
  const S      = useStore(s => s.S)
  const { update } = useStore()
  const { openSheet } = useUI()
  const today  = todayISO()

  const n        = S.nutrition || {}
  const bw       = lastBW(S)
  const weightKg = bw ? (S.unit === 'lb' ? bw.w / 2.2046 : bw.w) : null

  const [dismissed, setDismissed] = useState([])

  // Ensure today's log exists with the correct meal slots
  useEffect(() => {
    update(s => {
      if (!s.nutritionLog) s.nutritionLog = {}
      s.nutritionLog = pruneLog(s.nutritionLog, today)
      if (!s.nutritionLog[today]) {
        s.nutritionLog[today] = { meals: buildDefaultSlots(s.nutrition?.diet), sport: [] }
      }
    })
  // Run once at mount. `today` is stable for the lifetime of this view (cannot survive midnight
  // without a remount). `update` has a stable reference from the store.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const log    = S.nutritionLog || {}
  const day    = log[today] || { meals: [], sport: [] }
  const totals = dayTotals(log, today)
  const macros = n.macros?.protG ? n.macros : calcMacros(n.targetKcal, weightKg, n.goal, n.workoutsPerWeek)
  const target = n.targetKcal

  const tips = getActiveTips({ nutrition: n, macros, log, today, weightKg }, dismissed)

  const addItem = useCallback((slotId, item) => {
    update(s => {
      if (!s.nutritionLog?.[today]) return
      const slot = s.nutritionLog[today].meals.find(m => m.id === slotId)
      if (slot) slot.items.push({ ...item, id: uid() })
    })
  }, [today, update])

  const removeItem = useCallback((slotId, itemId) => {
    update(s => {
      if (!s.nutritionLog?.[today]) return
      const slot = s.nutritionLog[today].meals.find(m => m.id === slotId)
      if (slot) slot.items = slot.items.filter(i => i.id !== itemId)
    })
  }, [today, update])

  const openAddFood = (slotId, slotName) => {
    const remaining = {
      kcal:  Math.max(0, (target || 0) - totals.kcal),
      prot:  Math.max(0, (macros?.protG  || 0) - totals.prot),
      carbs: Math.max(0, (macros?.carbsG || 0) - totals.carbs),
      fat:   Math.max(0, (macros?.fatG   || 0) - totals.fat),
    }
    const suggestions = suggestRecipes(remaining, {
      allergens: n.diet?.allergens,
      dietType:  n.diet?.type,
    })

    openSheet(closeSheet => (
      <AddFoodSheet
        slotName={slotName}
        suggestions={suggestions}
        onAdd={item => { addItem(slotId, item); closeSheet() }}
      />
    ))
  }

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* ── Tips (max 2 visible at a time) ── */}
      {tips.slice(0, 2).map(tip => (
        <NutriTip key={tip.id} tip={tip} onDismiss={id => setDismissed(d => [...d, id])} />
      ))}

      {/* ── Calorie ring ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px 16px' }}>
        <NutriRing
          value={totals.kcal}
          max={target || 2000}
          color="var(--nut-kcal)"
          size={148}
          label={target ? t('{0} kcal target', fmtNum(target)) : t('No target set')}
          unit="kcal"
        />
        {target && (
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--label-3)' }}>
            {Math.max(0, target - totals.kcal)} {t('kcal remaining')}
          </p>
        )}
      </div>

      {/* ── Macro bars ── */}
      {macros?.protG && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <NutriBar label={t('Protein')}       value={totals.prot}  max={macros.protG}       color="var(--nut-prot)"  unit="g" important />
          <NutriBar label={t('Carbohydrates')} value={totals.carbs} max={macros.carbsG}      color="var(--nut-carbs)" unit="g" />
          <NutriBar label={t('Fat')}           value={totals.fat}   max={macros.fatG}         color="var(--nut-fat)"   unit="g" />
          <NutriBar label={t('Fiber')}         value={totals.fiber} max={macros.fiberG || 25} color="var(--nut-fiber)" unit="g" />
        </div>
      )}

      {/* ── Meal slots ── */}
      <div style={{ marginTop: 20 }}>
        {(day.meals || []).map(slot => {
          const slotKcal = slot.items.reduce((s, i) => s + (i.kcal || 0), 0)
          return (
            <div key={slot.id} className="meal-slot">
              <div className="meal-slot-hd">
                <span className="slot-name">{t(slot.name)}</span>
                {slotKcal > 0 && <span className="slot-kcal">{fmtNum(slotKcal)} kcal</span>}
              </div>
              <div className="card" style={{ margin: '0 16px 4px', padding: 0, overflow: 'hidden' }}>
                {slot.items.map(item => (
                  <div key={item.id} className="meal-item-row">
                    <span className="mi-name">{item.name}</span>
                    <span className="mi-kcal">{item.kcal != null ? item.kcal + ' kcal' : '—'}</span>
                    <button className="mi-del iconbtn" onClick={() => removeItem(slot.id, item.id)} aria-label={t('Remove {0}', item.name)}>
                      <Icon name="minus" size={16} />
                    </button>
                  </div>
                ))}
                <button
                  className="lrow tap"
                  style={{ padding: '10px 14px', color: 'var(--acc)', fontWeight: 500 }}
                  onClick={() => openAddFood(slot.id, t(slot.name))}
                >
                  <Icon name="plus" />
                  <span style={{ marginLeft: 8, fontSize: 15 }}>{t('Add food')}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
