import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { todayISO, isoOf, uid, fmtDate, fmtNum } from '../../lib/format.js'
import { lastBW, effectiveRoutine } from '../../lib/history.js'
import { dayTotals, pruneLog } from '../../lib/foodSearch.js'
import { getActiveTips } from '../../lib/tips.js'
import { suggestRecipes } from '../../lib/recipes.js'
import { calcMacros } from '../../lib/macros.js'
import { calcBMR, calcTDEE } from '../../lib/nutrition.js'
import { calcTargetKcal } from '../../lib/goals.js'
import MacroDonut from '../../components/MacroDonut.jsx'
import NutriBar   from '../../components/NutriBar.jsx'
import NutriTip  from '../../components/NutriTip.jsx'
import FoodSearch from '../../components/FoodSearch.jsx'
import { FoodQty, ManualEntry } from '../../components/FoodEntry.jsx'
import RecipeCard from '../../components/RecipeCard.jsx'
import Icon from '../../components/Icon.jsx'
import { Segmented } from '../../components/ui.jsx'

function mealTypeConfig(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('breakfast') || n.includes('brunch') || n.includes('matin'))
    return { icon: 'sun',      color: 'var(--orange)' }
  if (n.includes('lunch') || n.includes('déjeuner') || n.includes('dejeuner') || n.includes('midi'))
    return { icon: 'utensils', color: 'var(--blue)' }
  if (n.includes('dinner') || n.includes('supper') || n.includes('evening meal') || n.includes('dîner') || n.includes('diner') || n.includes('soir'))
    return { icon: 'moon',     color: 'var(--purple)' }
  if (n.includes('snack') || n.includes('collation'))
    return { icon: 'star',     color: 'var(--teal)' }
  return { icon: 'utensils',   color: 'var(--acc)' }
}

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

function FavoritesList({ onSelect, update }) {
  const favorites = useStore(s => s.S.nutritionFavorites || [])
  const removeFav = (id) => update(s => { s.nutritionFavorites = (s.nutritionFavorites || []).filter(f => f.id !== id) })
  if (favorites.length === 0) {
    return (
      <div className="empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
        <div className="ico"><Icon name="star" /></div>
        <div style={{ marginTop: 8, fontSize: 14, color: 'var(--label-3)' }}>{t('No favorites yet.')}</div>
        <div className="small muted" style={{ marginTop: 4 }}>{t('Star a food item when selecting it to save it here.')}</div>
      </div>
    )
  }
  return (
    <div className="sect-b" style={{ margin: '0 0 16px' }}>
      {favorites.map(fav => (
        <div key={fav.id} className="lrow" style={{ padding: '10px 14px' }}>
          <div className="lrow-m" style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onSelect(fav)}>
            <div className="lrow-t" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fav.name}</div>
            <div className="lrow-s">{fav.kcal != null ? fav.kcal + ' kcal / 100g' : ''}</div>
          </div>
          <button className="iconbtn" style={{ color: 'var(--red)', width: 30, height: 30, flexShrink: 0 }} onClick={() => removeFav(fav.id)} aria-label={t('Remove from favorites')}>
            <Icon name="minus" style={{ fontSize: 15 }} />
          </button>
        </div>
      ))}
    </div>
  )
}

// Proper React component for the add-food sheet — hooks are valid here
function AddFoodSheet({ slotName, onAdd, suggestions }) {
  const [mode, setMode]       = useState('favorites')
  const [pending, setPending] = useState(null)
  const { update } = useStore()

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
          { value: 'favorites', label: t('Favorites') },
          { value: 'search',    label: t('Search') },
          { value: 'manual',    label: t('Manual') },
          { value: 'recipes',   label: t('Suggestions') },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'favorites' && <FavoritesList onSelect={item => setPending(item)} update={update} />}
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

const shiftDate = (iso, days) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return isoOf(d)
}

export default function DayView() {
  const S      = useStore(s => s.S)
  const { update } = useStore()
  const { openSheet } = useUI()
  const today  = todayISO()

  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const log    = S.nutritionLog || {}
  const day    = log[selectedDate] || { meals: [], sport: [] }
  const totals = dayTotals(log, selectedDate)
  // Always compute target fresh from current bodyweight (same formula as Profile tab)
  // so both tabs agree — stored n.targetKcal can be stale if weight changed since last profile save.
  const computedBMR  = calcBMR(n.sex, weightKg, n.heightCm, n.age)
  const computedTDEE = calcTDEE(computedBMR, n.activityLevel, n.workoutsPerWeek)
  const target = (computedTDEE != null && n.goalDelta != null)
    ? calcTargetKcal(computedTDEE, n.goalDelta)
    : n.targetKcal
  const macros = n.macros?.protG ? n.macros : calcMacros(target, weightKg, n.goal, n.workoutsPerWeek)

  // Training vs rest day target (calorie cycling)
  const EXTRA_TRAIN = 200
  const workoutsPerWeek = n.workoutsPerWeek || 0
  const trainN = Math.min(Math.max(Math.round(workoutsPerWeek), 0), 6)
  const restN  = 7 - trainN
  const hasSplit = target != null && trainN > 0 && restN > 0
  const routine = effectiveRoutine(S, selectedDate)
  const hasWorkoutToday = !!(routine && ((routine.ex?.length ?? 0) > 0 || (routine.blocks?.length ?? 0) > 0))
  const dayTarget = hasSplit
    ? (hasWorkoutToday
        ? Math.round(target + EXTRA_TRAIN)
        : Math.round(target - EXTRA_TRAIN * trainN / restN))
    : target

  // Per-meal calorie + macro targets (weighted split: meals 1.5×, snacks 0.5×)
  const SNACK_NAMES_SET = new Set(['Snack', 'Snack 2', 'Snack 3', 'Snack 4'])
  const isSnackSlot = name => SNACK_NAMES_SET.has(name) || name.toLowerCase().startsWith('snack')
  const slots = day.meals || []
  const slotW = sl => isSnackSlot(sl.name) ? 0.5 : 1.5
  const totalSlotWeight = slots.reduce((s, sl) => s + slotW(sl), 0)
  const slotTarget = totalSlotWeight > 0
    ? (sl, total) => total ? Math.round(total * slotW(sl) / totalSlotWeight) : null
    : () => null
  const slotKcalTarget  = sl => slotTarget(sl, dayTarget)
  const slotProtTarget  = sl => slotTarget(sl, macros?.protG)
  const slotCarbsTarget = sl => slotTarget(sl, macros?.carbsG)
  const slotFatTarget   = sl => slotTarget(sl, macros?.fatG)

  const tips = isToday ? getActiveTips({ nutrition: n, macros, log, today, weightKg }, dismissed) : []

  const addItem = useCallback((slotId, item) => {
    update(s => {
      if (!s.nutritionLog) s.nutritionLog = {}
      if (!s.nutritionLog[selectedDate]) s.nutritionLog[selectedDate] = { meals: buildDefaultSlots(s.nutrition?.diet), sport: [] }
      const slot = s.nutritionLog[selectedDate].meals.find(m => m.id === slotId)
      if (slot) slot.items.push({ ...item, id: uid() })
    })
  }, [selectedDate, update])

  const removeItem = useCallback((slotId, itemId) => {
    update(s => {
      if (!s.nutritionLog?.[selectedDate]) return
      const slot = s.nutritionLog[selectedDate].meals.find(m => m.id === slotId)
      if (slot) slot.items = slot.items.filter(i => i.id !== itemId)
    })
  }, [selectedDate, update])

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

      {/* ── Date navigation ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 6px', gap: 8,
      }}>
        <button
          className="iconbtn"
          style={{ width: 36, height: 36, background: 'var(--surface-2)', borderRadius: 10 }}
          onClick={() => setSelectedDate(d => shiftDate(d, -1))}
          aria-label={t('Previous day')}
        >
          <Icon name="chevronLeft" />
        </button>
        <button
          style={{
            flex: 1, background: 'var(--surface-2)', border: 'none', borderRadius: 10,
            padding: '7px 12px', cursor: 'pointer', textAlign: 'center',
          }}
          onClick={() => { if (!isToday) setSelectedDate(today) }}
          aria-label={isToday ? undefined : t('Back to today')}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)', lineHeight: 1.2 }}>
            {isToday ? t('Today') : fmtDate(selectedDate, true)}
          </div>
          {!isToday && (
            <div style={{ fontSize: 11, color: 'var(--acc)', marginTop: 1 }}>{t('Tap to return to today')}</div>
          )}
        </button>
        <button
          className="iconbtn"
          style={{
            width: 36, height: 36, background: 'var(--surface-2)', borderRadius: 10,
            opacity: isToday ? 0.3 : 1,
          }}
          onClick={() => { if (!isToday) setSelectedDate(d => shiftDate(d, 1)) }}
          disabled={isToday}
          aria-label={t('Next day')}
        >
          <Icon name="chevronRight" />
        </button>
      </div>

      {/* ── Tips (max 2 visible at a time) ── */}
      {tips.slice(0, 2).map(tip => (
        <NutriTip key={tip.id} tip={tip} onDismiss={id => setDismissed(d => [...d, id])} />
      ))}

      {/* ── Training/rest day indicator ── */}
      {hasSplit && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 16px 0', fontSize: 13,
          color: hasWorkoutToday ? 'var(--orange)' : 'var(--blue)',
        }}>
          <Icon name={hasWorkoutToday ? 'figureRun' : 'moon'} style={{ fontSize: 14 }} />
          <span style={{ fontWeight: 600 }}>
            {hasWorkoutToday
              ? t('Training day — {0} kcal', fmtNum(dayTarget))
              : t('Rest day — {0} kcal', fmtNum(dayTarget))}
          </span>
          {dayTarget !== target && target != null && (
            <span style={{ opacity: 0.55, fontSize: 11 }}>
              {t('base {0}', fmtNum(target))}{' '}
              {dayTarget > target ? '+' : '−'}{Math.abs(dayTarget - target)}
            </span>
          )}
        </div>
      )}

      {/* ── Calorie ring with macro breakdown ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px 16px' }}>
        <MacroDonut
          kcal={totals.kcal}
          target={dayTarget}
          prot={totals.prot}
          carbs={totals.carbs}
          fat={totals.fat}
          size={148}
        />
        {!dayTarget && (
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--label-3)' }}>{t('No target set')}</p>
        )}
      </div>

      {/* ── Macro bars ── */}
      {macros?.protG ? (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <NutriBar label={t('Protein')}       value={totals.prot}  max={macros.protG}       color="var(--nut-prot)"  unit="g" important />
          <NutriBar label={t('Carbohydrates')} value={totals.carbs} max={macros.carbsG}      color="var(--nut-carbs)" unit="g" />
          <NutriBar label={t('Fat')}           value={totals.fat}   max={macros.fatG}         color="var(--nut-fat)"   unit="g" />
          <NutriBar label={t('Fiber')}         value={totals.fiber} max={macros.fiberG || 25} color="var(--nut-fiber)" unit="g" />
        </div>
      ) : (
        <div style={{ margin: '4px 16px 8px', padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 12 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--label-2)', lineHeight: 1.5 }}>
            {t('Open the')} <strong>{t('Profile')}</strong> {t('tab to set your calorie target — your macro breakdown will appear here.')}
          </p>
        </div>
      )}

      {/* ── Macro summary card ── */}
      {macros?.protG && (
        <div className="card" style={{ margin: '16px 16px 0', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--label-3)', marginBottom: 10 }}>
            {t('Macros today')}
          </div>
          {/* Stacked macro proportion bar */}
          {(totals.prot > 0 || totals.carbs > 0 || totals.fat > 0) && (
            <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', gap: 2, marginBottom: 12 }}>
              {totals.prot  > 0 && <div style={{ flex: totals.prot  * 4, background: 'var(--nut-prot)',  minWidth: 4 }} />}
              {totals.carbs > 0 && <div style={{ flex: totals.carbs * 4, background: 'var(--nut-carbs)', minWidth: 4 }} />}
              {totals.fat   > 0 && <div style={{ flex: totals.fat   * 9, background: 'var(--nut-fat)',   minWidth: 4 }} />}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center' }}>
            <div>
              <div style={{ color: 'var(--nut-prot)', fontWeight: 700, fontSize: 18, lineHeight: 1.1 }}>
                {totals.prot}<span style={{ fontSize: 11, fontWeight: 500 }}>g</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--label-3)', marginTop: 2 }}>{t('Protein')}</div>
              <div style={{ fontSize: 11, color: 'var(--label-4)', marginTop: 1 }}>/ {macros.protG}g</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--sep)', borderRight: '1px solid var(--sep)' }}>
              <div style={{ color: 'var(--nut-carbs)', fontWeight: 700, fontSize: 18, lineHeight: 1.1 }}>
                {totals.carbs}<span style={{ fontSize: 11, fontWeight: 500 }}>g</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--label-3)', marginTop: 2 }}>{t('Carbs')}</div>
              <div style={{ fontSize: 11, color: 'var(--label-4)', marginTop: 1 }}>/ {macros.carbsG}g</div>
            </div>
            <div>
              <div style={{ color: 'var(--nut-fat)', fontWeight: 700, fontSize: 18, lineHeight: 1.1 }}>
                {totals.fat}<span style={{ fontSize: 11, fontWeight: 500 }}>g</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--label-3)', marginTop: 2 }}>{t('Fat')}</div>
              <div style={{ fontSize: 11, color: 'var(--label-4)', marginTop: 1 }}>/ {macros.fatG}g</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Meal slots ── */}
      <div style={{ marginTop: 20 }}>
        {(day.meals || []).map(slot => {
          const slotKcal  = slot.items.reduce((s, i) => s + (i.kcal  || 0), 0)
          const slotProt  = slot.items.reduce((s, i) => s + (i.prot  || 0), 0)
          const slotCarbs = slot.items.reduce((s, i) => s + (i.carbs || 0), 0)
          const slotFat   = slot.items.reduce((s, i) => s + (i.fat   || 0), 0)
          const target4slot = slotKcalTarget(slot)
          const sp = slotProtTarget(slot)
          const sc = slotCarbsTarget(slot)
          const sf = slotFatTarget(slot)
          const slotPct = target4slot > 0 ? Math.min(1, slotKcal / target4slot)
            : dayTarget > 0 ? Math.min(1, slotKcal / dayTarget) : 0
          const slotOver = target4slot > 0 && slotKcal > target4slot
          const { icon: slotIcon, color: slotColor } = mealTypeConfig(slot.name)
          return (
            <div key={slot.id} className="meal-slot">
              {/* ── Slot header ── */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px 6px', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: `color-mix(in srgb,${slotColor} 18%,var(--surface-2))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: slotColor, fontSize: 14,
                  }}>
                    <Icon name={slotIcon} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', letterSpacing: '-.01em' }}>
                    {t(slot.name)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  {slotKcal > 0 && (
                    <span style={{ fontSize: 14, fontWeight: 700, color: slotOver ? 'var(--orange)' : 'var(--label)' }}>
                      {fmtNum(slotKcal)}
                    </span>
                  )}
                  {target4slot && (
                    <span style={{ fontSize: 12, color: 'var(--label-4)' }}>
                      {slotKcal === 0 ? '' : '/'}{target4slot} kcal
                    </span>
                  )}
                  {!target4slot && slotKcal === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--label-4)' }}>—</span>
                  )}
                </div>
              </div>

              {/* ── Slot progress bar ── */}
              {(slotKcal > 0 || target4slot) && dayTarget > 0 && (
                <div style={{ height: 4, background: 'var(--surface-3)', margin: '0 16px 6px', borderRadius: 3 }}>
                  <div style={{
                    height: '100%',
                    width: Math.min(1, slotPct) * 100 + '%',
                    background: slotOver
                      ? 'var(--orange)'
                      : `linear-gradient(90deg,${slotColor},color-mix(in srgb,${slotColor} 70%,var(--nut-carbs)))`,
                    borderRadius: 3,
                    transition: 'width .4s var(--ease)',
                    boxShadow: slotKcal > 0 ? `0 0 6px color-mix(in srgb,${slotColor} 40%,transparent)` : 'none',
                  }} />
                </div>
              )}

              {/* ── Per-slot macro targets ── */}
              {(sp || sc || sf) && (
                <div style={{ padding: '0 16px 5px', display: 'flex', gap: 8, fontSize: 11, flexWrap: 'wrap' }}>
                  {sp && (
                    <span style={{ color: 'var(--nut-prot)', fontWeight: 600, background: 'color-mix(in srgb,var(--nut-prot) 12%,var(--surface-2))', padding: '1px 5px', borderRadius: 4 }}>
                      {slotProt > 0 ? slotProt + '/' : ''}{sp}g P
                    </span>
                  )}
                  {sc && (
                    <span style={{ color: 'var(--nut-carbs)', fontWeight: 600, background: 'color-mix(in srgb,var(--nut-carbs) 12%,var(--surface-2))', padding: '1px 5px', borderRadius: 4 }}>
                      {slotCarbs > 0 ? slotCarbs + '/' : ''}{sc}g G
                    </span>
                  )}
                  {sf && (
                    <span style={{ color: 'var(--nut-fat)', fontWeight: 600, background: 'color-mix(in srgb,var(--nut-fat) 12%,var(--surface-2))', padding: '1px 5px', borderRadius: 4 }}>
                      {slotFat > 0 ? slotFat + '/' : ''}{sf}g L
                    </span>
                  )}
                </div>
              )}

              {/* ── Food items card ── */}
              <div className="card" style={{
                margin: '0 16px 8px', padding: 0, overflow: 'hidden',
                borderLeft: `3px solid color-mix(in srgb,${slotColor} 45%,transparent)`,
              }}>
                {slot.items.map(item => {
                  const hasMacros = item.prot != null || item.carbs != null || item.fat != null
                  return (
                    <div key={item.id} className="meal-item-row" style={{ alignItems: hasMacros ? 'flex-start' : 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="mi-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        {hasMacros && (
                          <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                            {item.prot  != null && <span style={{ fontSize: 11, color: 'var(--nut-prot)',  fontWeight: 600, background: 'color-mix(in srgb,var(--nut-prot) 12%,transparent)',  padding: '1px 4px', borderRadius: 3 }}>{item.prot}g P</span>}
                            {item.carbs != null && <span style={{ fontSize: 11, color: 'var(--nut-carbs)', fontWeight: 600, background: 'color-mix(in srgb,var(--nut-carbs) 12%,transparent)', padding: '1px 4px', borderRadius: 3 }}>{item.carbs}g G</span>}
                            {item.fat   != null && <span style={{ fontSize: 11, color: 'var(--nut-fat)',   fontWeight: 600, background: 'color-mix(in srgb,var(--nut-fat) 12%,transparent)',   padding: '1px 4px', borderRadius: 3 }}>{item.fat}g L</span>}
                          </div>
                        )}
                      </div>
                      <span className="mi-kcal" style={{ marginTop: hasMacros ? 2 : 0 }}>{item.kcal != null ? item.kcal + ' kcal' : '—'}</span>
                      <button className="mi-del iconbtn" onClick={() => removeItem(slot.id, item.id)} aria-label={t('Remove {0}', item.name)}>
                        <Icon name="minus" size={16} />
                      </button>
                    </div>
                  )
                })}
                <button
                  className="lrow tap"
                  style={{
                    padding: '11px 14px',
                    color: slotColor,
                    fontWeight: 600,
                    background: `color-mix(in srgb,${slotColor} 6%,transparent)`,
                    fontSize: 14,
                  }}
                  onClick={() => openAddFood(slot.id, t(slot.name))}
                >
                  <Icon name="plus" style={{ fontSize: 15 }} />
                  <span style={{ marginLeft: 7 }}>{t('Add food')}</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
