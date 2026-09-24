// frontend/scripts/build-exercises-data.js
// Regenerates src/lib/exercises-data.js from the vendored SmartWorkout snapshot
// plus the hand-authored residual cardio exercises. Re-run any time the vendored
// snapshot is refreshed (see Task 1).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const smartworkoutPath = join(__dirname, 'vendor/smartworkout-exercises-flat.json')
const outPath = join(__dirname, '../src/lib/exercises-data.js')

function transformSmartWorkout(raw) {
  return {
    id: raw.id,
    name: raw.name,
    body_part: raw.body_part,
    equipments: raw.equipments || [],
    laterality: raw.laterality,
    mechanics: raw.mechanics,
    weight_type: raw.weight_type,
    tags: raw.tags || [],
    exercise_muscles: raw.exercise_muscles || null,
    description: raw.description || null,
    description_fr: raw.description_fr || null,
    instructions: raw.instructions || { en: [] },
    tips: raw.tips || null,
    common_mistakes: raw.common_mistakes || null,
    video_dark_url: raw.video_dark_url || null,
    video_light_url: raw.video_light_url || null,
    local_video: raw.local_video || null,
    image_url: raw.image_url || null,
    img: null,
    gif: null,
    // Compatibility aliases
    n: raw.name,
    bp: raw.body_part,
    tg: dominantMuscleKey(raw.exercise_muscles),
    eq: raw.equipments && raw.equipments.length ? raw.equipments[0] : 'body weight',
  }
}

function dominantMuscleKey(muscles) {
  if (!muscles || !Object.keys(muscles).length) return null
  return Object.entries(muscles).sort((a, b) => b[1] - a[1])[0][0]
}

async function main() {
  const smartworkoutRaw = JSON.parse(readFileSync(smartworkoutPath, 'utf-8'))
  const smartworkout = smartworkoutRaw.map(transformSmartWorkout)

  const { RESIDUAL_CARDIO } = await import('../src/lib/residual-cardio-data.js')

  const all = [...smartworkout, ...RESIDUAL_CARDIO]

  const seen = new Set()
  for (const ex of all) {
    if (seen.has(ex.id)) throw new Error(`Duplicate id: ${ex.id}`)
    seen.add(ex.id)
  }

  const header = `// GENERATED FILE — do not hand-edit.\n// Regenerate with: node frontend/scripts/build-exercises-data.js\n// Source: ${smartworkoutRaw.length} SmartWorkout exercises + ${RESIDUAL_CARDIO.length} residual cardio exercises.\n`
  const body = `export const EXDB = ${JSON.stringify(all)}\n`
  writeFileSync(outPath, header + body)
  console.log(`Wrote ${all.length} exercises to ${outPath}`)
}

main()
