// Generates the openGym program template as a proper Excel workbook (.xlsx).
// Uses ExcelJS (dynamically imported — does not increase initial bundle size).
//
// Template structure:
//   Sheet "Programme" — input sheet with frozen header + dropdown validations
//   Sheet "Lists"     — hidden reference sheet; one column per muscle group
//
// Cascading dropdown mechanism:
//   Column E = Muscle group    → standard list validation from all body parts
//   Column F = Exercise        → INDIRECT(SUBSTITUTE(E2," ","_")) lookup
//
// Each body part has a named range (e.g., "upper_legs") pointing to its
// exercises column in the Lists sheet.  The SUBSTITUTE converts the display
// name ("upper legs") to the named range name ("upper_legs") at runtime in
// Excel, so the exercise list refreshes automatically when the muscle group
// is changed.

import { EXDB } from './exercises.js'

// Sorted list of all body parts present in the exercise database
const BODY_PARTS = [...new Set(EXDB.map(e => e.bp))].sort()
// ['back','cardio','chest','lower arms','lower legs','neck','shoulders','upper arms','upper legs','waist']

// Named range names must not contain spaces → replace with underscores
const toRangeName = bp => bp.replace(/ /g, '_')

// Excel column letter from 0-based index: 0→'A', 1→'B', …
const colLetter = i => String.fromCharCode(65 + i)

// Exercises per body part, alpha-sorted
function buildByBp() {
  const map = {}
  BODY_PARTS.forEach(bp => {
    map[bp] = EXDB.filter(e => e.bp === bp).map(e => e.n).sort()
  })
  return map
}

export async function downloadExcelTemplate() {
  // Dynamic import: ExcelJS loads only when the user clicks "Download template"
  const { default: ExcelJS } = await import('exceljs')

  const byBp = buildByBp()
  const wb   = new ExcelJS.Workbook()
  wb.creator  = 'openGym'
  wb.created  = new Date()

  // ── 1. Lists reference sheet (hidden) ─────────────────────────────────
  // One column per body part; row 1 = range-name header, rows 2+ = exercises.
  // This sheet is hidden from the user; it exists only to back the named ranges.
  const listsWs = wb.addWorksheet('Lists', { state: 'veryHidden' })

  BODY_PARTS.forEach((bp, colIdx) => {
    const col = listsWs.getColumn(colIdx + 1)
    col.width = 40
    listsWs.getCell(1, colIdx + 1).value = toRangeName(bp)
    byBp[bp].forEach((name, rowIdx) => {
      listsWs.getCell(rowIdx + 2, colIdx + 1).value = name
    })
  })

  // ── 2. Named ranges (one per body part, workbook-scoped) ───────────────
  // ExcelJS definedNames.add(locStr, name) — locStr = range reference
  BODY_PARTS.forEach((bp, colIdx) => {
    const count    = byBp[bp].length
    const col      = colLetter(colIdx)
    const rangeRef = `Lists!$${col}$2:$${col}$${count + 1}`
    wb.definedNames.add(rangeRef, toRangeName(bp))
  })

  // ── 3. Instructions sheet ──────────────────────────────────────────────
  const instrWs = wb.addWorksheet('Instructions')
  instrWs.getColumn(1).width = 78

  const instr = [
    ["openGym — Template d'import de programme"],
    [""],
    ["COLONNES"],
    ["  Programme        : Nom du programme (toutes les seances partagent le meme nom)"],
    ["  Seance           : Nom de la session d'entrainement (ex: Upper A, Lower A, Push)"],
    ["  N Seance         : Numero de la seance — 1, 2, 3... (ordre dans la semaine)"],
    ["  N Exercice       : Numero de l'exercice dans la seance"],
    ["                       1, 2, 3     => exercice normal"],
    ["                       2A, 2B      => superset : 2A et 2B sont lies ensemble"],
    ["                       3A, 3B, 3C  => tri-set : 3 mouvements enchaines"],
    ["                       Repos entre A et B = 0 sec, repos apres B = temps normal"],
    ["  Groupe Musculaire : Selectionner dans la liste deroulante"],
    ["  Exercice          : Liste deroulante filtree selon le groupe musculaire choisi"],
    ["  Tempo             : Code 4 chiffres : Excentrique – Pause bas – Concentrique – Pause haut"],
    ["                       Exemple : 4010 = 4s descente, 0s pause, 1s montee, 0s pause haute"],
    ["                       Laisser vide si pas de tempo impose"],
    ["  Series            : Nombre de series (ex: 4)"],
    ["  Repetitions       : Nombre de repetitions par serie (ex: 10, 12, 8...)"],
    ["  Poids (kg)        : Laisser vide — l'utilisateur entre son propre poids dans l'app"],
    ["  Repos (sec)       : Temps de recuperation entre les series, en secondes (ex: 90)"],
    [""],
    ["EXEMPLE SUPERSET"],
    ["  Ligne 1 : N Exercice = 2A | Exercice = Developpe incline | Repos = 0"],
    ["  Ligne 2 : N Exercice = 2B | Exercice = Ecarte poulie haute | Repos = 60"],
    ["  => L'app affiche Superset et enchaine les deux sans repos entre eux."],
    [""],
    ["IMPORT"],
    ["  1. Remplissez l'onglet Programme ci-dessous"],
    ["  2. Dans l'app : Plan => icone partage => Import programme Excel/CSV"],
    ["  3. Selectionnez ce fichier .xlsx directement (pas besoin de convertir en CSV)"],
  ]
  instr.forEach((row, i) => {
    const cell = instrWs.getCell(i + 1, 1)
    cell.value = row[0]
    if (i === 0) { cell.font = { bold: true, size: 14 } }
    if (i === 2 || i === 20 || i === 27) { cell.font = { bold: true } }
  })

  // ── 4. Programme input sheet ───────────────────────────────────────────
  const ws = wb.addWorksheet('Programme')

  ws.columns = [
    { header: 'Programme',          key: 'prog',    width: 22 },
    { header: 'Séance',             key: 'session', width: 16 },
    { header: 'N° Séance',         key: 'sesNum',  width: 12 },
    { header: 'N° Exercice',       key: 'exNum',   width: 14 },
    { header: 'Groupe Musculaire', key: 'bp',      width: 22 },
    { header: 'Exercice',          key: 'ex',      width: 42 },
    { header: 'Tempo',             key: 'tempo',   width: 10 },
    { header: 'Séries',            key: 'sets',    width: 10 },
    { header: 'Répétitions',      key: 'reps',    width: 14 },
    { header: 'Poids (kg)',        key: 'weight',  width: 13 },
    { header: 'Repos (sec)',       key: 'rest',    width: 13 },
  ]

  // Header styling
  const hdr = ws.getRow(1)
  hdr.height = 22
  hdr.eachCell(cell => {
    cell.font       = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } }
    cell.alignment  = { vertical: 'middle', horizontal: 'center' }
    cell.border     = { bottom: { style: 'thin', color: { argb: 'FF334155' } } }
  })

  // Freeze header row
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }]

  // Example rows — demonstrate normal, superset, and tri-set
  const examples = [
    { prog: 'Mon Programme', session: 'Upper A', sesNum: 1, exNum: 1,   bp: 'chest',       ex: 'Barbell Bench Press',    tempo: '4010', sets: 4, reps: 8,  weight: '', rest: 90 },
    { prog: 'Mon Programme', session: 'Upper A', sesNum: 1, exNum: '2A',bp: 'shoulders',   ex: 'Barbell Overhead Press', tempo: '',     sets: 3, reps: 10, weight: '', rest: 0  },
    { prog: 'Mon Programme', session: 'Upper A', sesNum: 1, exNum: '2B',bp: 'upper arms',  ex: 'Triceps Pushdown',       tempo: '',     sets: 3, reps: 12, weight: '', rest: 60 },
    { prog: 'Mon Programme', session: 'Upper A', sesNum: 1, exNum: 3,   bp: 'back',        ex: 'Pull-up',                tempo: '3010', sets: 4, reps: 8,  weight: '', rest: 90 },
    { prog: 'Mon Programme', session: 'Lower A', sesNum: 2, exNum: 1,   bp: 'upper legs',  ex: 'Barbell Back Squat',     tempo: '4010', sets: 4, reps: 6,  weight: '', rest: 120},
    { prog: 'Mon Programme', session: 'Lower A', sesNum: 2, exNum: 2,   bp: 'upper legs',  ex: 'Romanian Deadlift',      tempo: '',     sets: 3, reps: 10, weight: '', rest: 90 },
    { prog: 'Mon Programme', session: 'Lower A', sesNum: 2, exNum: 3,   bp: 'lower legs',  ex: 'Standing Calf Raise',    tempo: '',     sets: 4, reps: 15, weight: '', rest: 60 },
  ]

  examples.forEach((ex, i) => {
    const row = ws.addRow([
      ex.prog, ex.session, ex.sesNum, ex.exNum,
      ex.bp, ex.ex, ex.tempo, ex.sets, ex.reps, ex.weight, ex.rest,
    ])
    row.height = 18
    // Highlight superset rows
    const isSS = typeof ex.exNum === 'string' && /^[0-9]+[A-Z]$/i.test(ex.exNum)
    if (isSS) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
      })
      row.getCell(4).font = { bold: true, color: { argb: 'FF2563EB' } }
    }
    row.getCell(5).font = { color: { argb: 'FF7C3AED' } }  // muscle group
    row.getCell(6).font = { color: { argb: 'FF059669' } }  // exercise name
  })

  // ── 5. Data validation: Muscle Group (E2:E2000) ───────────────────────
  // Identical formula for every row → ExcelJS consolidates into one sqref entry
  const bpListFormula = '"' + BODY_PARTS.join(',') + '"'
  const bpDv = { type: 'list', allowBlank: true, formulae: [bpListFormula], showErrorMessage: false }
  for (let row = 2; row <= 2000; row++) ws.getCell(row, 5).dataValidation = bpDv

  // ── 6. Data validation: Exercise (F2:F2000) — cascading via INDIRECT ─
  // Formula uses E2 as anchor; Excel adjusts relative reference per row.
  // All cells share the same formula string → consolidated into one sqref.
  const exDv = {
    type: 'list',
    allowBlank: true,
    formulae: ['INDIRECT(SUBSTITUTE(E2," ","_"))'],
    showErrorMessage: false,
  }
  for (let row = 2; row <= 2000; row++) ws.getCell(row, 6).dataValidation = exDv

  // Alternate row shading for user-added rows (after examples)
  for (let row = examples.length + 2; row <= 2000; row++) {
    if (row % 2 === 0) {
      ws.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
    }
  }

  // ── 7. Download ────────────────────────────────────────────────────────
  const buf  = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'opengym-programme-template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
