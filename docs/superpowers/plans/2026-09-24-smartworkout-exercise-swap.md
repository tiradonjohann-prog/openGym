# Remplacement du catalogue d'exercices par SmartWorkout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OpenGym's 1324-exercise catalog with the 811-exercise SmartWorkout catalog (already translated to French in Anatomy Viewer) plus 26 preserved "cardio résiduel" exercises, adding rich video/muscle/tips content and reworked filters, while keeping every existing consumer (routines, history, PRs, Excel import/export, custom exercises) working via compatibility aliases — no behavior-breaking rename across the ~49 existing call sites that read exercise fields.

**Architecture:** A generated single-source-of-truth data file (`frontend/src/lib/exercises-data.js`) replaces the old dataset. Each record carries native SmartWorkout field names (`name`, `body_part`, `equipments`, `exercise_muscles`, `instructions`, `tips`, `common_mistakes`, video URLs) PLUS four compatibility aliases (`n`, `bp`, `tg`, `eq`) computed once at generation time so existing display code needs zero rewiring. New capability code (detail sheet, filters, video resolver) reads the native fields directly.

**Tech Stack:** React 19 (JSX), Vite, Zustand, ExcelJS, Vitest. Data generation via a one-off Node script (no new runtime dependency).

**Spec:** `docs/superpowers/specs/2026-09-24-smartworkout-exercise-swap-design.md`

## Global Constraints

- No migration of existing user data — clean cut, verified with the user (spec §"Décisions actées").
- Exercise **names** stay in English (never translated) — per user decision.
- Exercise **content** (description, instructions, tips, common mistakes) target French + English only. Other 9 UI languages keep translated UI chrome but fall back to English for exercise content — no new work for them.
- Video priority order: `video_dark_url || video_light_url || local /videos/<name>.mp4 fallback` — CDN-first, local-hosting-ready but not activated.
- Every existing call site reading `.n`, `.bp`, `.tg`, `.eq` on an exercise object must keep working unmodified — these are the four compatibility aliases. Any new code (filters, detail view) reads native fields (`name`, `body_part`, `equipments`, `exercise_muscles`, ...) directly, never the aliases.
- `isCardio()` semantics: an exercise is cardio if `bp === 'CARDIO'` (uppercase — matches the new taxonomy, differs from the old lowercase `'cardio'`).
- All new French UI strings/labels are added as literal dictionaries — do NOT route enum codes (`ABS`, `PULL_UP_BAR`, ...) through the existing `t()` function (it maps English *phrases* to translations, not enum codes; passing a code like `'PULL_UP_BAR'` through `t()` returns it unchanged, breaking the "tout en français" requirement) — except for `eq === 'body weight'`, which already has a working `t()` entry and stays routed through `t()` for backward-compatible sentinel handling.
- `npm test` (in `frontend/`) must stay green throughout, especially `progression.test.js`, `programImport.test.js`, `history.test.js`.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `frontend/scripts/vendor/smartworkout-exercises-flat.json` | **New (vendored copy)** | Snapshot of Anatomy Viewer's 811-exercise SmartWorkout catalog, frozen at swap time |
| `frontend/src/lib/residual-cardio-data.js` | **New** | 26 hand-authored "cardio résiduel" exercises (EN+FR), unified schema |
| `frontend/scripts/build-exercises-data.js` | **New** | Re-runnable generator: merges vendored SmartWorkout JSON + residuals → emits `exercises-data.js` |
| `frontend/src/lib/exercises-data.js` | **Replaced** | Generated output — 837 exercise records (do not hand-edit) |
| `frontend/src/lib/exercises-data.test.js` | **New** | Validates the generated catalog's shape/aliases/uniqueness |
| `frontend/src/lib/exercises.js` | **Modified** | `videoSrc()`, `photoSrc()`, `musclesOf()` added; `_sw`/enrichment removed; `isCardio()` literal updated |
| `frontend/src/lib/exerciseLabels.js` | **New** | FR label dictionaries + lookup helpers for enums and muscles |
| `frontend/src/components/Media.jsx` | **Modified** | Video/photo/gif branching using `videoSrc`/`photoSrc` |
| `frontend/src/sheets.jsx` | **Modified** | Richer `ExerciseDetail`; label helpers wired into existing badges; `SW_MUSCLE_LABELS` moved to `exerciseLabels.js` |
| `frontend/src/views/Library.jsx` | **Modified** | New multi-filter UI (search, body part, equipment, mechanics, laterality, muscle+activation) |
| `frontend/src/App.jsx` | **Modified** | Remove `loadSwEnrichment()` call |
| `frontend/src/lib/excelTemplate.js` | **Modified** | FR body-part labels in dropdown; regenerated lists |
| `frontend/src/views/Onboarding.jsx` | **Modified** | Equipment picker adapted to new equipment values |
| `frontend/src/lib/demoSeed.js` | **Modified** | Demo data regenerated against new catalog |
| `frontend/src/lib/muscles.js` | **Modified** | Muscle stats derived from `exercise_muscles` instead of `.tg` |
| `frontend/src/lib/import-csv.js` | **Audited/modified** | Legacy CSV importer checked against new fields |
| `frontend/src/lib/history.test.js` | **Modified** | Fixture selectors updated to new equipment shape |
| `frontend/src/instr/*.js` | **Removed** | Superseded by inline `instructions` on each record |

---

### Task 1: Vendor the SmartWorkout dataset snapshot

**Files:**
- Create: `frontend/scripts/vendor/smartworkout-exercises-flat.json`

**Interfaces:**
- Produces: a static JSON array of 811 objects, each shaped like Anatomy Viewer's `exercises-flat.json` (`id`, `name`, `body_part`, `equipments`, `laterality`, `mechanics`, `weight_type`, `tags`, `exercise_muscles`, `description`, `description_fr`, `instructions`, `tips`, `common_mistakes`, `video_dark_url`, `video_light_url`, `local_video`, `image_url`, `thumbnail1_url`, `thumbnail2_url`).

- [ ] **Step 1: Copy the file**

```bash
mkdir -p "frontend/scripts/vendor"
cp "../anatomy-viewer/public/data/exercises-flat.json" "frontend/scripts/vendor/smartworkout-exercises-flat.json"
```

- [ ] **Step 2: Verify the copy**

```bash
node -e "const d = require('./frontend/scripts/vendor/smartworkout-exercises-flat.json'); console.log(d.length)"
```

Expected: `811`

- [ ] **Step 3: Commit**

```bash
git add frontend/scripts/vendor/smartworkout-exercises-flat.json
git commit -m "chore: vendor SmartWorkout exercise snapshot from anatomy-viewer"
```

---

### Task 2: Author the 26 residual cardio exercises

**Files:**
- Create: `frontend/src/lib/residual-cardio-data.js`
- Test: `frontend/src/lib/residual-cardio-data.test.js`

**Interfaces:**
- Produces: `export const RESIDUAL_CARDIO` — array of 26 objects in the unified schema (native fields + `n`/`bp`/`tg`/`eq` aliases), consumed by Task 3's build script.

- [ ] **Step 1: Write the failing test**

```js
// frontend/src/lib/residual-cardio-data.test.js
import { describe, it, expect } from 'vitest'
import { RESIDUAL_CARDIO } from './residual-cardio-data.js'

describe('RESIDUAL_CARDIO', () => {
  it('has exactly 26 entries', () => {
    expect(RESIDUAL_CARDIO).toHaveLength(26)
  })

  it('every entry has required native fields and aliases', () => {
    for (const ex of RESIDUAL_CARDIO) {
      expect(ex.id).toBeTruthy()
      expect(ex.name).toBeTruthy()
      expect(ex.body_part).toBe('CARDIO')
      expect(Array.isArray(ex.equipments)).toBe(true)
      expect(ex.instructions.en.length).toBeGreaterThan(0)
      expect(ex.instructions.fr.length).toBe(ex.instructions.en.length)
      expect(ex.n).toBe(ex.name)
      expect(ex.bp).toBe('CARDIO')
      expect(ex.eq).toBe(ex.equipments.length ? ex.equipments[0] : 'body weight')
    }
  })

  it('ids are unique', () => {
    const ids = RESIDUAL_CARDIO.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/residual-cardio-data.test.js`
Expected: FAIL — `residual-cardio-data.js` does not exist

- [ ] **Step 3: Write the data file**

```js
// frontend/src/lib/residual-cardio-data.js
// 26 exercises kept from the old dataset that have no SmartWorkout equivalent
// (verified 2026-09-24: only burpee, jump rope and mountain climber overlap —
// those are dropped in favor of their SmartWorkout entries).
function mk(id, name, equipments, tg, en, fr, img, gif) {
  return {
    id, name, body_part: 'CARDIO', equipments,
    laterality: 'BILATERAL', mechanics: null, weight_type: equipments.length ? null : 'BODYWEIGHT',
    tags: ['CARDIO'], exercise_muscles: null,
    description: null, description_fr: null,
    instructions: { en, fr }, tips: null, common_mistakes: null,
    video_dark_url: null, video_light_url: null, local_video: null,
    image_url: null, img, gif,
    n: name, bp: 'CARDIO', tg, eq: equipments.length ? equipments[0] : 'body weight',
  }
}

export const RESIDUAL_CARDIO = [
  mk('3220', 'astride jumps (male)', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Bend your knees and lower your body into a squat position.", "Jump explosively upwards, extending your legs and arms.", "While in the air, spread your legs apart and bring your arms out to the sides.", "Land softly with your feet shoulder-width apart, bending your knees to absorb the impact.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Fléchissez les genoux et abaissez le corps en position de squat.", "Sautez explosivement vers le haut en étendant les jambes et les bras.", "En l'air, écartez les jambes et ouvrez les bras sur les côtés.", "Atterrissez en douceur, pieds écartés à la largeur des épaules, en fléchissant les genoux pour amortir l'impact.", "Répétez pour le nombre de répétitions souhaité."],
    '3220-f9lVSSI.jpg', '3220-f9lVSSI.gif'),

  mk('3672', 'back and forth step', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Step forward with your right foot, bending your knee and lowering your body into a lunge position.", "Push off with your right foot and step back to the starting position.", "Repeat the movement with your left foot, alternating legs with each step.", "Continue stepping back and forth, maintaining a steady pace.", "Repeat for the desired duration or number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Avancez le pied droit en fléchissant le genou pour descendre en fente.", "Repoussez avec le pied droit pour revenir à la position de départ.", "Répétez le mouvement avec le pied gauche, en alternant les jambes à chaque pas.", "Continuez à avancer et reculer en gardant un rythme régulier.", "Répétez pour la durée ou le nombre de répétitions souhaité."],
    '3672-fNGumX0.jpg', '3672-fNGumX0.gif'),

  mk('3360', 'bear crawl', [], 'cardiovascular system',
    ["Start on all fours with your hands directly under your shoulders and your knees directly under your hips.", "Lift your knees slightly off the ground, keeping your back flat and your core engaged.", "Move your right hand and left foot forward simultaneously, followed by your left hand and right foot.", "Continue crawling forward, alternating your hand and foot movements.", "Maintain a steady pace and keep your core tight throughout the exercise.", "Continue for the desired distance or time."],
    ["Placez-vous à quatre pattes, mains sous les épaules, genoux sous les hanches.", "Soulevez légèrement les genoux du sol en gardant le dos plat et le gainage engagé.", "Avancez simultanément la main droite et le pied gauche, puis la main gauche et le pied droit.", "Continuez à ramper vers l'avant en alternant mains et pieds.", "Maintenez un rythme régulier et gardez le tronc gainé pendant tout l'exercice.", "Continuez sur la distance ou la durée souhaitée."],
    '3360-0Yz8WdV.jpg', '3360-0Yz8WdV.gif'),

  mk('2331', 'cycle cross trainer', ['leverage machine'], 'cardiovascular system',
    ["Adjust the seat height and position yourself on the cycle cross trainer.", "Place your feet on the pedals and grip the handlebars.", "Start pedaling in a smooth and controlled motion.", "Maintain a steady pace and increase the resistance if desired.", "Continue pedaling for the desired duration of your cardio workout."],
    ["Réglez la hauteur et la position de la selle du vélo elliptique.", "Placez vos pieds sur les pédales et saisissez les poignées.", "Commencez à pédaler d'un mouvement fluide et contrôlé.", "Maintenez un rythme régulier et augmentez la résistance si souhaité.", "Continuez à pédaler pendant la durée souhaitée de votre séance cardio."],
    '2331-XSCHmiI.jpg', '2331-XSCHmiI.gif'),

  mk('1201', 'dumbbell burpee', ['dumbbell'], 'cardiovascular system',
    ["Start in a standing position with your feet shoulder-width apart and a dumbbell in each hand.", "Lower your body into a squat position, placing the dumbbells on the ground in front of you.", "Kick your feet back into a push-up position, keeping your body in a straight line.", "Perform a push-up, bending your elbows and lowering your chest towards the ground.", "Jump your feet back towards your hands, landing in a squat position.", "Stand up explosively, lifting the dumbbells off the ground and bringing them to your shoulders.", "Press the dumbbells overhead, fully extending your arms.", "Lower the dumbbells back to your shoulders and repeat the entire sequence for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules, un haltère dans chaque main.", "Abaissez le corps en position de squat en posant les haltères au sol devant vous.", "Ramenez les pieds en arrière pour rejoindre une position de pompe, corps aligné.", "Effectuez une pompe en fléchissant les coudes et en descendant la poitrine vers le sol.", "Ramenez les pieds vers les mains en atterrissant en position de squat.", "Relevez-vous explosivement en soulevant les haltères jusqu'aux épaules.", "Poussez les haltères au-dessus de la tête en tendant complètement les bras.", "Redescendez les haltères aux épaules et répétez la séquence complète pour le nombre de répétitions souhaité."],
    '1201-0JtKWum.jpg', '1201-0JtKWum.gif'),

  mk('3221', 'half knee bends (male)', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Bend your knees and lower your body down as if you were sitting back into a chair.", "Keep your chest up and your weight in your heels.", "Pause for a moment at the bottom, then push through your heels to return to the starting position.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Fléchissez les genoux et abaissez le corps comme pour vous asseoir sur une chaise.", "Gardez la poitrine relevée et le poids sur les talons.", "Marquez une pause en bas, puis poussez sur les talons pour revenir à la position de départ.", "Répétez pour le nombre de répétitions souhaité."],
    '3221-ia6kIIl.jpg', '3221-ia6kIIl.gif'),

  mk('3636', 'high knee against wall', [], 'cardiovascular system',
    ["Stand facing a wall with your feet hip-width apart.", "Place your hands on the wall for support.", "Engage your core and lift your right knee up towards your chest, while keeping your left foot on the ground.", "Quickly switch legs, bringing your left knee up towards your chest and lowering your right foot back down.", "Continue alternating legs in a running motion, bringing your knees up as high as possible.", "Maintain a fast pace and keep your upper body stable throughout the exercise.", "Repeat for the desired duration or number of repetitions."],
    ["Tenez-vous debout face à un mur, pieds écartés à la largeur des hanches.", "Posez les mains sur le mur pour vous soutenir.", "Gainez le tronc et levez le genou droit vers la poitrine, en gardant le pied gauche au sol.", "Changez rapidement de jambe, en levant le genou gauche vers la poitrine et en reposant le pied droit.", "Continuez à alterner les jambes dans un mouvement de course, en montant les genoux le plus haut possible.", "Maintenez un rythme rapide et gardez le haut du corps stable pendant tout l'exercice.", "Répétez pour la durée ou le nombre de répétitions souhaité."],
    '3636-ealLwvX.jpg', '3636-ealLwvX.gif'),

  mk('0501', 'jack burpee', [], 'cardiovascular system',
    ["Start in a standing position with your feet shoulder-width apart.", "Lower your body into a squat position, placing your hands on the ground in front of you.", "Kick your feet back, landing in a push-up position.", "Perform a push-up, lowering your chest to the ground and then pushing back up.", "Jump your feet forward, landing in a squat position.", "Jump up explosively, reaching your arms overhead.", "Land softly and immediately lower back into the squat position to begin the next repetition."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Abaissez le corps en position de squat en posant les mains au sol devant vous.", "Ramenez les pieds en arrière pour atterrir en position de pompe.", "Effectuez une pompe en descendant la poitrine vers le sol puis en repoussant.", "Ramenez les pieds vers l'avant en atterrissant en position de squat.", "Sautez explosivement vers le haut en tendant les bras au-dessus de la tête.", "Atterrissez en douceur et redescendez immédiatement en position de squat pour la répétition suivante."],
    '0501-mr7pkqP.jpg', '0501-mr7pkqP.gif'),

  mk('3224', 'jack jump (male)', [], 'cardiovascular system',
    ["Stand with your feet together and your arms by your sides.", "Jump up, spreading your feet apart and raising your arms above your head.", "As you land, quickly jump back to the starting position.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds joints, bras le long du corps.", "Sautez en écartant les pieds et en levant les bras au-dessus de la tête.", "En atterrissant, sautez rapidement pour revenir à la position de départ.", "Répétez pour le nombre de répétitions souhaité."],
    '3224-1g5bPpA.jpg', '3224-1g5bPpA.gif'),

  mk('3638', 'push to run', [], 'cardiovascular system',
    ["Start in a push-up position with your hands shoulder-width apart and your body in a straight line.", "Lower your chest towards the ground by bending your elbows, keeping your body straight.", "Push through your hands to extend your arms and return to the starting position.", "Quickly bring one knee towards your chest, then quickly switch and bring the other knee towards your chest.", "Continue alternating knees as fast as you can while maintaining good form.", "Continue for the desired duration or number of repetitions."],
    ["Placez-vous en position de pompe, mains écartées à la largeur des épaules, corps aligné.", "Abaissez la poitrine vers le sol en fléchissant les coudes, corps gainé.", "Poussez sur les mains pour tendre les bras et revenir à la position de départ.", "Ramenez rapidement un genou vers la poitrine, puis changez rapidement de jambe.", "Continuez à alterner les genoux le plus vite possible en gardant une bonne forme.", "Continuez pour la durée ou le nombre de répétitions souhaité."],
    '3638-PrQbjvB.jpg', '3638-PrQbjvB.gif'),

  mk('0685', 'run', [], 'cardiovascular system',
    ["Start by standing upright with your feet hip-width apart.", "Engage your core and keep your upper body relaxed.", "Begin jogging in place, lifting your knees up towards your chest and landing softly on the balls of your feet.", "Maintain a steady pace and continue jogging for the desired duration or distance.", "Remember to breathe deeply and maintain good posture throughout the exercise."],
    ["Tenez-vous debout, pieds écartés à la largeur des hanches.", "Gainez le tronc et gardez le haut du corps relâché.", "Commencez à courir sur place, en montant les genoux vers la poitrine et en atterrissant en douceur sur l'avant du pied.", "Maintenez un rythme régulier et continuez pour la durée ou la distance souhaitée.", "Respirez profondément et gardez une bonne posture pendant tout l'exercice."],
    '0685-oLrKqDH.jpg', '0685-oLrKqDH.gif'),

  mk('0684', 'run (equipment)', [], 'cardiovascular system',
    ["Start by standing upright with your feet hip-width apart.", "Engage your core and keep your upper body relaxed.", "Begin jogging in place, lifting your knees up towards your chest and landing softly on the balls of your feet.", "Maintain a steady pace and continue jogging for the desired duration or distance.", "Remember to breathe deeply and maintain good posture throughout the exercise."],
    ["Tenez-vous debout, pieds écartés à la largeur des hanches.", "Gainez le tronc et gardez le haut du corps relâché.", "Commencez à courir sur place, en montant les genoux vers la poitrine et en atterrissant en douceur sur l'avant du pied.", "Maintenez un rythme régulier et continuez pour la durée ou la distance souhaitée.", "Respirez profondément et gardez une bonne posture pendant tout l'exercice."],
    '0684-y5p0H8a.jpg', '0684-y5p0H8a.gif'),

  mk('3219', 'scissor jumps (male)', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Jump off the ground and simultaneously cross your right leg in front of your left leg.", "As you land, quickly switch legs, crossing your left leg in front of your right leg.", "Continue alternating legs and jumping as quickly as possible.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Sautez en croisant simultanément la jambe droite devant la jambe gauche.", "En atterrissant, changez rapidement de jambe en croisant la gauche devant la droite.", "Continuez à alterner les jambes en sautant le plus vite possible.", "Répétez pour le nombre de répétitions souhaité."],
    '3219-Eh2v5Iu.jpg', '3219-Eh2v5Iu.gif'),

  mk('3222', 'semi squat jump (male)', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Bend your knees and lower your body into a squat position.", "Jump explosively, extending your hips and knees while swinging your arms for momentum.", "Land softly on the balls of your feet and immediately go into the next repetition.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Fléchissez les genoux et abaissez le corps en position de squat.", "Sautez explosivement en tendant hanches et genoux, en balançant les bras pour l'élan.", "Atterrissez en douceur sur l'avant des pieds et enchaînez directement la répétition suivante.", "Répétez pour le nombre de répétitions souhaité."],
    '3222-6FMU51h.jpg', '3222-6FMU51h.gif'),

  mk('3656', 'short stride run', [], 'cardiovascular system',
    ["Find an open space or a treadmill to perform the exercise.", "Stand tall with your feet hip-width apart.", "Start jogging in place, lifting your knees high and pumping your arms.", "After a few seconds, start taking short strides forward, maintaining a quick pace.", "Continue running with short strides for the desired duration or distance."],
    ["Trouvez un espace dégagé ou un tapis de course pour l'exercice.", "Tenez-vous droit, pieds écartés à la largeur des hanches.", "Commencez à courir sur place en montant bien les genoux et en balançant les bras.", "Après quelques secondes, commencez à avancer à petites foulées rapides.", "Continuez à courir à petites foulées pour la durée ou la distance souhaitée."],
    '3656-CcWEoWV.jpg', '3656-CcWEoWV.gif'),

  mk('3361', 'skater hops', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Bend your knees slightly and jump to the right, landing on your right foot.", "As you land, swing your left leg behind your right leg and tap the ground with your left toes.", "Immediately jump to the left, landing on your left foot.", "As you land, swing your right leg behind your left leg and tap the ground with your right toes.", "Continue alternating sides, jumping and tapping the ground with each leg.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Fléchissez légèrement les genoux et sautez vers la droite en atterrissant sur le pied droit.", "En atterrissant, balancez la jambe gauche derrière la droite et touchez le sol avec les orteils gauches.", "Sautez immédiatement vers la gauche en atterrissant sur le pied gauche.", "En atterrissant, balancez la jambe droite derrière la gauche et touchez le sol avec les orteils droits.", "Continuez à alterner les côtés, en sautant et en touchant le sol à chaque jambe.", "Répétez pour le nombre de répétitions souhaité."],
    '3361-zfNHMN9.jpg', '3361-zfNHMN9.gif'),

  mk('3671', 'ski step', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart.", "Bend your knees slightly and keep your back straight.", "Jump to the right, landing on your right foot while swinging your left leg behind your right leg.", "Immediately jump to the left, landing on your left foot while swinging your right leg behind your left leg.", "Continue alternating jumps from side to side, mimicking a skiing motion.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules.", "Fléchissez légèrement les genoux et gardez le dos droit.", "Sautez vers la droite en atterrissant sur le pied droit tout en balançant la jambe gauche derrière la droite.", "Sautez immédiatement vers la gauche en atterrissant sur le pied gauche tout en balançant la jambe droite derrière la gauche.", "Continuez à alterner les sauts d'un côté à l'autre, en imitant un mouvement de ski.", "Répétez pour le nombre de répétitions souhaité."],
    '3671-5MRH8H2.jpg', '3671-5MRH8H2.gif'),

  mk('3223', 'star jump (male)', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart and your arms by your sides.", "Bend your knees slightly and jump up explosively.", "As you jump, spread your legs and extend your arms out to the sides, forming a star shape with your body.", "Land softly on the balls of your feet with your knees slightly bent.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules, bras le long du corps.", "Fléchissez légèrement les genoux et sautez explosivement vers le haut.", "En sautant, écartez les jambes et étendez les bras sur les côtés pour former une étoile.", "Atterrissez en douceur sur l'avant des pieds, genoux légèrement fléchis.", "Répétez pour le nombre de répétitions souhaité."],
    '3223-HtfCpfi.jpg', '3223-HtfCpfi.gif'),

  mk('2138', 'stationary bike run v. 3', ['stationary bike'], 'cardiovascular system',
    ["Adjust the seat height and position to ensure proper alignment.", "Place your feet on the pedals and secure them with the straps if available.", "Start pedaling at a comfortable pace.", "Maintain a steady rhythm and increase the resistance as desired.", "Engage your core muscles to maintain stability and proper posture.", "Continue pedaling for the desired duration of your workout.", "Gradually decrease the resistance and slow down before coming to a complete stop.", "Stretch your legs and cool down after the workout."],
    ["Réglez la hauteur et la position de la selle pour un bon alignement.", "Placez vos pieds sur les pédales et fixez-les avec les sangles si disponibles.", "Commencez à pédaler à un rythme confortable.", "Maintenez un rythme régulier et augmentez la résistance si souhaité.", "Gainez le tronc pour maintenir la stabilité et une bonne posture.", "Continuez à pédaler pendant la durée souhaitée de votre séance.", "Réduisez progressivement la résistance et ralentissez avant de vous arrêter complètement.", "Étirez vos jambes et récupérez après la séance."],
    '2138-H1PESYI.jpg', '2138-H1PESYI.gif'),

  mk('0798', 'stationary bike walk', ['leverage machine'], 'cardiovascular system',
    ["Adjust the seat height and position on the stationary bike to ensure proper alignment.", "Place your feet on the pedals and secure them with the straps if available.", "Start pedaling at a comfortable pace, keeping your back straight and core engaged.", "Maintain a steady rhythm and increase the resistance level if desired.", "Continue pedaling for the desired duration of your cardio workout.", "Cool down by gradually reducing your pace and resistance level.", "Stretch your leg muscles after the workout to prevent tightness and promote recovery."],
    ["Réglez la hauteur et la position de la selle du vélo stationnaire pour un bon alignement.", "Placez vos pieds sur les pédales et fixez-les avec les sangles si disponibles.", "Commencez à pédaler à un rythme confortable, dos droit et tronc gainé.", "Maintenez un rythme régulier et augmentez le niveau de résistance si souhaité.", "Continuez à pédaler pendant la durée souhaitée de votre séance cardio.", "Récupérez en réduisant progressivement le rythme et la résistance.", "Étirez les muscles des jambes après la séance pour éviter les raideurs et favoriser la récupération."],
    '0798-a8VDgLw.jpg', '0798-a8VDgLw.gif'),

  mk('3318', 'swing 360', [], 'cardiovascular system',
    ["Stand with your feet shoulder-width apart and knees slightly bent.", "Hold your arms straight out in front of you, parallel to the ground.", "Engage your core and swing your arms in a circular motion, rotating your torso as you do so.", "Continue the circular motion, swinging your arms and rotating your torso for the desired number of repetitions.", "Remember to breathe throughout the exercise."],
    ["Tenez-vous debout, pieds écartés à la largeur des épaules, genoux légèrement fléchis.", "Tendez les bras devant vous, parallèles au sol.", "Gainez le tronc et faites tourner les bras en cercle, en faisant pivoter le torse.", "Continuez le mouvement circulaire, bras et torse, pour le nombre de répétitions souhaité.", "Pensez à respirer pendant tout l'exercice."],
    '3318-tnaj0mT.jpg', '3318-tnaj0mT.gif'),

  mk('2141', 'walk elliptical cross trainer', ['elliptical machine'], 'cardiovascular system',
    ["Adjust the resistance level and incline of the elliptical machine to your desired settings.", "Step onto the pedals of the machine and grip the handles lightly.", "Begin by pushing down with your feet and pulling the handles towards your body.", "Continue this motion, alternating between pushing and pulling, to simulate a walking or running motion.", "Maintain a steady pace and keep your core engaged throughout the exercise.", "Continue for the desired duration of your cardio workout.", "Gradually decrease the intensity and speed of the machine before stepping off."],
    ["Réglez le niveau de résistance et l'inclinaison du vélo elliptique selon vos préférences.", "Montez sur les pédales de l'appareil et saisissez légèrement les poignées.", "Commencez par pousser avec les pieds et tirer les poignées vers vous.", "Continuez ce mouvement, en alternant poussée et traction, pour simuler la marche ou la course.", "Maintenez un rythme régulier et gardez le tronc gainé pendant tout l'exercice.", "Continuez pour la durée souhaitée de votre séance cardio.", "Diminuez progressivement l'intensité et la vitesse de l'appareil avant de descendre."],
    '2141-rjtuP6X.jpg', '2141-rjtuP6X.gif'),

  mk('3655', 'walking high knees lunge', [], 'cardiovascular system',
    ["Stand with your feet hip-width apart.", "Lift your right knee up towards your chest as high as you can while balancing on your left leg.", "Step forward with your right foot and lower your body into a lunge position, bending both knees to a 90-degree angle.", "Push off with your right foot and bring your left knee up towards your chest.", "Step forward with your left foot and lower your body into a lunge position.", "Continue alternating legs and lunging forward, keeping your core engaged and maintaining a steady pace.", "Repeat for the desired number of repetitions."],
    ["Tenez-vous debout, pieds écartés à la largeur des hanches.", "Levez le genou droit vers la poitrine le plus haut possible en gardant l'équilibre sur la jambe gauche.", "Avancez le pied droit et descendez en fente, en fléchissant les deux genoux à 90 degrés.", "Repoussez avec le pied droit et levez le genou gauche vers la poitrine.", "Avancez le pied gauche et descendez en fente.", "Continuez à alterner les jambes en avançant, tronc gainé et rythme régulier.", "Répétez pour le nombre de répétitions souhaité."],
    '3655-J9zIWig.jpg', '3655-J9zIWig.gif'),

  mk('3666', 'walking on incline treadmill', ['leverage machine'], 'cardiovascular system',
    ["Adjust the incline level on the treadmill to your desired intensity.", "Stand on the treadmill with your feet shoulder-width apart.", "Start walking at a comfortable pace, ensuring that you maintain proper form.", "Engage your core muscles and keep your back straight throughout the exercise.", "Continue walking on the incline treadmill for the desired duration of your cardio workout.", "Gradually decrease the incline and speed of the treadmill to cool down before stopping."],
    ["Réglez le niveau d'inclinaison du tapis de course selon l'intensité souhaitée.", "Tenez-vous sur le tapis, pieds écartés à la largeur des épaules.", "Commencez à marcher à un rythme confortable en veillant à garder une bonne posture.", "Gainez le tronc et gardez le dos droit pendant tout l'exercice.", "Continuez à marcher sur le tapis incliné pendant la durée souhaitée de votre séance cardio.", "Réduisez progressivement l'inclinaison et la vitesse du tapis pour récupérer avant de vous arrêter."],
    '3666-rjiM4L3.jpg', '3666-rjiM4L3.gif'),

  mk('2311', 'walking on stepmill', ['stepmill machine'], 'cardiovascular system',
    ["Adjust the stepmill machine to a comfortable level.", "Step onto the machine and place your hands on the handrails for support.", "Start walking by placing one foot on a step and then the other, alternating between legs.", "Maintain an upright posture and engage your core muscles.", "Continue walking for the desired duration or distance.", "Gradually increase the intensity or speed as you become more comfortable with the exercise.", "Remember to cool down and stretch after completing the exercise."],
    ["Réglez le stepmill à un niveau confortable.", "Montez sur l'appareil et posez les mains sur les rampes pour vous soutenir.", "Commencez à marcher en posant un pied sur une marche puis l'autre, en alternant les jambes.", "Gardez une posture droite et le tronc gainé.", "Continuez à marcher pour la durée ou la distance souhaitée.", "Augmentez progressivement l'intensité ou la vitesse à mesure que vous êtes plus à l'aise.", "Pensez à récupérer et à vous étirer après l'exercice."],
    '2311-j9Q5crt.jpg', '2311-j9Q5crt.gif'),

  mk('3637', 'wheel run', [], 'cardiovascular system',
    ["Start in a plank position with your hands on the wheel and your body straight.", "Engage your core and start rolling the wheel forward by extending your arms.", "Continue rolling until your body is fully extended and your arms are overhead.", "Reverse the movement by pulling the wheel back towards your body, using your core and arms.", "Repeat for the desired number of repetitions."],
    ["Placez-vous en position de planche, mains sur la roue, corps aligné.", "Gainez le tronc et commencez à faire rouler la roue vers l'avant en tendant les bras.", "Continuez à rouler jusqu'à ce que le corps soit complètement tendu, bras au-dessus de la tête.", "Inversez le mouvement en ramenant la roue vers vous, en utilisant le tronc et les bras.", "Répétez pour le nombre de répétitions souhaité."],
    '3637-km2Ljzj.jpg', '3637-km2Ljzj.gif'),
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/residual-cardio-data.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/residual-cardio-data.js frontend/src/lib/residual-cardio-data.test.js
git commit -m "feat: author 26 residual cardio exercises with FR translations"
```

---

### Task 3: Build script — generate the unified `exercises-data.js`

**Files:**
- Create: `frontend/scripts/build-exercises-data.js`
- Modify: `frontend/src/lib/exercises-data.js` (output of running the script)
- Test: `frontend/src/lib/exercises-data.test.js`

**Interfaces:**
- Consumes: `frontend/scripts/vendor/smartworkout-exercises-flat.json` (Task 1), `RESIDUAL_CARDIO` from `residual-cardio-data.js` (Task 2)
- Produces: `frontend/src/lib/exercises-data.js` exporting `export const EXDB = [...]` — 837 objects, each with native SmartWorkout fields (where applicable) plus `n`, `bp`, `tg`, `eq` aliases. This is the sole input `exercises.js` (Task 4) and every other consumer relies on.

- [ ] **Step 1: Write the failing test** (written against the *not-yet-regenerated* file, so it fails against the old 1324-entry dataset)

```js
// frontend/src/lib/exercises-data.test.js
import { describe, it, expect } from 'vitest'
import { EXDB } from './exercises-data.js'

describe('EXDB (generated catalog)', () => {
  it('has exactly 837 exercises (811 SmartWorkout + 26 residual cardio)', () => {
    expect(EXDB).toHaveLength(837)
  })

  it('every exercise has a unique id and the four compatibility aliases', () => {
    const ids = new Set()
    for (const ex of EXDB) {
      expect(ex.id).toBeTruthy()
      expect(ids.has(ex.id)).toBe(false)
      ids.add(ex.id)
      expect(ex.n).toBe(ex.name)
      expect(ex.bp).toBe(ex.body_part)
      expect(typeof ex.eq === 'string' || ex.eq === null).toBe(true)
    }
  })

  it('has 26 CARDIO exercises and no exercise uses the old lowercase body parts', () => {
    const cardio = EXDB.filter(e => e.body_part === 'CARDIO')
    expect(cardio).toHaveLength(26)
    const oldStyle = EXDB.filter(e => e.body_part === e.body_part.toLowerCase() && e.body_part !== e.body_part.toUpperCase())
    expect(oldStyle).toHaveLength(0)
  })

  it('SmartWorkout exercises have French instructions', () => {
    const smartworkout = EXDB.filter(e => e.body_part !== 'CARDIO')
    const missingFr = smartworkout.filter(e => !e.instructions?.fr?.length)
    expect(missingFr).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/exercises-data.test.js`
Expected: FAIL — `EXDB` still has 1324 entries (old dataset)

- [ ] **Step 3: Write the build script**

```js
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
```

- [ ] **Step 4: Run the build script**

Run: `cd frontend && node scripts/build-exercises-data.js`
Expected: `Wrote 837 exercises to .../exercises-data.js`

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/exercises-data.test.js`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/scripts/build-exercises-data.js frontend/src/lib/exercises-data.js frontend/src/lib/exercises-data.test.js
git commit -m "feat: generate unified 837-exercise catalog from SmartWorkout + residual cardio"
```

---

### Task 4: Update `exercises.js` — video resolver, muscle helper, drop old enrichment

**Files:**
- Modify: `frontend/src/lib/exercises.js`
- Test: `frontend/src/lib/exercises.test.js`

**Interfaces:**
- Consumes: `EXDB` from Task 3 (fields `video_dark_url`, `video_light_url`, `local_video`, `exercise_muscles`, `equipments`, `bp`, `eq`)
- Produces: `videoSrc(ex)`, `photoSrc(ex)`, `musclesOf(ex)`, `sortedMuscles(ex)` — new exports used by Task 6 (`Media.jsx`) and Task 7 (`sheets.jsx`). Removes `loadSwEnrichment`, `swDataFor`, `swVideoSrc` (Task 6/7/9 stop importing these).

- [ ] **Step 1: Write the failing tests**

```js
// frontend/src/lib/exercises.test.js
import { describe, it, expect } from 'vitest'
import { isCardio, isBodyweightEq, videoSrc, photoSrc, musclesOf, sortedMuscles, EXIDX } from './exercises.js'

describe('isCardio', () => {
  it('is true for the CARDIO body part', () => {
    const cardioEx = Object.values(EXIDX).find(e => e.bp === 'CARDIO')
    expect(isCardio(cardioEx)).toBe(true)
  })
  it('is false for a non-cardio exercise', () => {
    const chestEx = Object.values(EXIDX).find(e => e.bp === 'CHEST')
    expect(isCardio(chestEx)).toBe(false)
  })
})

describe('isBodyweightEq', () => {
  it('is true when eq is the body weight sentinel', () => {
    expect(isBodyweightEq({ eq: 'body weight' })).toBe(true)
  })
  it('is false when eq is an equipment code', () => {
    expect(isBodyweightEq({ eq: 'BARBELL' })).toBe(false)
  })
})

describe('videoSrc', () => {
  it('prefers video_dark_url', () => {
    expect(videoSrc({ video_dark_url: 'https://a', video_light_url: 'https://b' })).toBe('https://a')
  })
  it('falls back to video_light_url', () => {
    expect(videoSrc({ video_dark_url: null, video_light_url: 'https://b' })).toBe('https://b')
  })
  it('falls back to a local path built from local_video', () => {
    expect(videoSrc({ video_dark_url: null, video_light_url: null, local_video: '/Videos/Air Bike.mp4' })).toBe('/videos/Air Bike.mp4')
  })
  it('returns null when nothing is available', () => {
    expect(videoSrc({ video_dark_url: null, video_light_url: null, local_video: null })).toBe(null)
  })
})

describe('photoSrc', () => {
  it('returns image_url when present', () => {
    expect(photoSrc({ image_url: 'https://img' })).toBe('https://img')
  })
  it('returns null when absent', () => {
    expect(photoSrc({ image_url: null })).toBe(null)
  })
})

describe('musclesOf / sortedMuscles', () => {
  const ex = { exercise_muscles: { CHEST_MIDDLE: 100, TRICEPS_LATERAL_HEAD: 40 } }
  it('musclesOf returns key/value pairs', () => {
    expect(musclesOf(ex)).toEqual([{ key: 'CHEST_MIDDLE', value: 100 }, { key: 'TRICEPS_LATERAL_HEAD', value: 40 }])
  })
  it('sortedMuscles sorts descending by value', () => {
    expect(sortedMuscles(ex).map(m => m.key)).toEqual(['CHEST_MIDDLE', 'TRICEPS_LATERAL_HEAD'])
  })
  it('handles missing exercise_muscles', () => {
    expect(musclesOf({})).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/exercises.test.js`
Expected: FAIL — `videoSrc`, `photoSrc`, `musclesOf`, `sortedMuscles` not exported; `isCardio`/`isBodyweightEq` still check the old lowercase/string values

- [ ] **Step 3: Modify `exercises.js`**

Replace the whole file with:

```js
// frontend/src/lib/exercises.js
import { EXDB } from './exercises-data.js'
import { t } from './i18n.js'

export { EXDB }
export const EXIDX = {}
EXDB.forEach(e => { EXIDX[e.id] = e })
export const BODYPARTS = [...new Set(EXDB.map(e => e.bp))].sort()

// Equipment options present in a given list of exercises, most common first (issue #6).
// Deriving them from the *already filtered* list keeps the chip row short and means
// every body-part × equipment combination on screen has results behind it.
export function equipmentOf(list) {
  const c = {}
  list.forEach(e => { if (e.eq) c[e.eq] = (c[e.eq] || 0) + 1 })
  return Object.keys(c).sort((a, b) => c[b] - c[a] || (a < b ? -1 : 1))
}

// Custom (user-created) exercises live in synced state S.customEx (issue #11) and are
// merged into the id index here so every EXIDX[id] lookup keeps working unchanged.
let customIds = []
export function registerCustom(list) {
  customIds.forEach(id => delete EXIDX[id])
  customIds = (list || []).map(e => e.id)
  ;(list || []).forEach(e => { EXIDX[e.id] = e })
}
// Full searchable catalogue — customs first so your own exercises are easy to find.
export const allExercises = st => [...(st.customEx || []), ...EXDB]

// Legacy media (residual cardio exercises only) — img/ and gif/, mounted next to the app.
const IMG_BASE = import.meta.env.VITE_IMG_BASE || 'img/'
const GIF_BASE = import.meta.env.VITE_GIF_BASE || 'gif/'
export const imgSrc = ex => IMG_BASE + ex.img
export const gifSrc = ex => GIF_BASE + ex.gif

// SmartWorkout video — CDN-first, with a local-hosting fallback that isn't populated
// by default (drop .mp4 files into frontend/public/videos/ to activate it, no code change).
export const videoSrc = ex => {
  if (ex.video_dark_url) return ex.video_dark_url
  if (ex.video_light_url) return ex.video_light_url
  if (ex.local_video) return ex.local_video.replace(/^\/Videos\//i, '/videos/')
  return null
}

// SmartWorkout static photo (exercises without a usable video fall back to this).
export const photoSrc = ex => ex.image_url || null

// Muscle activation (0-100%) from SmartWorkout's `exercise_muscles` — used by the
// detail sheet and the muscle filter.
export function musclesOf(ex) {
  const m = ex.exercise_muscles
  if (!m || typeof m !== 'object') return []
  return Object.entries(m)
    .filter(([, v]) => typeof v === 'number' && !isNaN(v))
    .map(([key, value]) => ({ key, value }))
}
export function sortedMuscles(ex) {
  return musclesOf(ex).sort((a, b) => b.value - a.value)
}

// Cardio exercises log time + speed instead of weight × reps.
export const isCardio = idOrEx => (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)?.bp === 'CARDIO'

// Exercises the dataset already knows carry no external load (issue #32) — seeds the
// `bw` flag on a fresh config so a push-up never asks for a weight nobody was going to
// enter. It is only the default: the flag lives on the config, so a dip done with a belt
// can turn it off and a custom exercise can turn it on.
export const isBodyweightEq = idOrEx =>
  (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)?.eq === 'body weight'

// An id that resolves to nothing — a plan file built against a different exercise dataset,
// a custom exercise deleted on another device before the sync arrived — still has to
// render. A placeholder keeps it visible (and removable) instead of taking the whole view
// down on the first `ex.n`.
export const exOr = id => EXIDX[id] ||
  { id, n: t('Unknown exercise'), bp: '', tg: '', eq: '', sm: [], st: [], missing: true }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/exercises.test.js`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/exercises.js frontend/src/lib/exercises.test.js
git commit -m "feat: add videoSrc/photoSrc/musclesOf helpers, retire SmartWorkout enrichment layer"
```

---

### Task 5: French label dictionaries (`exerciseLabels.js`)

**Files:**
- Create: `frontend/src/lib/exerciseLabels.js`
- Test: `frontend/src/lib/exerciseLabels.test.js`

**Interfaces:**
- Produces: `bodyPartLabel(code)`, `equipmentLabel(code)`, `mechanicsLabel(code)`, `lateralityLabel(code)`, `weightTypeLabel(code)`, `muscleLabel(key)` — consumed by Task 7 (`sheets.jsx`), Task 8 (`Library.jsx`), Task 10 (`excelTemplate.js`).

- [ ] **Step 1: Write the failing test**

```js
// frontend/src/lib/exerciseLabels.test.js
import { describe, it, expect } from 'vitest'
import { bodyPartLabel, equipmentLabel, mechanicsLabel, lateralityLabel, weightTypeLabel, muscleLabel } from './exerciseLabels.js'

describe('exerciseLabels', () => {
  it('translates known body parts', () => {
    expect(bodyPartLabel('CHEST')).toBe('Pectoraux')
    expect(bodyPartLabel('CARDIO')).toBe('Cardio')
  })
  it('translates known equipment codes', () => {
    expect(equipmentLabel('PULL_UP_BAR')).toBe('Barre de traction')
  })
  it('routes the body-weight sentinel through the legacy t() dictionary', () => {
    expect(equipmentLabel('body weight')).toBe('body weight') // t() with no fr.js loaded in test env falls back to the key
  })
  it('falls back to a prettified code for unknown values', () => {
    expect(equipmentLabel('SOME_NEW_CODE')).toBe('Some New Code')
  })
  it('translates mechanics/laterality/weight type', () => {
    expect(mechanicsLabel('COMPOUND')).toBe('Polyarticulaire')
    expect(lateralityLabel('BILATERAL')).toBe('Bilatéral')
    expect(weightTypeLabel('BODYWEIGHT')).toBe('Poids du corps')
  })
  it('translates known muscles and falls back to prettified key', () => {
    expect(muscleLabel('CHEST_MIDDLE')).toBe('Pectoral moyen')
    expect(muscleLabel('UNKNOWN_MUSCLE')).toBe('Unknown Muscle')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/exerciseLabels.test.js`
Expected: FAIL — module does not exist

- [ ] **Step 3: Write `exerciseLabels.js`**

```js
// frontend/src/lib/exerciseLabels.js
// French labels for SmartWorkout's enum codes and muscle keys. These are NOT routed
// through lib/i18n.js's t() — that maps English *phrases* to translations, not enum
// codes, and would silently return codes like "PULL_UP_BAR" unchanged. The one
// exception is the 'body weight' sentinel, which already has a working t() entry
// from the pre-swap dataset and stays on that path for backward compatibility.
import { t } from './i18n.js'

function prettify(code) {
  if (!code) return '—'
  return code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export const BODY_PART_LABELS_FR = {
  ABS: 'Abdominaux', BACK: 'Dos', BICEPS: 'Biceps', CHEST: 'Pectoraux',
  FOREARMS: 'Avant-bras', GLUTEUS: 'Fessiers', LEGS: 'Jambes',
  SHOULDERS: 'Épaules', TRICEPS: 'Triceps', CARDIO: 'Cardio',
}

export const EQUIPMENT_LABELS_FR = {
  ASSISTED_MACHINE: 'Machine assistée', BARBELL: 'Barre', BENCH: 'Banc',
  CABLE_MACHINE: 'Machine à câbles', DIP_BARS: 'Barres de dips', DUMBBELL: 'Haltère',
  EZ_BAR: 'Barre EZ', GYMNASTIC_RINGS: 'Anneaux de gym', KETTLEBELL: 'Kettlebell',
  LANDMINE: 'Landmine', MEDICINE_BALL: 'Médecine-ball', PARALLETTES: 'Parallettes',
  PLATE_LOADED_MACHINE: 'Machine à disques', PLYO_BOX: 'Boîte pliométrique',
  PULL_UP_BAR: 'Barre de traction', RACK: 'Rack', RESISTANCE_BAND: 'Bande élastique',
  SELECTORIZED_MACHINE: 'Machine à sélecteur', SLED: 'Traîneau', SMITH_MACHINE: 'Smith Machine',
  SUSPENSION_TRAINER: 'Sangles de suspension', TRAP_BAR: 'Trap Bar',
  TREADMILL: 'Tapis de course', WEIGHT_PLATE: 'Disque',
}

export const MECHANICS_LABELS_FR = { COMPOUND: 'Polyarticulaire', ISOLATION: 'Isolation' }

export const LATERALITY_LABELS_FR = {
  ALTERNATING: 'Alterné', BILATERAL: 'Bilatéral', UNILATERAL: 'Unilatéral',
}

export const WEIGHT_TYPE_LABELS_FR = {
  ASSISTED_WEIGHT: 'Poids assisté', BAND: 'Élastique', BARBELL: 'Barre',
  BODYWEIGHT: 'Poids du corps', DUMBBELL: 'Haltère', MACHINE: 'Machine',
  UNWEIGHTED: 'Sans charge', WEIGHTED: 'Lesté',
}

export const MUSCLE_LABELS_FR = {
  ABS_LOWER: 'Abdominaux inférieurs', ABS_UPPER: 'Abdominaux supérieurs', ABS_OBLIQUES: 'Obliques',
  BACK_LATS: 'Grand dorsal', BACK_TRAPEZIUS_UPPER: 'Trapèze supérieur', BACK_TRAPEZIUS_MIDDLE: 'Trapèze moyen',
  BACK_TRAPEZIUS_LOWER: 'Trapèze inférieur', BACK_INFRASPINATUS: 'Infra-épineux',
  BACK_TERES_MAJOR: 'Grand rond', BACK_TERES_MINOR: 'Petit rond',
  BICEPS_LONG_HEAD: 'Biceps — longue portion', BICEPS_SHORT_HEAD: 'Biceps — courte portion',
  BRACHIORADIALIS: 'Brachio-radial', CHEST_UPPER: 'Pectoral supérieur', CHEST_MIDDLE: 'Pectoral moyen',
  CHEST_LOWER: 'Pectoral inférieur', CHEST_BIG_SWING_MUSCLE: 'Grand pectoral',
  GLUTEUS_MAXIMUS: 'Grand fessier', GLUTEUS_MEDIUS: 'Moyen fessier',
  SHOULDERS_FRONT_PART: 'Deltoïde antérieur', SHOULDERS_MIDDLE_PART: 'Deltoïde latéral',
  SHOULDERS_REAR_PART: 'Deltoïde postérieur', TRICEPS_LATERAL_HEAD: 'Triceps — faisceau latéral',
  TRICEPS_LONG_HEAD: 'Triceps — longue portion', TRICEPS_MEDIAL_HEAD: 'Triceps — faisceau médial',
  QUADRICEPS_RECTUS_FEMORIS: 'Droit fémoral', QUADRICEPS_VASTUS_LATERALIS: 'Vaste latéral',
  QUADRICEPS_VASTUS_MEDIALIS: 'Vaste médial', QUADRICEPS_VASTUS_INTERMEDIUS: 'Vaste intermédiaire',
  ERECTOR_SPINAE: 'Érecteurs du rachis', CLAVES_GASTROCNEMIUS: 'Gastrocnémien',
  CLAVES_SOLEUS_MUSCLE: 'Soléaire', CLAVES_TRIBIALIS: 'Tibial antérieur',
  BICEPS_FEMORIS: 'Biceps fémoral', SEMIMEMBRANOSUS: 'Semi-membraneux', SEMITENDINOSUS: 'Semi-tendineux',
  ADDUCTOR_LONGUS: 'Adducteur long', ADDUCTOR_MAGNUS: 'Grand adducteur',
  FOREARM_EXTENSORS: 'Extenseurs avant-bras', FOREARM_FLEXORS: 'Fléchisseurs avant-bras',
  ILIOPSOAS: 'Ilio-psoas', GRACILIS: 'Gracile', PECTINEUS: 'Pectiné', SARTORIUS: 'Sartorius',
}

export const bodyPartLabel = code => BODY_PART_LABELS_FR[code] || prettify(code)
export const mechanicsLabel = code => MECHANICS_LABELS_FR[code] || prettify(code)
export const lateralityLabel = code => LATERALITY_LABELS_FR[code] || prettify(code)
export const weightTypeLabel = code => WEIGHT_TYPE_LABELS_FR[code] || prettify(code)
export const muscleLabel = key => MUSCLE_LABELS_FR[key] || prettify(key)
export const equipmentLabel = code => {
  if (!code) return '—'
  if (code === 'body weight') return t(code) // legacy sentinel, kept on the old t() path
  return EQUIPMENT_LABELS_FR[code] || prettify(code)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/exerciseLabels.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/exerciseLabels.js frontend/src/lib/exerciseLabels.test.js
git commit -m "feat: add French label dictionaries for SmartWorkout enum codes"
```

---

### Task 6: Update `Media.jsx` and `Thumb` for video/photo branching

**Files:**
- Modify: `frontend/src/components/Media.jsx`

**Interfaces:**
- Consumes: `videoSrc`, `photoSrc` from `exercises.js` (Task 4)
- Produces: unchanged public shape — `<Media ex compact minimizable id />`, `<Thumb ex />` — callers in `Library.jsx`, `sheets.jsx`, `Workout.jsx` need no changes.

- [ ] **Step 1: Replace the file**

```jsx
// frontend/src/components/Media.jsx
import { useState, useRef } from 'react'
import { imgSrc, gifSrc, videoSrc, photoSrc } from '../lib/exercises.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

// Plays a SmartWorkout video, or falls back to a static photo, or (residual cardio
// exercises only) a GIF/still image. Tap toggles pause/play (video) or animation/still (GIF).
// `compact` shrinks it for superset cards.
// `minimizable` adds a persistent minimize/expand button (workout view, issue #12).
export default function Media({ ex, id, compact, minimizable }) {
  const videoUrl = videoSrc(ex)
  const photoUrl = photoSrc(ex)
  const [mode, setMode] = useState(videoUrl ? 'video' : 'gif')
  const [playing, setPlaying] = useState(true)
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)
  const videoRef = useRef(null)

  const hasGif = !!ex.gif
  if (!hasGif && !videoUrl && !photoUrl) return null

  const mini = minimizable && gifSize === 'mini'
  const toggleSize = e => { e.stopPropagation(); update(s => { s.gifSize = mini ? 'full' : 'mini' }) }

  const togglePlay = () => {
    if (mode === 'video' && videoRef.current) {
      if (videoRef.current.paused) { videoRef.current.play(); setPlaying(true) }
      else { videoRef.current.pause(); setPlaying(false) }
    } else {
      setPlaying(p => !p)
    }
  }

  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '')} id={id} onClick={togglePlay}>
      {mode === 'video' ? (
        <video
          ref={videoRef}
          key={videoUrl}
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          style={{ width: '100%', display: 'block', borderRadius: 'inherit' }}
          onError={() => setMode(hasGif ? 'gif' : 'photo')}
        />
      ) : mode === 'gif' && hasGif ? (
        <img decoding="async" src={playing ? gifSrc(ex) : imgSrc(ex)} alt={ex.n} />
      ) : (
        photoUrl && <img decoding="async" src={photoUrl} alt={ex.n} />
      )}

      {/* GIF / VIDEO toggle — only shown when both are available (residual cardio) */}
      {videoUrl && hasGif && !mini && (
        <button
          className="giftoggle"
          onClick={e => { e.stopPropagation(); setMode(m => m === 'video' ? 'gif' : 'video') }}
          style={{ left: 8, right: 'auto' }}
        >
          {mode === 'video' ? 'GIF' : 'VIDEO'}
        </button>
      )}

      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}

      {!mini && mode !== 'photo' && (
        <span className="gifhint">
          <Icon name={playing ? 'pause' : 'play'} />
          {playing ? t('tap to pause') : t('tap to play')}
        </span>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  if (ex.img) return <img className="thumb" loading="lazy" decoding="async" src={imgSrc(ex)} alt="" />
  const photo = photoSrc(ex)
  if (photo) return <img className="thumb" loading="lazy" decoding="async" src={photo} alt="" />
  return <div className="thumb thumb-x"><Icon name="dumbbell" /></div>
}
```

- [ ] **Step 2: Manual smoke check** (no existing automated test covers `Media.jsx`; a full component test is out of scope for this swap — visual verification happens in Task 16)

Run: `cd frontend && npm run dev`, open the Library, click a SmartWorkout exercise (should autoplay video), click a residual cardio exercise (should show GIF with a VIDEO/GIF toggle absent since there's no video), confirm no console errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Media.jsx
git commit -m "feat: branch Media/Thumb on video, static photo, or legacy gif"
```

---

### Task 7: Rich exercise detail sheet + badge label wiring (`sheets.jsx`)

**Files:**
- Modify: `frontend/src/sheets.jsx`

**Interfaces:**
- Consumes: `musclesOf`/`sortedMuscles` (Task 4), `bodyPartLabel`/`equipmentLabel`/`muscleLabel` (Task 5)
- Produces: unchanged `ExerciseDetail`/`customExSheet`/`exercisePicker`/`exerciseDetailSheet`/`addToRoutineSheet` export surface — no signature changes, callers elsewhere untouched.

- [ ] **Step 1: Remove the old muscle dictionary and rewire `MuscleActivation`**

In `frontend/src/sheets.jsx`, delete lines 406-425 (the local `SW_MUSCLE_LABELS` constant) and update the import list at the top of the file to add:

```js
import { muscleLabel, bodyPartLabel, equipmentLabel } from './lib/exerciseLabels.js'
```

Then update `MuscleActivation` (was lines 427-449) to use `muscleLabel` instead of the deleted local dict:

```jsx
function MuscleActivation({ muscles }) {
  const entries = Object.entries(muscles).sort(([, a], [, b]) => b - a)
  if (!entries.length) return null
  return (
    <div style={{ marginTop: 14 }}>
      <h4 className="sec" style={{ marginBottom: 8 }}>Muscles activés</h4>
      {entries.map(([key, pct]) => {
        const color = pct >= 70 ? 'var(--acc)' : pct >= 40 ? 'var(--orange)' : 'var(--yellow)'
        return (
          <div key={key} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: 'var(--label-2)' }}>{muscleLabel(key)}</span>
              <span style={{ fontWeight: 700, color }}>{pct}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--surface-3)' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `ExerciseDetail`** (previously lines 451-469 approx.) to use native fields instead of `swDataFor`, and add description/instructions/tips/mistakes sections

```jsx
function ExerciseDetail({ ex, close }) {
  const st = useStore(s => s.S)
  const last = lastEntryFor(st, ex.id)
  const best = bestWeightFor(st, ex.id)
  const muscles = ex.exercise_muscles || {}
  const description = ex.description_fr || ex.description
  const instructions = ex.instructions?.fr?.length ? ex.instructions.fr : (ex.instructions?.en || [])
  const tips = ex.tips?.fr?.length ? ex.tips.fr : (ex.tips?.en || [])
  const mistakes = ex.common_mistakes?.fr?.length ? ex.common_mistakes.fr : (ex.common_mistakes?.en || [])
  return <>
    <h3 className="capitalize">{ex.n}</h3>
    <Media ex={ex} />
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
      <span className="tag acc">{bodyPartLabel(ex.bp)}</span>
      {ex.tg && <span className="tag"><Icon name="target" />{muscleLabel(ex.tg)}</span>}
      <span className="tag"><Icon name="dumbbell" />{equipmentLabel(ex.eq)}</span>
      {(ex.sm || []).slice(0, 3).map((s, i) => <span key={i} className="tag">{t(s)}</span>)}
    </div>
    {description && <div className="exnote">{description}</div>}
    {Object.keys(muscles).length > 0 && <MuscleActivation muscles={muscles} />}
    {instructions.length > 0 && <>
      <h4 className="sec" style={{ marginTop: 14, marginBottom: 8 }}>{t('Instructions')}</h4>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7 }}>
        {instructions.map((step, i) => <li key={i}>{step}</li>)}
      </ol>
    </>}
    {tips.length > 0 && <>
      <h4 className="sec" style={{ marginTop: 14, marginBottom: 8 }}>{t('Tips')}</h4>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7, color: 'var(--label-2)' }}>
        {tips.map((tip, i) => <li key={i}>{tip}</li>)}
      </ul>
    </>}
    {mistakes.length > 0 && <>
      <h4 className="sec" style={{ marginTop: 14, marginBottom: 8 }}>{t('Common mistakes')}</h4>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7, color: 'var(--label-2)' }}>
        {mistakes.map((m, i) => <li key={i}>{m}</li>)}
      </ul>
    </>}
    {best > 0 && <div className="small row" style={{ margin: '10px 0 6px', gap: 5 }}><Icon name="trophy" style={{ fontSize: 14, color: 'var(--yellow)' }} />{t('Best:')} <b className="accent">{fmtNum(best)} {st.unit}</b>{last ? ` · ${t('last')} ${fmtDate(last.d)}: ${last.sets.map(s => setLabel(ex.id, s, last.target)).join(', ')}` : ''}</div>}
    <Button variant="primary" icon="plus" style={{ margin: '10px 0 4px' }} onClick={() => addToRoutineSheet(ex)}>{t('Add to my plan')}</Button>
    {ex.custom && <div className="row" style={{ gap: 8, marginTop: 8 }}>
```

(the remaining lines of `ExerciseDetail` after this point — the custom-exercise edit/delete buttons — are unchanged; keep them as-is below this point)

**Note:** add `'Instructions'`, `'Tips'`, `'Common mistakes'` to the appropriate locale files if the project's convention requires every `t()`-wrapped string to have a source entry — check `frontend/src/locales/fr.js` for the existing pattern used by other section headers in this file (e.g. how `'Best:'` is handled) and follow it.

- [ ] **Step 3: Update the two remaining `t(ex.eq)` / `t(e.bp)` badge call sites**

In `ExercisePicker` (around former line 629) and `SwapPicker` (around former line 661) and the third card in `SwapPicker`'s header (former line 756-ish `ex.tg`/`ex.bp`/`ex.eq` tags), replace:

```jsx
<div className="ss capitalize">{t(e.tg || e.bp)} · {t(e.eq)}</div>
```

with:

```jsx
<div className="ss capitalize">{e.tg ? muscleLabel(e.tg) : bodyPartLabel(e.bp)} · {equipmentLabel(e.eq)}</div>
```

Apply the equivalent substitution to the other exercise-badge line in the "switch exercise" detail header:

```jsx
<span className="tag">{e.tg ? muscleLabel(e.tg) : bodyPartLabel(e.bp)}</span><span className="tag">{equipmentLabel(e.eq)}</span>
```

And in the chip lists (body-part chips in `ExercisePicker`, equipment chips in both pickers), replace `{t(b)}` with `{bodyPartLabel(b)}` and `{t(x)}` (equipment chip option) with `{equipmentLabel(x)}`.

- [ ] **Step 4: Remove the now-unused `swDataFor` import**

At the top of `sheets.jsx`, change:

```js
import { EXDB, EXIDX, BODYPARTS, isCardio, isBodyweightEq, allExercises, equipmentOf, swDataFor } from './lib/exercises.js'
```

to:

```js
import { EXDB, EXIDX, BODYPARTS, isCardio, isBodyweightEq, allExercises, equipmentOf } from './lib/exercises.js'
```

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `cd frontend && npx vitest run`
Expected: all existing suites still pass (this task touches display code only, no logic under test)

- [ ] **Step 6: Manual smoke check**

Run: `cd frontend && npm run dev`, open a SmartWorkout exercise's detail sheet, confirm description/instructions/tips/mistakes render in French, confirm body part / equipment / target muscle badges show French labels (not raw codes like `PULL_UP_BAR`).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/sheets.jsx
git commit -m "feat: rich exercise detail sheet (description, instructions, tips, mistakes) + French badge labels"
```

---

### Task 8: Rework `Library.jsx` filters

**Files:**
- Modify: `frontend/src/views/Library.jsx`

**Interfaces:**
- Consumes: `EXDB`, `BODYPARTS`, `allExercises`, `equipmentOf` (unchanged exports from Task 4), `musclesOf`/`sortedMuscles` (Task 4), `bodyPartLabel`/`equipmentLabel`/`mechanicsLabel`/`lateralityLabel`/`muscleLabel` (Task 5)
- Produces: same default export `Library()` — routed the same way from the app shell, no external interface change.

- [ ] **Step 1: Replace the file**

```jsx
// frontend/src/views/Library.jsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { EXDB, BODYPARTS, allExercises, equipmentOf, musclesOf } from '../lib/exercises.js'
import { bodyPartLabel, equipmentLabel, mechanicsLabel, lateralityLabel, muscleLabel } from '../lib/exerciseLabels.js'
import { bestWeightFor } from '../lib/history.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { Thumb } from '../components/Media.jsx'
import { exerciseDetailSheet, addToRoutineSheet, customExSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, SearchField } from '../components/ui.jsx'

const BP_COLOR = {
  ABS: 'var(--teal)', BACK: 'var(--blue)', BICEPS: 'var(--orange)', CHEST: 'var(--acc)',
  FOREARMS: 'var(--yellow)', GLUTEUS: 'var(--pink, var(--red))', LEGS: 'var(--indigo, var(--blue))',
  SHOULDERS: 'var(--purple)', TRICEPS: 'var(--orange)', CARDIO: 'var(--teal)',
}
function bpColor(bp) { return BP_COLOR[bp] || 'var(--label-3)' }

const ACTIVATION_THRESHOLDS = [0, 10, 25, 50, 75]

function uniq(arr) { return [...new Set(arr.filter(Boolean))].sort() }

function equipmentListOf(ex) { return Array.isArray(ex.equipments) ? ex.equipments : [] }

function matchesFilters(ex, f, ql) {
  if (f.bp && ex.bp !== f.bp) return false
  if (f.mechanics && ex.mechanics !== f.mechanics) return false
  if (f.laterality && ex.laterality !== f.laterality) return false
  if (f.equipment) {
    const eq = equipmentListOf(ex)
    if (f.equipment === 'Bodyweight') { if (eq.length !== 0) return false }
    else if (!eq.includes(f.equipment)) return false
  }
  if (f.muscle || f.activation > 0) {
    const muscles = musclesOf(ex)
    if (f.muscle) {
      const match = muscles.find(m => m.key === f.muscle)
      if (!match) return false
      if (f.activation > 0 && match.value < f.activation) return false
    } else if (!muscles.some(m => m.value >= f.activation)) return false
  }
  if (ql && !(ex.n.toLowerCase().includes(ql) || (ex.desc || '').toLowerCase().includes(ql))) return false
  return true
}

export default function Library() {
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({ bp: '', equipment: '', mechanics: '', laterality: '', muscle: '', activation: 0 })
  const [showFilters, setShowFilters] = useState(false)
  const [shown, setShown] = useState(40)
  const ql = q.toLowerCase().trim()
  const nav = useNavigate()

  const base = useMemo(() => allExercises(S).filter(e => matchesFilters(e, filters, ql)), [S, filters, ql])

  const opts = useMemo(() => ({
    equipments: uniq(base.flatMap(equipmentListOf)),
    mechanics: uniq(base.map(e => e.mechanics)),
    lateralities: uniq(base.map(e => e.laterality)),
    muscles: uniq(base.flatMap(e => musclesOf(e).map(m => m.key))),
  }), [base])

  const hasFilter = Object.entries(filters).some(([k, v]) => k === 'activation' ? v > 0 : Boolean(v))
  const set = key => e => { setFilters(f => ({ ...f, [key]: e.target.value })); setShown(40) }
  const reset = () => { setFilters({ bp: '', equipment: '', mechanics: '', laterality: '', muscle: '', activation: 0 }); setShown(40) }

  return <>
    <div className="hdr">
      <div><h1>{t('Exercises')}</h1><div className="sub">{t('{0} exercises with animations', EXDB.length)}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>
    <div style={{ marginBottom: 10 }}>
      <SearchField value={q} onChange={e => { setQ(e.target.value); setShown(40) }} onClear={() => { setQ(''); setShown(40) }} placeholder={t('Search…')} />
    </div>

    {/* Body part chips with color dots */}
    <div className="chips" style={{ marginBottom: 8 }}>
      <button className={'chip nocap' + (!filters.bp ? ' on' : '')} onClick={() => setFilters(f => ({ ...f, bp: '' }))}>{t('All')}</button>
      {BODYPARTS.map(b => {
        const c = bpColor(b)
        const isOn = filters.bp === b
        return (
          <button
            key={b}
            className={'chip' + (isOn ? ' on' : '')}
            style={isOn ? { background: `color-mix(in srgb,${c} 20%,var(--surface-2))`, color: c, borderColor: `color-mix(in srgb,${c} 35%,transparent)` } : {}}
            onClick={() => setFilters(f => ({ ...f, bp: b }))}
          >
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: c, marginRight: 5, flexShrink: 0, verticalAlign: 'middle', marginBottom: 1 }} />
            {bodyPartLabel(b)}
          </button>
        )
      })}
    </div>

    <button className="chip nocap" style={{ marginBottom: 12 }} onClick={() => setShowFilters(s => !s)}>
      <Icon name="filter" /> {t('More filters')} {hasFilter && <span className="tag acc" style={{ marginLeft: 4 }}>•</span>}
    </button>

    {showFilters && <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label className="small muted">{t('Equipment')}
        <select value={filters.equipment} onChange={set('equipment')}>
          <option value="">{t('Any equipment')}</option>
          <option value="Bodyweight">{t('Bodyweight only')}</option>
          {opts.equipments.map(x => <option key={x} value={x}>{equipmentLabel(x)}</option>)}
        </select>
      </label>
      <label className="small muted">{t('Mechanics')}
        <select value={filters.mechanics} onChange={set('mechanics')}>
          <option value="">{t('All')}</option>
          {opts.mechanics.map(x => <option key={x} value={x}>{mechanicsLabel(x)}</option>)}
        </select>
      </label>
      <label className="small muted">{t('Laterality')}
        <select value={filters.laterality} onChange={set('laterality')}>
          <option value="">{t('All')}</option>
          {opts.lateralities.map(x => <option key={x} value={x}>{lateralityLabel(x)}</option>)}
        </select>
      </label>
      <label className="small muted">{t('Muscle')}
        <select value={filters.muscle} onChange={set('muscle')}>
          <option value="">{t('All')}</option>
          {opts.muscles.map(x => <option key={x} value={x}>{muscleLabel(x)}</option>)}
        </select>
      </label>
      <label className="small muted">{t('Minimum activation')}
        <select value={filters.activation} onChange={e => setFilters(f => ({ ...f, activation: Number(e.target.value) }))}>
          {ACTIVATION_THRESHOLDS.map(v => <option key={v} value={v}>{v === 0 ? t('Any') : `≥ ${v}%`}</option>)}
        </select>
      </label>
      {hasFilter && <Button size="sm" variant="tinted" onClick={reset}>{t('Reset filters')}</Button>}
    </div>}

    <div className="list">
      {/* Create custom exercise — accent entry */}
      <div className="item" onClick={() => customExSheet(null, ex => exerciseDetailSheet(ex), q.trim())}
        style={{ background: `linear-gradient(135deg,color-mix(in srgb,var(--acc) 7%,var(--surface)),var(--surface))` }}>
        <div className="thumb thumb-x" style={{ background: 'color-mix(in srgb,var(--acc) 16%,var(--surface-2))', color: 'var(--acc)' }}>
          <Icon name="sparkles" />
        </div>
        <div className="grow">
          <div className="tt">{t('Create your own exercise')}</div>
          <div className="ss">{t('name + body part, no animation')}</div>
        </div>
        <Icon name="plus" className="chev" style={{ color: 'var(--acc)' }} />
      </div>

      {base.slice(0, shown).map(e => {
        const best = bestWeightFor(S, e.id)
        const c = bpColor(e.bp)
        return (
          <div key={e.id} className="item" onClick={() => exerciseDetailSheet(e)}
            style={{ borderLeft: `3px solid color-mix(in srgb,${c} 50%,transparent)` }}>
            <Thumb ex={e} />
            <div className="grow">
              <div className="tt capitalize">{e.n}</div>
              <div className="ss capitalize" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
                <span style={{ color: c, fontWeight: 600, fontSize: 12 }}>{e.tg ? muscleLabel(e.tg) : bodyPartLabel(e.bp)}</span>
                <span style={{ color: 'var(--label-4)' }}>·</span>
                {equipmentLabel(e.eq)}
              </div>
            </div>
            {best > 0 && <span className="tag nocap pr-ref">{fmtNum(best)}</span>}
            <Button size="sm" variant="tinted" icon="plus" onClick={ev => { ev.stopPropagation(); addToRoutineSheet(e) }}>{t('Plan')}</Button>
          </div>
        )
      })}
      {base.length === 0 && <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>}
    </div>
    {base.length > shown && <><div style={{ height: 10 }} /><Button onClick={() => setShown(s => s + 40)}>{t('Show more')}</Button></>}
  </>
}
```

**Note:** this drops the dynamic single-select equipment chip row the old version had (`eqOpts.length > 1 && ...`) in favor of the "More filters" panel, which now also covers mechanics/laterality/muscle. Add the new `t()` source strings (`'Equipment'`, `'Mechanics'`, `'Laterality'`, `'Muscle'`, `'Minimum activation'`, `'Any equipment'`, `'Bodyweight only'`, `'Any'`, `'More filters'`, `'Reset filters'`) to `frontend/src/locales/fr.js` following that file's existing key→translation format.

- [ ] **Step 2: Manual smoke check**

Run: `cd frontend && npm run dev`, open Library, verify: body-part chips filter the list; "More filters" panel opens and each select (equipment/mechanics/laterality/muscle/activation) narrows the list; combining two filters (e.g. body part + muscle) applies both (AND logic); "Reset filters" clears everything; search still works.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/Library.jsx frontend/src/locales/fr.js
git commit -m "feat: rework Library filters (equipment, mechanics, laterality, muscle + activation)"
```

---

### Task 9: Remove the old enrichment bootstrap from `App.jsx`

**Files:**
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: nothing new
- Produces: nothing — pure removal, no other file depends on this call.

- [ ] **Step 1: Remove the import and the effect**

Delete line 9: `import { loadSwEnrichment } from './lib/exercises.js'`
Delete line 104: `useEffect(() => { loadSwEnrichment() }, [])`

- [ ] **Step 2: Verify the app still boots**

Run: `cd frontend && npm run dev`, open the app in a browser, confirm no console error about a missing import.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "chore: remove obsolete SmartWorkout enrichment bootstrap"
```

---

### Task 10: Regenerate the Excel template with the new taxonomy

**Files:**
- Modify: `frontend/src/lib/excelTemplate.js`

**Interfaces:**
- Consumes: `EXDB` (Task 3), `bodyPartLabel` (Task 5)
- Produces: same `downloadExcelTemplate()` export, same file name/behavior — only the generated *content* changes (new body parts, French dropdown labels).

- [ ] **Step 1: Update the body-part list and dropdown labels**

Add the import at the top:

```js
import { bodyPartLabel } from './exerciseLabels.js'
```

Replace the comment block above `BODY_PARTS` (previously documenting the 10 lowercase body parts) with:

```js
// Sorted list of all body parts present in the exercise database
const BODY_PARTS = [...new Set(EXDB.map(e => e.bp))].sort()
// ['ABS','BACK','BICEPS','CARDIO','CHEST','FOREARMS','GLUTEUS','LEGS','SHOULDERS','TRICEPS']
```

Replace the `bpListFormula` line (used by the Excel data validation) so the **dropdown shows French labels** while the hidden `Lists` sheet still keys off the raw `BODY_PARTS` codes for the named-range lookup:

```js
// Data validation shows French labels; the named ranges underneath still key off
// the raw BODY_PARTS codes (Lists sheet column headers), resolved via toRangeName.
const bpDisplayToCode = Object.fromEntries(BODY_PARTS.map(bp => [bodyPartLabel(bp), bp]))
```

Then in the `Lists` sheet generation loop, change the header cell (previously `toRangeName(bp)`) to still use the raw code for the named range (unchanged — named ranges must stay ASCII/stable), but change the **muscle-group dropdown validation formula** to list French labels:

```js
const bpListFormula = '"' + BODY_PARTS.map(bodyPartLabel).join(',') + '"'
ws.dataValidations.add('E2:E2000', { type: 'list', allowBlank: true, formulae: [bpListFormula], showErrorMessage: false })
```

Because the cascading `INDIRECT(SUBSTITUTE(E2," ","_"))` formula for column F now needs to resolve a **French label** back to the underlying code's named range, change the `SUBSTITUTE` formula to use a helper lookup column instead. Add a hidden helper column in the `Lists` sheet mapping French label → range name:

```js
// Helper column (far right of Lists) mapping French label -> range name, used by
// column F's INDIRECT lookup since the visible dropdown (E) now shows French labels
// but named ranges must stay ASCII-safe.
const helperCol = BODY_PARTS.length + 1
BODY_PARTS.forEach((bp, i) => {
  listsWs.getCell(i + 1, helperCol).value = bodyPartLabel(bp)
  listsWs.getCell(i + 1, helperCol + 1).value = toRangeName(bp)
})
const helperRangeRef = `Lists!$${colLetter(helperCol - 1)}$1:$${colLetter(helperCol)}$${BODY_PARTS.length}`
ws.dataValidations.add('F2:F2000', {
  type: 'list', allowBlank: true,
  formulae: [`INDIRECT(VLOOKUP(E2,${helperRangeRef},2,FALSE))`],
  showErrorMessage: false,
})
```

(remove the old `ws.dataValidations.add('F2:F2000', ...)` call using `INDIRECT(SUBSTITUTE(E2," ","_"))` — it's replaced by the `VLOOKUP` version above.)

- [ ] **Step 2: Update the example rows**

Replace the `bp:` values in the `examples` array (currently `'chest'`, `'shoulders'`, `'upper arms'`, `'back'`, `'upper legs'`, `'lower legs'`) with their French labels (since column E now shows French labels): `'Pectoraux'`, `'Épaules'`, `'Biceps'` (or `'Triceps'` depending which arm exercise), `'Dos'`, `'Jambes'` — and update the example exercise names in column F to real SmartWorkout names for those categories (e.g. `'Barbell Bench Press'` stays valid only if it exists in the new catalog — verify with a quick lookup):

```bash
node -e "const {EXDB}=await import('./frontend/src/lib/exercises.js'); console.log(EXDB.filter(e=>e.bp==='CHEST').slice(0,3).map(e=>e.n))" --input-type=module
```

Use whatever real names that prints (they will differ from the old `'Barbell Bench Press'`/`'Barbell Overhead Press'` placeholders — SmartWorkout's naming may differ slightly, e.g. `'Bench Press'` without the equipment prefix). Update all `ex:` values in the `examples` array accordingly so the generated template's example rows always match real catalog entries — add an assertion for this in Step 3.

- [ ] **Step 3: Add a regression test**

```js
// frontend/src/lib/excelTemplate.test.js
import { describe, it, expect } from 'vitest'
import { EXDB } from './exercises.js'

// The Excel template's example rows must reference real exercise names, or the
// generated dropdown (built from BODY_PARTS/EXDB) will show a broken example.
// This test lives here rather than importing excelTemplate.js directly because
// that module dynamically imports 'exceljs' and targets a browser download flow.
describe('excelTemplate example data availability', () => {
  it('has at least 3 CHEST exercises to use as examples', () => {
    expect(EXDB.filter(e => e.bp === 'CHEST').length).toBeGreaterThanOrEqual(3)
  })
  it('has at least 2 LEGS exercises to use as examples', () => {
    expect(EXDB.filter(e => e.bp === 'LEGS').length).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/excelTemplate.test.js`
Expected: PASS

- [ ] **Step 5: Manual verification (Excel round-trip)**

Run: `cd frontend && npm run dev`, trigger "Download template" from the plan/import UI, open the generated `.xlsx` in Excel or LibreOffice, confirm: column E dropdown shows French body-part labels; selecting one filters column F to matching English exercise names; fill 2-3 rows; use the app's "Import programme Excel/CSV" flow on that file; confirm the exercises are found (via `programImport.js`'s existing fuzzy `findExercise`, unchanged).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/excelTemplate.js frontend/src/lib/excelTemplate.test.js
git commit -m "feat: regenerate Excel template dropdown with new taxonomy and French labels"
```

---

### Task 11: Audit and update `Onboarding.jsx` equipment picker

**Files:**
- Modify: `frontend/src/views/Onboarding.jsx`

**Interfaces:**
- Consumes: whatever equipment list `Onboarding.jsx` currently hardcodes (inspect the file for the literal `'body weight'` match found during the spec audit)
- Produces: same onboarding flow, `S.equipment` (or equivalent state field) now stores values from the new equipment taxonomy.

- [ ] **Step 1: Locate and inspect the current equipment picker**

Run: `grep -n "body weight" frontend/src/views/Onboarding.jsx`

Read the surrounding ~30 lines to see the full hardcoded equipment list and how the selected value is later used (likely to pre-filter `Library.jsx` or seed a default routine).

- [ ] **Step 2: Replace the hardcoded list**

Replace whatever old lowercase equipment strings (`'body weight'`, `'barbell'`, `'dumbbell'`, `'cable'`, ...) the picker offers with a representative subset of the new SmartWorkout equipment codes relevant to home/gym setup choices, e.g.:

```js
const EQUIPMENT_OPTIONS = ['BARBELL', 'DUMBBELL', 'CABLE_MACHINE', 'PULL_UP_BAR', 'RESISTANCE_BAND', 'BENCH']
```

Render each option's label via `equipmentLabel(code)` (import from `../lib/exerciseLabels.js`) instead of the old `t(code)`. Keep whatever bodyweight-only option existed (map it to the `'Bodyweight only'` equivalent used in Task 8's Library filter, i.e. an empty-equipment sentinel, not a code).

- [ ] **Step 3: Manual verification**

Run: `cd frontend && npm run dev`, go through onboarding (or reset onboarding state via Settings if the app has a "redo onboarding" option), confirm the equipment step shows French labels and the selection persists without errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/Onboarding.jsx
git commit -m "fix: adapt onboarding equipment picker to new SmartWorkout equipment codes"
```

---

### Task 12: Regenerate demo mode data (`demoSeed.js`)

**Files:**
- Modify: `frontend/src/lib/demoSeed.js`

**Interfaces:**
- Consumes: `EXDB`/`EXIDX` (Task 3-4) — whatever exercise ids/names the demo seed currently hardcodes
- Produces: same exported seed-building function(s) — demo mode still renders a full pre-filled routine/history, just referencing ids that exist in the new 837-exercise catalog.

- [ ] **Step 1: Inspect current hardcoded references**

Run: `grep -n "id:\|EXIDX\[" frontend/src/lib/demoSeed.js | head -40`

Identify every exercise id or name literal the demo seed references.

- [ ] **Step 2: Replace hardcoded ids with lookups by name against the new catalog**

For each old exercise reference, find a same-muscle-group real replacement in the new `EXDB`, e.g.:

```js
import { EXDB } from './exercises.js'
const findByName = name => EXDB.find(e => e.n.toLowerCase() === name.toLowerCase())
```

Replace literal old ids (e.g. `'0001'`) with `findByName('Bench Press').id` (or whatever real names exist — verify with the same `node -e` lookup technique as Task 10 Step 2) so the demo seed is resilient to future catalog regenerations rather than pinned to ids that may not exist.

- [ ] **Step 3: Manual verification**

Run: `cd frontend && npm run dev`, enable DEMO mode from Settings, confirm the pre-filled workout history, routines, and PRs display real exercise names (not "Unknown exercise" placeholders from `exOr()`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/demoSeed.js
git commit -m "fix: regenerate demo mode seed data against the new exercise catalog"
```

---

### Task 13: Adapt `muscles.js` to `exercise_muscles`

**Files:**
- Modify: `frontend/src/lib/muscles.js`

**Interfaces:**
- Consumes: `musclesOf` (Task 4)
- Produces: whatever the existing exported function from `muscles.js` returns (inspect current signature before changing — likely a "most-trained muscle" or "muscle balance" stat consumed by `Stats.jsx`) — keep the same return shape so `Stats.jsx` needs no changes.

- [ ] **Step 1: Read the current implementation**

Read `frontend/src/lib/muscles.js` in full (it's short — the earlier audit found only one line, `add(ex.tg, 1)`, inside a function). Note its exact export name and return shape before changing anything.

- [ ] **Step 2: Replace the `.tg`-based counting with weighted `exercise_muscles` counting**

Where the old code did `add(ex.tg, 1)` (a flat +1 count per exercise, keyed by the old generic target-muscle string), replace with a weighted accumulation over `musclesOf(ex)`:

```js
import { musclesOf } from './exercises.js'
// ...inside the existing loop, replace `add(ex.tg, 1)` with:
musclesOf(ex).forEach(({ key, value }) => add(key, value / 100))
```

This keeps the same accumulator (`add`) and the same output shape (a map of muscle key → weight), just fed from real per-set activation percentages instead of a single flat +1 per exercise. If the residual cardio exercises (no `exercise_muscles`) should still contribute something to this stat, keep a fallback: `if (!musclesOf(ex).length && ex.tg) add(ex.tg, 1)`.

- [ ] **Step 3: Run existing tests, if any, and check `Stats.jsx` visually**

Run: `cd frontend && npx vitest run` (check if `muscles.test.js` exists; if not, this file has no automated coverage — rely on manual check)

Run: `cd frontend && npm run dev`, open Stats, confirm the muscle-balance/most-trained visualization still renders without errors and shows plausible data after logging a couple of sets.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/muscles.js
git commit -m "fix: derive muscle stats from exercise_muscles activation instead of flat .tg count"
```

---

### Task 14: Audit `import-csv.js` (legacy CSV importer)

**Files:**
- Modify (if needed): `frontend/src/lib/import-csv.js`

**Interfaces:**
- Consumes: `EXDB`/`findExercise`-equivalent matching, same as `programImport.js`
- Produces: same export surface — no signature changes expected, only internal field-name fixes if any hardcoded old-schema assumption is found.

- [ ] **Step 1: Read the file in full and compare against `programImport.js`'s `findExercise`**

Read `frontend/src/lib/import-csv.js`. Check specifically for any place it reads `.eq`/`.bp` and compares against **hardcoded old-taxonomy string literals** (e.g. `=== 'body weight'` or `=== 'cardio'`) rather than using `isCardio()`/`isBodyweightEq()` from `exercises.js`. Also check whether it does its own name-matching (duplicate of `findExercise`) or imports/reuses it.

- [ ] **Step 2: Fix any hardcoded literal found**

If a literal comparison like `row.bp === 'cardio'` exists, replace it with `isCardio(matchedExercise)` (import from `./exercises.js`) so it stays correct against the new `'CARDIO'` uppercase value automatically. If the file duplicates `findExercise`'s fuzzy-matching logic instead of importing it, that's a pre-existing duplication outside this task's scope — leave it, just confirm it operates on `.n` (name), which is untouched by this swap.

- [ ] **Step 3: Manual verification**

If the app exposes a CSV import entry point (check `sheets.jsx` for where `import-csv.js` is invoked), export a CSV from the new Excel template flow's "Programme" sheet as CSV and run it through the CSV import path; confirm exercises are found.

- [ ] **Step 4: Commit** (skip if Step 2 found nothing to change)

```bash
git add frontend/src/lib/import-csv.js
git commit -m "fix: use isCardio() helper instead of hardcoded 'cardio' literal in CSV importer"
```

---

### Task 15: Fix `history.test.js` fixtures and run the full suite

**Files:**
- Modify: `frontend/src/lib/history.test.js`

**Interfaces:**
- Consumes: `EXDB` (Task 3)
- Produces: n/a — test-only change.

- [ ] **Step 1: Update the fixture selectors**

Replace:

```js
const LIFT = EXDB.find(e => e.bp !== 'cardio' && e.eq !== 'body weight').id
const BW = EXDB.find(e => e.eq === 'body weight').id
```

with:

```js
const LIFT = EXDB.find(e => e.bp !== 'CARDIO' && e.eq !== 'body weight').id
const BW = EXDB.find(e => e.eq === 'body weight').id
```

(only the `'cardio'` → `'CARDIO'` literal needs updating — `eq === 'body weight'` still works unchanged thanks to the alias convention from Task 3.)

- [ ] **Step 2: Run the full test suite**

Run: `cd frontend && npx vitest run`
Expected: all suites pass — `history.test.js`, `progression.test.js`, `programImport.test.js`, `exercises.test.js`, `exercises-data.test.js`, `exerciseLabels.test.js`, `residual-cardio-data.test.js`, `excelTemplate.test.js`

If `progression.test.js` or `programImport.test.js` fail, read the failure, check whether they reference old lowercase body-part/equipment literals (same class of issue as `history.test.js`) and fix the same way — update the literal to the new uppercase/code value, do not change the logic under test unless the failure reveals an actual bug introduced by this swap.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/history.test.js
git commit -m "fix: update history.test.js fixture to new uppercase CARDIO body part"
```

---

### Task 16: Full manual verification pass

**Files:** none (verification only)

**Interfaces:** n/a

- [ ] **Step 1: Data integrity**

Run: `cd frontend && npx vitest run` — confirm 0 failures across the whole suite (this re-confirms every task's automated checks together).

- [ ] **Step 2: Enum translation completeness audit**

```bash
node -e "
const { EXDB } = await import('./frontend/src/lib/exercises.js')
const { BODY_PART_LABELS_FR, EQUIPMENT_LABELS_FR, MECHANICS_LABELS_FR, LATERALITY_LABELS_FR } = await import('./frontend/src/lib/exerciseLabels.js')
const bps = new Set(EXDB.map(e => e.bp))
const eqs = new Set(EXDB.flatMap(e => e.equipments || []))
const mechs = new Set(EXDB.map(e => e.mechanics).filter(Boolean))
const lats = new Set(EXDB.map(e => e.laterality).filter(Boolean))
console.log('missing body part labels:', [...bps].filter(b => !BODY_PART_LABELS_FR[b]))
console.log('missing equipment labels:', [...eqs].filter(e => !EQUIPMENT_LABELS_FR[e]))
console.log('missing mechanics labels:', [...mechs].filter(m => !MECHANICS_LABELS_FR[m]))
console.log('missing laterality labels:', [...lats].filter(l => !LATERALITY_LABELS_FR[l]))
" --input-type=module
```

Expected: all four arrays empty. If not, add the missing code(s) to the relevant dictionary in `exerciseLabels.js` (Task 5) and re-run.

- [ ] **Step 3: Excel round-trip** — repeat Task 10 Step 5 end-to-end once more after all other tasks are done (template generation depends on `EXDB`, which every prior task may have touched).

- [ ] **Step 4: Custom exercise creation**

Run: `cd frontend && npm run dev`, create a custom exercise picking body part `Cardio`, confirm it saves, appears in Library, and can be added to a routine and logged in a workout.

- [ ] **Step 5: History/progression/PR check**

Log a full workout session using at least one SmartWorkout exercise and one residual cardio exercise, confirm PR computation (`bestWeightFor`) and the Stats view render the exercise name/body part correctly with no console errors.

- [ ] **Step 6: Media rendering check**

In Library, open: (a) a SmartWorkout exercise with a working CDN video — confirm autoplay; (b) one of the 9 SmartWorkout exercises without a video (from the earlier audit: `Alternate Biceps Curl`, `Band Russian Twist`, `Bottom up rotation`, `Concentration Hammer Curl`, `KAS Glute Bridge`, `Kneeling Ring Push-Up`, `Pull Around`, `Spoto Press`, `Standing Incline Band Chest Fly`) — confirm it falls back to the static `image_url` photo, not a blank/broken state; (c) a residual cardio exercise — confirm the GIF renders.

- [ ] **Step 7: Demo mode check** — repeat Task 12 Step 3.

- [ ] **Step 8: No stray references to the retired `instr/` folder**

Run: `grep -rn "instr/" frontend/src --include="*.js*" | grep -v node_modules`

Expected: no remaining imports of `../instr/*.js` files anywhere (the `instrFor`/`instrPacks` machinery in `lib/i18n.js` becomes dead code once every exercise carries inline `instructions` — note this as a follow-up cleanup if removing it outright is judged too risky to bundle into this swap).

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "chore: final verification pass for SmartWorkout exercise catalog swap"
```

---

## Self-Review Notes

- **Spec coverage:** every spec section has a task — data model (Tasks 1-3), video (Task 4/6), muscle detail (Task 4/7), filters (Task 8), Excel (Task 10), custom exercises (verified in Task 16 Step 4, no code change needed per spec's own finding), other audited files (Tasks 11-14), test fixture fallout (Task 15), verification checklist (Task 16 mirrors the spec's 9-point plan).
- **Alias completeness:** the spec only named `n`/`bp` as aliases; this plan extends that to `n`/`bp`/`tg`/`eq` after tracing ~49 real call sites — documented in Global Constraints so it's a visible, intentional extension of the spec's intent, not a silent deviation.
- **`instr/` retirement:** the spec called for removing `frontend/src/instr/*.js` outright; Task 16 Step 8 downgrades this to a verified-safe-to-remove-later note rather than a forced deletion, because `lib/i18n.js`'s `instrPacks`/`INSTR_LANGS` machinery also affects the 9 non-FR/EN languages' fallback behavior — removing it is safe (nothing in the new catalog needs it) but is called out explicitly rather than silently bundled into Task 3, so a reviewer can decide whether to fold the deletion into this branch or a follow-up.
