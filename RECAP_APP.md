# openGym (Sasoian) — Récap complet du projet

> Généré le 5 septembre 2026 — version `1.2.4`

---

## 1. Présentation générale

**Nom commercial :** Sasoian  
**Nom technique :** openGym  
**Type :** Application mobile-first de suivi d'entraînement et de nutrition  
**Licence :** AGPL-3.0-or-later  
**Cible :** Parents (50-60 ans) + athlètes

### Stack technique

| Couche | Technologie |
|--------|-------------|
| UI | React 19 + JSX (`.jsx`, pas TypeScript) |
| Routage | React Router 6 (HashRouter) |
| State | Zustand 5 (immer-style `update(s => { s.X = ... })`) |
| Build | Vite 8 |
| Tests | Vitest |
| Mobile | Capacitor 7 (iOS + Android) |
| Export Excel | ExcelJS + SheetJS (xlsx) |

### Modes de fonctionnement

| Mode | Description |
|------|-------------|
| **Signé** | Compte avec passkey WebAuthn, sync serveur |
| **Invité** | Local uniquement (localStorage), pas de sync |
| **DEMO** | Données de démo pré-remplies, lecture seule |
| **MOBILE** | Build Capacitor, stockage fichier natif (pas de backend) |

---

## 2. Architecture

```
src/
├── App.jsx             — Shell principal, routing, thème, i18n
├── sheets.jsx          — Toutes les bottom sheets (modale bas de page)
├── main.jsx
├── index.css           — Design system complet (CSS vars, classes utilitaires)
├── components/         — Composants réutilisables
├── views/              — Écrans principaux
│   └── nutrition/      — Sous-vues de l'onglet Nutrition
├── store/
│   ├── useStore.js     — Store Zustand principal + persistence
│   └── useUI.js        — Store UI (sheets, toasts)
├── lib/                — Logique métier pure (pas de React)
├── locales/            — Traductions (de, es, hi, it, ko, pl, pt, ru, tr, zh)
└── instr/              — Instructions d'exercices localisées (fr, es, hi, it, ko, pl, ru, tr, zh)
```

### State (DEF dans useStore.js)

```js
{
  // Profil
  unit, lang, theme, accent, body, displayName, goal, level, equipment,
  daysPerWeek, sports, onboardingDone,

  // Entraînement
  routines, programmes, week, dayPlan, exWeights, workouts, active, customEx,

  // Suivi corporel
  bodyweight, measurements, targetW,

  // Nutrition
  nutrition: { sex, age, heightCm, activityLevel, workoutsPerWeek, bmr, tdee,
               history, goal, goalDelta, targetKcal, diet, macros },
  nutritionLog,        // { "2026-09-05": { meals: [...], sport: [...] } }
  nutritionFavorites,

  // Rappels
  reminder, reminderBW, reminderMeas,

  // Préférences
  effort, simpleMode, promptWeighBefore, restSec, sound, keepAwake, gifSize,
}
```

---

## 3. Vues implémentées ✅

### Navigation principale (TabBar — 6 onglets)
`Home · Plan · [Bouton Start] · Stats · Library · Nutrition`

---

### 3.1 Login
- Connexion par passkey WebAuthn (Face ID / empreinte)
- Création de compte
- Mode invité
- Mode DEMO

### 3.2 Onboarding
- Écran de bienvenue avec feature cards
- Saisie du prénom
- Glow ambiant animé

### 3.3 Home (`/home`)
- **Grille semaine** : 7 jours, dot coloré (planifié / modifié / fait)
- **Today card** : routine du jour, bouton démarrer
- **NutriWidget** : calories consommées vs objectif du jour
- **LastWorkoutCard** : résumé dernier entraînement
- **Poids corporel** : dernier poids + mini-graphe
- **SmartNudge** : suggestion contextuelle (streaks, progrès)
- **Streak card** : semaines consécutives avec arc de progression
- **Quick log** : boutons poids / mensurations en un tap
- **ProgrammeCard** (si programme actif) : progression semaine courante

### 3.4 Plan (`/plan`)
- **Section Programmes** : ProgrammeCard avec navigation semaine, sessions done/next/upcoming, bouton Skip
- **Grille semaine** : 7 colonnes, assignation de routine par jour
- **Liste des routines** : avec emoji, nombre d'exercices, bouton éditer

### 3.5 RoutineEdit (`/plan/r/:id`)
- Éditeur de routine complet
- Exercices avec séries, répétitions, poids, temps de repos
- Supersets côte à côte
- Modes : reps / temps / cardio
- Copier / supprimer / réordonner

### 3.6 Workout (`/workout`)
- Séance active avec chronomètre
- Blocs exercice avec couleur par groupe musculaire
- Lignes de séries : nombre de reps / poids / effort (RPE ou RIR)
- Progression automatique (suggère le poids/reps suivants)
- Timer de repos (RestTimer) avec alerte sonore et vibration
- Supersets sur 2 colonnes
- Temps sous tension, cardio distance/vitesse

### 3.7 CardioWorkout (`/cardio`)
- Séance cardio dédiée (course, vélo, natation…)
- Chrono, distance, fréquence cardiaque

### 3.8 Stats (`/stats`)
- **MetricCards** : volume, séances, durée, PRs
- **StreakBadge** : anneau de progression hebdomadaire
- **MuscleBalance** : heatmap SVG corps humain, filtre par fenêtre temporelle
- **Heatmap calendaire** : mois par mois, clic pour détail séance
- **VolumeChart** / **CalorieTrendChart** : graphiques SVG
- **PRBoard** : meilleurs records par exercice
- **EffortCard** : distribution RPE/RIR
- **MeasurementsCard** : évolution des mensurations

### 3.9 History (`/history`)
- Liste chronologique des séances groupées par mois
- Tap → détail de la séance (exercices, séries, volume)

### 3.10 Library (`/library`)
- Base d'exercices complète (plusieurs centaines)
- Chips de filtrage par groupe musculaire (colorés)
- Recherche textuelle
- Vignettes images / GIFs (CDN jsDelivr)
- Instructions localisées (fr, en, es, it, ko, pl, ru, tr, zh, hi)
- Exercices personnalisés

### 3.11 Settings (`/settings`)
- **Compte** : passkey, synchro serveur, déconnexion, suppression
- **Général** : unité (kg/lb), langue, corps (H/F)
- **Pendant la séance** : son, écran allumé, effort (RPE/RIR), simple mode
- **Rappels** : poids (quotidien), mensurations (x jours), workout (push web)
- **Apparence** : thème (clair/sombre), couleur accent (8 choix)
- **Données** : export JSON backup, import JSON, import CSV (FitNotes, Strong, Hevy, Lyfta), import Excel programme, import plan, export plan, Apple Health (poids)
- **Plans de départ** : charger plan Push/Pull/Legs

### 3.12 BodyWeight (`/bodyweight`)
- Graphe historique avec régression linéaire
- Moyenne mobile 7j
- Projection 8 semaines vers l'objectif
- Delta vs semaine précédente
- IMC (si taille renseignée)
- Évolution des mensurations en bas

### 3.13 Nutrition (`/nutrition`) — 5 sous-onglets

#### Profil
- Calcul BMR (Harris-Benedict + Mifflin-St Jeor)
- Calcul TDEE selon niveau d'activité + séances/semaine
- Objectifs : sèche / prise de masse / recompo / maintien
- Préférences alimentaires : omnivore/vegan/végé, allergènes, repas/jour
- Macros calculés (ANSES/EFSA) avec ajustement manuel
- NutriPlan : répartition macros + conseils par objectif + split entraînement/repos

#### Aujourd'hui
- Sélecteur de date (navigation jour par jour)
- Indicateur training day / rest day (cycling calorique)
- **MacroDonut** SVG : kcal consommés vs cible, anneau protéines/glucides/lipides
- **NutriBars** : 4 barres (protéines, glucides, lipides, fibres)
- **Créneaux repas** : petit-déj, déjeuner, dîner, collations
  - Barre de progression par créneau
  - Macros cibles par créneau (pondération repas 1.5× / collation 0.5×)
  - Cartes d'aliments avec détail
- Ajout d'aliments : Favoris / Recherche (Open Food Facts) / Saisie manuelle / Suggestions recettes

#### Semaine
- Vue 7 jours avec kcal et barre macro par jour
- Totaux de la semaine

#### Bilan
- Dépense base (TDEE) vs dépense sport vs apport alimentaire
- NutriBar visuelles
- Tableau récap (dépense totale, apport, solde)
- Sparkline 7 jours (déficit/surplus)

#### Aliments
- Bibliothèque d'aliments locaux
- Badges macros colorés
- Barre de recherche

#### Cardio (section en bas de "Aujourd'hui")
- Ajout d'activités cardio (15+ sports)
- Calcul kcal dépensés (formules MET × poids × durée)
- Historique du jour

### 3.14 Admin (`/admin`)
- Dashboard opérateur (accès réservé admin)
- Liste des utilisateurs, désactivation
- Anglais uniquement (hors surface traduite)

---

## 4. Composants principaux

| Composant | Rôle |
|-----------|------|
| `BodyMap` | Heatmap SVG muscles humains (charge par groupe) |
| `BodyMeasureMap` | Silhouette anatomique avec crop image + inputs mensurations |
| `ErrorBoundary` | Catch React, garde la TabBar accessible |
| `FoodEntry` | FoodQty (quantité) + ManualEntry (saisie libre) |
| `FoodSearch` | Appel Open Food Facts, affichage résultats |
| `Heatmap` | Calendrier mensuel des séances |
| `Icon` | Icônes SF Symbols-style |
| `LineChart` | Graphe SVG générique (poids, 1RM…) |
| `MacroDonut` | Anneau SVG kcal + donut macros |
| `Media` | Images et GIFs exercices (local ou CDN) |
| `NutriBar` | Barre de progression macros |
| `NutriTip` | Carte conseil nutritionnel contextuel |
| `ProgrammeCard` | Carte programme multi-semaines |
| `RecipeCard` | Carte recette suggestion |
| `RestTimer` | Timer repos + timer timed sets |
| `TabBar` | Navigation principale 6 onglets |
| `Toast` | Notification brève en bas d'écran |
| `TutorialOverlay` | Overlay tutoriel étape par étape |
| `ui.jsx` | Button, Switch, Segmented, SelectRow, Slider, TextField… |

---

## 5. Fonctionnalités métier clés

### Progression automatique
- **Politiques** : off / linear / Greyskull LP / double progression / add time
- Déduction depuis l'historique (jamais de compteurs stockés)
- Visible dans la séance : "suggestion 80kg × 3 × 5"
- Deload automatique sur échecs répétés

### Programmes multi-semaines
- Création de programmes (N routines × M semaines)
- Suivi session par session : done / next / upcoming
- Avancement automatique après chaque séance complète
- Navigation entre semaines dans la carte

### Import / Export
- **Import CSV** : FitNotes, FitNotes 2, Strong, Hevy, Lyfta + format générique
- **Import Excel** : template de programme structuré
- **Import Apple Health** : poids corporel (XML scan)
- **Partage de plan** : bundle JSON (routines + semaine + exos custom), printable PDF
- **Backup JSON** : export/import complet de l'état

### Internationalization
- Langue UI : fr, en, de, es, hi, it, ko, pl, pt, ru, tr, zh
- Instructions d'exercices : fr, en, es, hi, it, ko, pl, ru, tr, zh

### Rappels
- **Web Push** : via Service Worker + backend VAPID
- **Natif (Mobile)** : Local Notifications Capacitor (pas de backend)
- Rappel poids quotidien (heure configurable)
- Rappel mensurations (fréquence configurable)
- Rappel séance par jour de la semaine planifié

### Nutrition
- BMR : formule de Mifflin-St Jeor (ou Harris-Benedict)
- TDEE : × facteur activité (sédentaire → très actif)
- Macros : normes ANSES/EFSA selon objectif et poids
- Cycling calorique : +200 kcal jours d'entraînement, redistribution sur repos
- Open Food Facts : base ouverte ~3 M produits
- MET cardio : 15+ activités (course, vélo, natation, rameur…)

---

## 6. Bugs connus et fixes récents

### Fixes appliqués dans les sessions récentes

| Fichier | Bug | Fix |
|---------|-----|-----|
| `Heatmap.jsx:84` | `var(--label-1)` inexistant | → `var(--label)` |
| `ProgrammeCard.jsx:203` | `var(--label-1)` inexistant | → `var(--label)` |
| `DayView.jsx` | `var(--label-1)` + `var(--separator)` | → `var(--label)` + `var(--sep)` |
| `WeekView.jsx` | `var(--label-1)` + `var(--separator)` | → `var(--label)` + `var(--sep)` |
| `Profile.jsx` | `var(--separator)` inexistant | → `var(--sep)` |
| `FoodsView.jsx` | `'var(--teal)1A'` (hex-alpha invalide) | → `color-mix()` |
| `FoodsView.jsx` | Tokens macro `--blue/orange/yellow` | → `--nut-prot/carbs/fat` |
| `NutriPlan.jsx` | `color + '1A'` (hex-alpha invalide) | → `color-mix()` |
| `NutriPlan.jsx` | Tokens macro `--blue/orange/yellow` | → `--nut-prot/carbs/fat` |
| `sheets.jsx` | Dead code `const gender` dans MeasurementsSheet | Supprimé |
| `BodyMeasureMap.jsx` | `CROP.male.x=78` → 4 bandes cuivrées (mauvais crop) | → `x=0, w=185` |

### Bugs potentiels non vérifiés
- `BodyMeasureMap` : crop corrigé mais non validé visuellement (attente retour)
- Open Food Facts : timeout 8s, peut rater sur connexion lente, pas de retry
- `FoodSearch` : pas de cache local des recherches OFF

---

## 7. Ce qui ne fonctionne PAS / Limitations

### Backend requis (non inclus dans ce repo)
Les fonctionnalités suivantes **nécessitent un serveur Node.js** séparé :
- Authentification passkey WebAuthn (`/api/register/*`, `/api/login/*`)
- Sync cloud des données (`/api/state`)
- Web Push notifications (`/api/push/*`)
- Dashboard Admin (`/api/admin/*`)

→ En mode **Invité** ou **MOBILE**, tout fonctionne sans backend.

### Mode DEMO
- Données en lecture seule (pas de persistance)
- Réinitialisable via Settings

### Mensurations (BodyMeasureMap)
- Silhouette : crop recalibré (x=0, w=185 pour homme ; x=768, w=185 pour femme)
- À valider visuellement : si la silhouette affiche toujours le mauvais crop, ajustement pixel par pixel nécessaire
- 6 zones mesurées : poitrine, taille, hanches, bras, cuisse, mollet

### Nutrition
- Recherche Open Food Facts : dépend d'une connexion internet
- Pas de cache offline des aliments recherchés
- La base locale d'aliments (`FoodsView`) est statique (pas d'ajout persistant entre sessions)

---

## 8. Tests unitaires

| Fichier de test | Ce qui est testé |
|-----------------|-----------------|
| `demoSeed.test.js` | Données de seed demo |
| `effort.test.js` | Calcul RPE/RIR, histogramme effort |
| `goals.test.js` | Calcul objectif calorique |
| `history.test.js` | Helpers historique séances |
| `import-effort.test.js` | Import des données effort |
| `macros.test.js` | Calcul macros (protéines, glucides, lipides) |
| `nutrition.test.js` | BMR / TDEE |
| `onerm.test.js` | Estimation 1RM (Epley, etc.) |
| `programImport.test.js` | Import programme Excel |
| `progression.test.js` | Politiques de progression automatique |
| `wakelock.test.js` | Screen Wake Lock API |
| `cardio.test.js` | Calcul kcal cardio (MET) |

Commande : `npm test` (vitest run)

---

## 9. Design system (index.css)

### Variables CSS principales
```
Thème        : --bg, --surface, --surface-2, --surface-3
Texte        : --label, --label-2, --label-3, --label-4
Accent       : --acc, --acc-2, --acc-soft, --on-acc
Séparateurs  : --sep, --sep-op, --acc-line, --hair
Couleurs     : --blue, --orange, --purple, --teal, --yellow, --green, --pink, --indigo, --red, --grey
Nutrition    : --nut-prot, --nut-carbs, --nut-fat, --nut-kcal, --nut-fiber
```

### Thèmes disponibles
- **Dark** (défaut) : fond chaud noir/brun (style Ganbaru), accent lime/teal
- **Light** : fond oat chaud (#F5F0EA), accent configurable

### Accents configurables (8)
lime · teal · blue · orange · rose · purple · amber · indigo

### Variables CSS qui N'EXISTENT PAS (à ne jamais utiliser)
- `--label-1` → utiliser `--label`
- `--separator` → utiliser `--sep`
- Hex-alpha sur var CSS → utiliser `color-mix(in srgb, var(--X) 15%, transparent)`

---

## 10. Ce qui reste à faire / pistes d'amélioration

### Priorité haute
- [ ] **Valider le crop BodyMeasureMap** après le fix (ouvrir l'app, vérifier la silhouette)
- [ ] **Cache offline aliments OFF** : stocker les 20 dernières recherches en localStorage
- [ ] **Retry automatique** sur timeout Open Food Facts

### Priorité moyenne
- [ ] **Nutrition — onglet Aliments** : permettre d'ajouter des aliments custom permanents
- [ ] **Calories brûlées dans le workout** : afficher les kcal dépensés estimés en fin de séance
- [ ] **Programme partageable** : QR code ou lien profond pour partager un programme
- [ ] **Dark mode des graphes** : vérifier lisibilité LineChart/MacroDonut en mode clair

### Priorité basse / idées
- [ ] Widgets iOS/Android (Capacitor plugin widget)
- [ ] Apple Watch / WearOS companion
- [ ] Import Garmin Connect / Polar (fichier .fit ou .tcx)
- [ ] Mode simplifié (simpleMode déjà en store, UI à finir)
- [ ] Historique des programmes passés (archive)
- [ ] Comparaison de performances entre programmes

---

## 11. Structure des fichiers de la lib

| Fichier | Rôle |
|---------|------|
| `api.js` | Fetch REST + helpers WebAuthn |
| `body-paths.js` | Chemins SVG corps humain (BodyMap) |
| `cardio.js` | Coefficients MET, calc kcal cardio |
| `demo.js` | Flags DEMO, REPO |
| `demoSeed.js` | Données de démo |
| `effort.js` | RPE/RIR, histogramme, scale |
| `exercises.js` | Wrapper EXDB, EXIDX, filtres |
| `exercises-data.js` | Base d'exercices complète (~700 exercices) |
| `excelTemplate.js` | Génération template Excel programme |
| `foodSearch.js` | Appel Open Food Facts + normalisation |
| `format.js` | fmtNum, fmtDate, todayISO, uid… |
| `glyphs.js` | Emoji → icône SVG (routines) |
| `goals.js` | calcTargetKcal(tdee, delta) |
| `history.js` | Helpers séances, buildSets, lastBW… |
| `i18n.js` | t(), setLang(), LANGS |
| `import-csv.js` | CSV FitNotes / Strong / Hevy / Lyfta |
| `macros.js` | calcMacros(kcal, poids, goal) |
| `measurements.js` | latestMeasurements, measureSeries |
| `mobile.js` | nativeLoad/Save, syncReminder (Capacitor) |
| `muscles.js` | loadOfWorkouts, rankOf |
| `nav.js` | navigate() singleton |
| `nutrition.js` | calcBMR, calcTDEE |
| `onerm.js` | estimate1RM, best1RM |
| `plan-share.js` | buildPlanBundle, parsePlan, printPlan |
| `programImport.js` | parseProgram (Excel → routines) |
| `programme.js` | sessionStates, isWeekComplete, isProgrammeComplete |
| `progression.js` | nextPrescription, applyPrescription, POLICIES |
| `prs.js` | allTimePRs, is1RMRecord |
| `push.js` | enablePush, disablePush, sendTestPush |
| `recipes.js` | suggestRecipes (algo best-candidate) |
| `reminders.js` | bwReminderDue, measReminderDue |
| `sound.js` | beep(), vibrate() |
| `sports.js` | SPORTS, isCardioSport |
| `starter.js` | starterRoutines() Push/Pull/Legs |
| `tips.js` | getActiveTips (conseils nutritionnels contextuels) |
| `tutorials.js` | HOME_STEPS, STATS_STEPS, NUTRITION_STEPS… |
| `wakelock.js` | useWakeLock hook |

---

*Fichier généré automatiquement — à mettre à jour à chaque session de développement significative.*
