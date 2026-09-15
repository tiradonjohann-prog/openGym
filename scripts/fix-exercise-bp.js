// Exécuter : node scripts/fix-exercise-bp.js
// Applique les corrections bp sur exercises-data.js en se basant sur le tg.
// NE corrige que les cas sans ambiguïté (chest↔back).

const fs   = require('fs')
const path = require('path')

// Lire bp-suspects.json (généré par l'audit)
const suspects = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'bp-suspects.json'), 'utf8')
)

// Cas sans ambiguïté à corriger automatiquement
// (Exclure les cas where both bp values are defensible)
const UNAMBIGUOUS_TG = new Set([
  'pectorals', 'chest',           // toujours chest
  'lats', 'upper back', 'traps', 'erector spinae', 'rhomboids',  // toujours back
])

const toFix = suspects.filter(s => UNAMBIGUOUS_TG.has(s.tg))
console.log(`Correction automatique de ${toFix.length} exercices...`)

const fixMap = {}
toFix.forEach(s => { fixMap[s.id] = s.expectedBp })

const rawPath = path.join(__dirname, '../frontend/src/lib/exercises-data.js')
let raw = fs.readFileSync(rawPath, 'utf8')
const match = raw.match(/export const EXDB=(\[[\s\S]*\])/)
if (!match) { console.error('Cannot parse exercises-data.js'); process.exit(1) }

let EXDB = JSON.parse(match[1])
let count = 0
EXDB = EXDB.map(ex => {
  if (fixMap[ex.id] && ex.bp !== fixMap[ex.id]) {
    console.log(`  Fix: "${ex.n}" : ${ex.bp} → ${fixMap[ex.id]}`)
    count++
    return { ...ex, bp: fixMap[ex.id] }
  }
  return ex
})

const newRaw = raw.replace(/export const EXDB=\[[\s\S]*\]/, 'export const EXDB=' + JSON.stringify(EXDB))
fs.writeFileSync(rawPath, newRaw, 'utf8')
console.log(`\n✓ ${count} exercices corrigés dans exercises-data.js`)
