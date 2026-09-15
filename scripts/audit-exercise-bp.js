// Exécuter : node scripts/audit-exercise-bp.js > scripts/bp-audit-report.txt
// Trouve les exercices dont le champ bp semble incohérent avec le champ tg.

const fs = require('fs')
const path = require('path')

// Lire le fichier exercises-data.js et extraire le JSON
const raw = fs.readFileSync(
  path.join(__dirname, '../frontend/src/lib/exercises-data.js'),
  'utf8'
)
// Le fichier exporte : export const EXDB=[{...}]
// On extrait le tableau JSON via regex
const match = raw.match(/export const EXDB=(\[[\s\S]*\])/)
if (!match) { console.error('Cannot parse exercises-data.js'); process.exit(1) }
const EXDB = JSON.parse(match[1])

// Mapping tg (cible musculaire) → bp attendu
const TG_TO_BP = {
  'pectorals':           'chest',
  'chest':               'chest',
  'lats':                'back',
  'upper back':          'back',
  'traps':               'back',
  'lower back':          'back',
  'spine':               'back',
  'erector spinae':      'back',
  'rhomboids':           'back',
  'anterior deltoid':    'shoulders',
  'posterior deltoid':   'shoulders',
  'lateral deltoid':     'shoulders',
  'deltoids':            'shoulders',
  'rotator cuff':        'shoulders',
  'biceps':              'upper arms',
  'triceps':             'upper arms',
  'brachialis':          'upper arms',
  'brachioradialis':     'upper arms',
  'forearms':            'lower arms',
  'wrist flexors':       'lower arms',
  'wrist extensors':     'lower arms',
  'abs':                 'waist',
  'obliques':            'waist',
  'serratus anterior':   'waist',
  'quads':               'upper legs',
  'hamstrings':          'upper legs',
  'glutes':              'upper legs',
  'adductors':           'upper legs',
  'hip abductors':       'upper legs',
  'calves':              'lower legs',
  'tibialis anterior':   'lower legs',
  'neck':                'neck',
  'cardiovascular system': 'cardio',
}

const suspects = []
for (const ex of EXDB) {
  const expectedBp = TG_TO_BP[ex.tg]
  if (expectedBp && expectedBp !== ex.bp) {
    suspects.push({ id: ex.id, name: ex.n, currentBp: ex.bp, tg: ex.tg, expectedBp })
  }
}

// Grouper par paire (currentBp → expectedBp) pour voir les patterns
const groups = {}
suspects.forEach(s => {
  const key = `${s.currentBp} → ${s.expectedBp}`
  if (!groups[key]) groups[key] = []
  groups[key].push(s)
})

console.log(`=== AUDIT bp/tg — ${suspects.length} suspects sur ${EXDB.length} exercices ===\n`)
Object.entries(groups)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([key, exs]) => {
    console.log(`\n[${key}] — ${exs.length} exercice(s)`)
    exs.slice(0, 10).forEach(e => {
      console.log(`  ID=${e.id} | "${e.name}" | tg="${e.tg}"`)
    })
    if (exs.length > 10) console.log(`  ... et ${exs.length - 10} autres`)
  })

// Exporter la liste complète en JSON pour corriger par script
fs.writeFileSync(
  path.join(__dirname, 'bp-suspects.json'),
  JSON.stringify(suspects, null, 2)
)
console.log('\n→ Liste complète sauvegardée dans scripts/bp-suspects.json')
