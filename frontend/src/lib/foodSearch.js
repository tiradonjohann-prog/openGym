import { CIQUAL } from './ciqual-data.js'

const _norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function searchCiqual(query) {
  const words = _norm(query.trim()).split(/\s+/).filter(w => w.length >= 2)
  if (!words.length) return []
  return CIQUAL.filter(item => {
    const n = _norm(item.name)
    return words.every(w => n.includes(w))
  }).slice(0, 12)
}

// Open Food Facts API wrapper.
// API docs: https://wiki.openfoodfacts.org/API
//
// Macros are returned as-is from the API — null means the data is absent,
// never 0-filled. The UI shows "Incomplete data" rather than a false zero.

const OFF_API = 'https://fr.openfoodfacts.org/cgi/search.pl'
const TIMEOUT_MS = 8000

function normalize(product) {
  const n = product.nutriments || {}
  // OFF stores energy in kJ in energy_100g; kcal in energy-kcal_100g when present
  const kcal = n['energy-kcal_100g'] != null
    ? Math.round(n['energy-kcal_100g'])
    : n['energy_100g'] != null
      ? Math.round(n['energy_100g'] / 4.184)
      : null

  const round1 = v => (v != null ? Math.round(v * 10) / 10 : null)

  return {
    id: product.id || product.code || null,
    name: (product.product_name || product.generic_name || '').trim() || 'Unknown product',
    brand: product.brands || null,
    qty: 100,
    unit: 'g',
    kcal,
    prot:  round1(n.proteins_100g        ?? null),
    carbs: round1(n.carbohydrates_100g   ?? null),
    fat:   round1(n.fat_100g             ?? null),
    fiber: round1(n.fiber_100g           ?? null),
    source: 'off',
    complete: kcal != null
           && n.proteins_100g      != null
           && n.carbohydrates_100g != null
           && n.fat_100g           != null,
  }
}

export async function searchFood(query, signal) {
  if (!query || query.trim().length < 2) return []

  const url = new URL(OFF_API)
  url.searchParams.set('search_terms', query.trim())
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', '20')
  url.searchParams.set('fields', 'id,code,product_name,generic_name,brands,nutriments')

  const fallback = new AbortController()
  const tm = setTimeout(() => fallback.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url.toString(), {
      signal: signal ?? fallback.signal,
      headers: { 'User-Agent': 'openGym/1.0 (self-hosted fitness tracker; contact: openGym)' },
    })
    if (!res.ok) throw new Error('Search failed')
    const data = await res.json()
    return (data.products || [])
      .filter(p => p.product_name || p.generic_name)
      .map(normalize)
  } finally {
    clearTimeout(tm)
  }
}

// Scale a 100g-based item to any gram quantity
export function scaleItem(item, qty) {
  if (!qty || qty === 100) return { ...item, qty }
  const f = qty / 100
  const s = v => (v != null ? Math.round(v * f * 10) / 10 : null)
  return {
    ...item, qty,
    kcal:  item.kcal != null ? Math.round(item.kcal * f) : null,
    prot:  s(item.prot),
    carbs: s(item.carbs),
    fat:   s(item.fat),
    fiber: s(item.fiber),
  }
}

// Macro totals for a given date's meals
export function dayTotals(log, date) {
  const meals = log?.[date]?.meals || []
  let kcal = 0, prot = 0, carbs = 0, fat = 0, fiber = 0
  meals.forEach(m => m.items.forEach(i => {
    kcal  += i.kcal  || 0
    prot  += i.prot  || 0
    carbs += i.carbs || 0
    fat   += i.fat   || 0
    fiber += i.fiber || 0
  }))
  return {
    kcal:  Math.round(kcal),
    prot:  Math.round(prot  * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat:   Math.round(fat   * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
  }
}

// Average daily totals over the last 7 days that have at least 1 logged item
export function weekAverages(log, today) {
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    const t = dayTotals(log, iso)
    if (t.kcal > 0) days.push(t)
  }
  if (!days.length) return null
  const n = days.length
  const avg = f => Math.round(days.reduce((s, d) => s + d[f], 0) / n * 10) / 10
  return {
    kcal:  Math.round(days.reduce((s, d) => s + d.kcal, 0) / n),
    prot:  avg('prot'),
    carbs: avg('carbs'),
    fat:   avg('fat'),
    fiber: avg('fiber'),
    days:  n,
  }
}

// Remove log entries older than `keepDays` (default 90)
export function pruneLog(log, today, keepDays = 90) {
  const cutoff = new Date(today + 'T12:00:00')
  cutoff.setDate(cutoff.getDate() - keepDays)
  const result = {}
  Object.keys(log || {}).forEach(date => {
    if (new Date(date + 'T12:00:00') >= cutoff) result[date] = log[date]
  })
  return result
}
