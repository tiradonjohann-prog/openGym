import RECIPES from '../data/recipes.json'

// Normalized Euclidean distance between a recipe's macro profile and the remaining macro budget.
// Returns 0 (perfect match) → ∞ (far from target).
// Reference scales prevent kcal from dominating the other fields.
const SCALE = { kcal: 500, prot: 40, carbs: 60, fat: 30 }

function score(recipe, remaining) {
  let sum = 0
  for (const f of ['kcal', 'prot', 'carbs', 'fat']) {
    const diff = ((recipe[f] || 0) - (remaining[f] || 0)) / SCALE[f]
    sum += diff * diff
  }
  return Math.sqrt(sum / 4)
}

function matchesAllergens(recipe, allergens) {
  if (!allergens?.length) return true
  return !(recipe.allergens || []).some(a => allergens.includes(a))
}

function matchesDiet(recipe, dietType) {
  if (!dietType || dietType === 'omnivore' || dietType === 'other') return true
  if (dietType === 'vegan')       return recipe.diet === 'vegan'
  if (dietType === 'vegetarian')  return recipe.diet === 'vegan' || recipe.diet === 'vegetarian'
  if (dietType === 'keto')        return (recipe.tags || []).includes('low-carb')
  return true
}

// Returns up to `limit` recipes sorted by best macro fit for the remaining budget.
// Recipes that exceed the remaining kcal by more than 25% are excluded.
export function suggestRecipes(remaining, { allergens = [], dietType = 'omnivore', limit = 5 } = {}) {
  const maxKcal = (remaining.kcal || 0) * 1.25
  return RECIPES
    .filter(r => matchesAllergens(r, allergens) && matchesDiet(r, dietType))
    .filter(r => !remaining.kcal || (r.kcal || 0) <= maxKcal)
    .map(r => ({ ...r, _score: score(r, remaining) }))
    .sort((a, b) => a._score - b._score)
    .slice(0, limit)
    .map(({ _score, ...r }) => r)
}
