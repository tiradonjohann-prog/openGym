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
import { MOBILE, shareMobileFile } from './mobile.js'

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
    ["openGym — Template d'import de programme"],                                                       // 0
    [""],                                                                                                // 1
    ["COLONNES — EXERCICES (colonnes A a K)"],                                                          // 2
    ["  Programme        : Nom du programme (toutes les seances partagent le meme nom)"],               // 3
    ["  Seance           : Nom de la seance (ex: Upper A, Lower A, Push)"],                             // 4
    ["  N Seance         : Numero de la seance — 1, 2, 3... (ordre dans la semaine)"],                  // 5
    ["  N Exercice       : Numero de l'exercice dans la seance"],                                       // 6
    ["                       1, 2, 3     => exercice normal"],                                          // 7
    ["                       2A, 2B      => superset : 2A et 2B sont lies ensemble"],                   // 8
    ["                       3A, 3B, 3C  => tri-set : 3 mouvements enchaines"],                         // 9
    ["                       Repos entre A et B = 0 sec, repos apres B = temps normal"],                // 10
    ["  Groupe Musculaire : Selectionner dans la liste deroulante"],                                    // 11
    ["  Exercice          : Liste deroulante filtree selon le groupe musculaire choisi"],                // 12
    ["  Tempo             : Code 4 chiffres : Excentrique - Pause bas - Concentrique - Pause haut"],    // 13
    ["                       Exemple : 4010 = 4s descente, 0s pause, 1s montee, 0s pause haute"],      // 14
    ["                       Laisser vide si pas de tempo impose"],                                     // 15
    ["  Series            : Nombre de series (ex: 4)"],                                                 // 16
    ["  Repetitions       : Nombre de repetitions par serie (ex: 10, 12, 8...)"],                       // 17
    ["  Poids (kg)        : Laisser vide - l'utilisateur entre son propre poids dans l'app"],           // 18
    ["  Repos (sec)       : Temps de recuperation entre les series, en secondes (ex: 90)"],             // 19
    [""],                                                                                                // 20
    ["COLONNES — CARDIO (colonnes L a S)"],                                                             // 21
    ["  Type Cardio    : warmup = echauffement | steady = allure constante | interval = fractionne | cooldown = retour au calme"], // 22
    ["  Sport Cardio   : run, walk, bike, swim, aqua"],                                                 // 23
    ["  Duree (min)    : Duree totale du bloc en minutes (non utilise pour type 'interval')"],           // 24
    ["  Distance (km)  : Distance cible en km (optionnel)"],                                            // 25
    ["  Intensite (1-5): 1 = Tres facile | 2 = Facile | 3 = Modere | 4 = Difficile | 5 = Maximal"],    // 26
    ["  Intervalles (x): Nombre de repetitions — uniquement pour type 'interval'"],                     // 27
    ["  Travail (s)    : Duree de l'effort en secondes — uniquement pour type 'interval'"],              // 28
    ["  Recup. (s)     : Duree de la recuperation en secondes — uniquement pour type 'interval'"],      // 29
    [""],                                                                                                // 30
    ["EXEMPLE SUPERSET"],                                                                                // 31
    ["  Ligne 1 : N Exercice = 2A | Exercice = Developpe incline | Repos = 0"],                        // 32
    ["  Ligne 2 : N Exercice = 2B | Exercice = Ecarte poulie haute | Repos = 60"],                     // 33
    ["  => L'app affiche Superset et enchaine les deux sans repos entre eux."],                         // 34
    [""],                                                                                                // 35
    ["EXEMPLE SEANCE HYBRIDE (Force + Cardio)"],                                                        // 36
    ["  Pour melanger exercices et blocs cardio dans une meme seance :"],                               // 37
    ["  - Laisser E/F/G/H/I/J/K vides sur les lignes cardio"],                                         // 38
    ["  - Laisser L/M/N/O/P/Q/R/S vides sur les lignes exercice"],                                     // 39
    ["  Ligne 1 : Type Cardio=warmup | Sport=run | Duree=10 | Intensite=2"],                           // 40
    ["  Ligne 2 : N Exercice=1 | Exercice=Barbell Bench Press | Series=3 | Reps=10"],                  // 41
    ["  Ligne 3 : N Exercice=2 | Exercice=Barbell Back Squat | Series=3 | Reps=8"],                    // 42
    ["  Ligne 4 : Type Cardio=interval | Sport=run | Intervalles=6 | Travail=60 | Recup=90 | Intensite=4"], // 43
    ["  Ligne 5 : Type Cardio=cooldown | Sport=run | Duree=5 | Intensite=1"],                          // 44
    [""],                                                                                                // 45
    ["IMPORT"],                                                                                          // 46
    ["  1. Remplissez l'onglet Programme ci-dessous"],                                                  // 47
    ["  2. Dans l'app : Plan => icone partage => Import programme Excel/CSV"],                          // 48
    ["  3. Selectionnez ce fichier .xlsx directement (pas besoin de convertir en CSV)"],                // 49
  ]
  const boldIdxs = new Set([2, 21, 31, 36, 46])
  instr.forEach((row, i) => {
    const cell = instrWs.getCell(i + 1, 1)
    cell.value = row[0]
    if (i === 0) { cell.font = { bold: true, size: 14 } }
    else if (boldIdxs.has(i)) { cell.font = { bold: true } }
  })

  // ── 4. Programme input sheet ───────────────────────────────────────────
  const ws = wb.addWorksheet('Programme')

  ws.columns = [
    { header: 'Programme',          key: 'prog',       width: 22 },
    { header: 'Séance',             key: 'session',    width: 16 },
    { header: 'N° Séance',         key: 'sesNum',     width: 12 },
    { header: 'N° Exercice',       key: 'exNum',      width: 14 },
    { header: 'Groupe Musculaire', key: 'bp',         width: 22 },
    { header: 'Exercice',          key: 'ex',         width: 42 },
    { header: 'Tempo',             key: 'tempo',      width: 10 },
    { header: 'Séries',            key: 'sets',       width: 10 },
    { header: 'Répétitions',      key: 'reps',       width: 14 },
    { header: 'Poids (kg)',        key: 'weight',     width: 13 },
    { header: 'Repos (sec)',       key: 'rest',       width: 13 },
    { header: 'Type Cardio',       key: 'cardioType', width: 16 },
    { header: 'Sport Cardio',      key: 'cardioSport',width: 14 },
    { header: 'Durée (min)',       key: 'cardioDur',  width: 12 },
    { header: 'Distance (km)',     key: 'cardioDist', width: 14 },
    { header: 'Intensité (1-5)',   key: 'cardioInt',  width: 16 },
    { header: 'Intervalles (×)',   key: 'cardioRep',  width: 14 },
    { header: 'Travail (s)',       key: 'cardioWork', width: 12 },
    { header: 'Récup. (s)',        key: 'cardioRest', width: 12 },
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

  // Cardio columns header (L–S) — teal to distinguish from strength columns
  for (let c = 12; c <= 19; c++) {
    const cell = ws.getRow(1).getCell(c)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }
  }

  // Freeze header row
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }]

  // Example rows — demonstrate normal, superset, and tri-set
  const C = ''  // empty cell shorthand
  const examples = [
    // ── Upper A — pure strength with superset ──────────────────────────────
    { prog: 'Mon Programme', session: 'Upper A', sesNum: 1, exNum: 1,    bp: 'chest',      ex: 'Barbell Bench Press',    tempo: '4010', sets: 4, reps: 8,  weight: C, rest: 90,  cardioType: C, cardioSport: C, cardioDur: C, cardioDist: C, cardioInt: C, cardioRep: C, cardioWork: C, cardioRest: C },
    { prog: 'Mon Programme', session: 'Upper A', sesNum: 1, exNum: '2A', bp: 'shoulders',  ex: 'Barbell Overhead Press', tempo: '',     sets: 3, reps: 10, weight: C, rest: 0,   cardioType: C, cardioSport: C, cardioDur: C, cardioDist: C, cardioInt: C, cardioRep: C, cardioWork: C, cardioRest: C },
    { prog: 'Mon Programme', session: 'Upper A', sesNum: 1, exNum: '2B', bp: 'upper arms', ex: 'Triceps Pushdown',       tempo: '',     sets: 3, reps: 12, weight: C, rest: 60,  cardioType: C, cardioSport: C, cardioDur: C, cardioDist: C, cardioInt: C, cardioRep: C, cardioWork: C, cardioRest: C },
    { prog: 'Mon Programme', session: 'Upper A', sesNum: 1, exNum: 3,    bp: 'back',       ex: 'Pull-up',                tempo: '3010', sets: 4, reps: 8,  weight: C, rest: 90,  cardioType: C, cardioSport: C, cardioDur: C, cardioDist: C, cardioInt: C, cardioRep: C, cardioWork: C, cardioRest: C },
    // ── Lower A — pure strength ────────────────────────────────────────────
    { prog: 'Mon Programme', session: 'Lower A', sesNum: 2, exNum: 1,    bp: 'upper legs', ex: 'Barbell Back Squat',     tempo: '4010', sets: 4, reps: 6,  weight: C, rest: 120, cardioType: C, cardioSport: C, cardioDur: C, cardioDist: C, cardioInt: C, cardioRep: C, cardioWork: C, cardioRest: C },
    { prog: 'Mon Programme', session: 'Lower A', sesNum: 2, exNum: 2,    bp: 'upper legs', ex: 'Romanian Deadlift',      tempo: '',     sets: 3, reps: 10, weight: C, rest: 90,  cardioType: C, cardioSport: C, cardioDur: C, cardioDist: C, cardioInt: C, cardioRep: C, cardioWork: C, cardioRest: C },
    { prog: 'Mon Programme', session: 'Lower A', sesNum: 2, exNum: 3,    bp: 'lower legs', ex: 'Standing Calf Raise',    tempo: '',     sets: 4, reps: 15, weight: C, rest: 60,  cardioType: C, cardioSport: C, cardioDur: C, cardioDist: C, cardioInt: C, cardioRep: C, cardioWork: C, cardioRest: C },
    // ── Full Body — hybride force + cardio ─────────────────────────────────
    { prog: 'Mon Programme', session: 'Full Body', sesNum: 3, exNum: C, bp: C, ex: C, tempo: C, sets: C, reps: C, weight: C, rest: C, cardioType: 'warmup',   cardioSport: 'run', cardioDur: 10, cardioDist: C, cardioInt: '2 - Facile',    cardioRep: C, cardioWork: C,  cardioRest: C  },
    { prog: 'Mon Programme', session: 'Full Body', sesNum: 3, exNum: 1,  bp: 'chest',      ex: 'Barbell Bench Press',   tempo: '4010', sets: 3, reps: 10, weight: C, rest: 90,  cardioType: C, cardioSport: C, cardioDur: C, cardioDist: C, cardioInt: C, cardioRep: C, cardioWork: C, cardioRest: C },
    { prog: 'Mon Programme', session: 'Full Body', sesNum: 3, exNum: 2,  bp: 'upper legs', ex: 'Barbell Back Squat',    tempo: '4010', sets: 3, reps: 8,  weight: C, rest: 120, cardioType: C, cardioSport: C, cardioDur: C, cardioDist: C, cardioInt: C, cardioRep: C, cardioWork: C, cardioRest: C },
    { prog: 'Mon Programme', session: 'Full Body', sesNum: 3, exNum: C, bp: C, ex: C, tempo: C, sets: C, reps: C, weight: C, rest: C, cardioType: 'interval', cardioSport: 'run', cardioDur: C,  cardioDist: C, cardioInt: '4 - Difficile', cardioRep: 6, cardioWork: 60, cardioRest: 90 },
    { prog: 'Mon Programme', session: 'Full Body', sesNum: 3, exNum: C, bp: C, ex: C, tempo: C, sets: C, reps: C, weight: C, rest: C, cardioType: 'cooldown', cardioSport: 'run', cardioDur: 5,  cardioDist: C, cardioInt: '1 - Tres facile',cardioRep: C, cardioWork: C,  cardioRest: C  },
  ]

  examples.forEach((ex, i) => {
    const row = ws.addRow([
      ex.prog, ex.session, ex.sesNum, ex.exNum,
      ex.bp, ex.ex, ex.tempo, ex.sets, ex.reps, ex.weight, ex.rest,
      ex.cardioType, ex.cardioSport, ex.cardioDur, ex.cardioDist,
      ex.cardioInt, ex.cardioRep, ex.cardioWork, ex.cardioRest,
    ])
    row.height = 18
    const isSS = typeof ex.exNum === 'string' && /^[0-9]+[A-Z]$/i.test(ex.exNum)
    const isCardioRow = !!ex.cardioType
    if (isSS) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
      })
      row.getCell(4).font = { bold: true, color: { argb: 'FF2563EB' } }
    }
    if (isCardioRow) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6FFFA' } }
      })
      row.getCell(12).font = { bold: true, color: { argb: 'FF0D9488' } }
      row.getCell(13).font = { color: { argb: 'FF0D9488' } }
    } else {
      row.getCell(5).font = { color: { argb: 'FF7C3AED' } }
      row.getCell(6).font = { color: { argb: 'FF059669' } }
    }
  })

  // ── 5. Data validation: Muscle Group (E2:E2000) ───────────────────────
  const bpListFormula = '"' + BODY_PARTS.join(',') + '"'
  ws.dataValidations.add('E2:E2000', { type: 'list', allowBlank: true, formulae: [bpListFormula], showErrorMessage: false })

  // ── 5b. Data validation: Cardio fields (L, M, P) ─────────────────────
  ws.dataValidations.add('L2:L2000', { type: 'list', allowBlank: true, formulae: ['"warmup,steady,interval,cooldown"'], showErrorMessage: false })
  ws.dataValidations.add('M2:M2000', { type: 'list', allowBlank: true, formulae: ['"run,walk,bike,swim,aqua"'], showErrorMessage: false })
  ws.dataValidations.add('P2:P2000', { type: 'list', allowBlank: true, formulae: ['"1 - Tres facile,2 - Facile,3 - Modere,4 - Difficile,5 - Maximal"'], showErrorMessage: false })

  // ── 6. Data validation: Exercise (F2:F2000) — cascading via INDIRECT ─
  // Single range → one <dataValidation sqref="F2:F2000"> entry in the XML.
  // Excel resolves E2 as a relative reference per row: F10 reads E10, etc.
  // Cell-by-cell loops produce multiple overlapping sqref entries whose
  // relative anchors break (F10 reads E2 instead of E10).
  ws.dataValidations.add('F2:F2000', { type: 'list', allowBlank: true, formulae: ['INDIRECT(SUBSTITUTE(E2," ","_"))'], showErrorMessage: false })

  // Alternate row shading for user-added rows (after examples)
  for (let row = examples.length + 2; row <= 2000; row++) {
    if (row % 2 === 0) {
      ws.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
    }
  }

  // ── 7. Download ────────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer()

  if (MOBILE) {
    await shareMobileFile(
      buf,
      'opengym-programme-template.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    return
  }

  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'opengym-programme-template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
