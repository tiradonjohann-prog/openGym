// Tutorial step arrays — one per screen.
// Each step: { selector, title, text, bonus?, progressLabel?, forceAbove?, multiSpotlight? }
// selector: CSS string, function → Element, or function → Element[]
// text: supports simple HTML (<b>, <br>)

import { t } from './i18n.js'

// ── Home ─────────────────────────────────────────────────────────────────────
// Home renders one of two layouts (ProgrammeHome / ClassicHome — see Home.jsx)
// depending on whether the user has created at least one programme. Both share
// the header, the quick-glance grid, and the activity CTA — only the "what to
// do today" step and a couple of bonus tips differ, so those three are shared
// step objects and each layout gets its own array around them.
const HOME_STEP_HEADER = {
  selector: '[data-tuto="home-header"]',
  title: () => t('Welcome to Sasoian!'),
  text: () => t('Your training starts here. This screen shows what to do today and a quick overview of your progress.'),
}
const HOME_STEP_GRID = {
  selector: '[data-tuto="home-grid"]',
  title: () => t('Quick glance'),
  text: () => t('This week\'s progress, your latest weigh-in, and — if enabled in your nutrition profile — your measurements. Tap <b>Poids</b> to log a new weigh-in in one tap.'),
}
const HOME_STEP_ACTIVITY = {
  selector: '[data-tuto="home-activity"]',
  title: () => t('Log activity'),
  text: () => t('Log a cardio session: running, cycling, rowing… The app calculates estimated calorie burn from your profile.'),
  bonus: true,
  progressLabel: () => t('Tip'),
}

export const HOME_STEPS_PROGRAMME = [
  HOME_STEP_HEADER,
  HOME_STEP_GRID,
  {
    selector: '[data-tuto="home-next"]',
    title: () => t('Next session'),
    text: () => t('Your programme\'s next planned session. Tap <b>Démarrer</b> to start it, or <b>Voir les semaines</b> to browse other weeks.'),
  },
  HOME_STEP_ACTIVITY,
]

export const HOME_STEPS_CLASSIC = [
  HOME_STEP_HEADER,
  HOME_STEP_GRID,
  {
    selector: '[data-tuto="home-next"]',
    title: () => t('Weekly plan & today'),
    text: () => t('Assign a routine to each day of the week, then tap <b>Today</b> to start the session planned for today. Leave a day empty for rest.'),
  },
  HOME_STEP_ACTIVITY,
  {
    selector: '[data-tuto="home-bw"]',
    title: () => t('Body weight'),
    text: () => t('A closer look at your weight curve and progress toward your goal. Tap to open the full history.'),
    bonus: true,
    progressLabel: () => t('Tip'),
  },
  {
    selector: '[data-tuto="home-streak"]',
    title: () => t('Streak'),
    text: () => t('Your consecutive training weeks. The bars show how much of this week\'s sessions you\'ve completed vs. planned.'),
    bonus: true,
    progressLabel: () => t('Tip'),
  },
]

// ── Workout ──────────────────────────────────────────────────────────────────
export const WORKOUT_STEPS = [
  {
    selector: '[data-tuto="workout-header"]',
    title: () => t('Active workout'),
    text: () => t('You are now in a live session. The timer starts automatically. Finish at your own pace — the session is saved when you tap the checkmark.'),
  },
  {
    selector: '[data-tuto="workout-exercises"]',
    title: () => t('Exercises'),
    text: () => t('Each chip is one exercise in this session — supersets share a group (2A, 2B…). Tap any chip to jump straight to it.'),
  },
  {
    selector: '[data-tuto="workout-set"]',
    title: () => t('Logging a set'),
    text: () => t('Enter the weight and reps (pre-filled from your last session), then tap <b>✓</b> to validate the set.'),
  },
  {
    selector: '#timer',
    title: () => t('Rest timer'),
    text: () => t('Starts automatically after a completed set. Adjust the duration or skip it — a vibration alerts you when time is up.'),
    bonus: true,
    progressLabel: () => t('Tip'),
  },
  {
    selector: '[data-tuto="workout-finish"]',
    title: () => t('Finishing the session'),
    text: () => t('Tap here to save the workout. The app calculates total volume, PRs, and updates your stats automatically.'),
  },
]

// ── Stats ────────────────────────────────────────────────────────────────────
export const STATS_STEPS = [
  {
    selector: '[data-tuto="stats-metrics"]',
    title: () => t('Key metrics'),
    text: () => t('A snapshot of your global performance: total workouts, volume lifted, best single effort, and current streak.'),
  },
  {
    selector: '[data-tuto="stats-streak"]',
    title: () => t('Streak badge'),
    text: () => t('The ring fills as you complete planned sessions this week. Tap to view the full workout calendar.'),
  },
  {
    selector: '[data-tuto="stats-bw"]',
    title: () => t('Body weight history'),
    text: () => t('Your weight evolution over time. Switch between 30 days, 90 days, or all-time. The trend line and moving average help smooth out daily fluctuations.'),
  },
  {
    selector: '[data-tuto="stats-muscles"]',
    title: () => t('Muscle map'),
    text: () => t('The colour intensity shows which muscle groups you\'ve trained most in the selected period. Useful for spotting imbalances.'),
  },
  {
    selector: '[data-tuto="stats-prs"]',
    title: () => t('Personal records'),
    text: () => t('Your all-time PRs per exercise. A trophy appears on your home screen every time you break one during a workout.'),
  },
  {
    selector: '[data-tuto="stats-measurements"]',
    title: () => t('Measurements'),
    text: () => t('Track changes in chest, waist, arm, thigh and calf over time. Enable <b>Suivre les mensurations</b> in your nutrition profile to see this section.'),
    bonus: true,
    progressLabel: () => t('Tip'),
  },
]

// ── Body weight ──────────────────────────────────────────────────────────────
export const BODYWEIGHT_STEPS = [
  {
    selector: '[data-tuto="bw-summary"]',
    title: () => t('Current stats'),
    text: () => t('Your most recent weigh-in, the change vs. the previous entry, and the total change from your first log.'),
  },
  {
    selector: '[data-tuto="bw-chart"]',
    title: () => t('Weight curve'),
    text: () => t('The <b>blue dotted line</b> is the 7-day moving average — it smooths out water weight and meal timing. The <b>yellow dashed line</b> is the linear trend and projection.'),
  },
  {
    selector: '[data-tuto="bw-goal"]',
    title: () => t('Goal tracking'),
    text: () => t('Set a target weight. The app estimates how many days to reach it based on your current trend or calorie deficit — whichever gives a realistic answer.'),
    bonus: true,
    progressLabel: () => t('Tip'),
  },
  {
    selector: () => [document.querySelector('[data-tuto="bw-history"]'), document.querySelector('[data-tuto="bw-measurements"]')],
    multiSpotlight: true,
    title: () => t('History & measurements'),
    text: () => t('Tap any past entry to delete it. Below, a summary of your latest body measurements — tap <b>Log</b> to add a new set.'),
  },
]

// ── Settings ─────────────────────────────────────────────────────────────────
export const SETTINGS_STEPS = [
  {
    selector: '[data-tuto="settings-profile"]',
    title: () => t('Profile'),
    text: () => t('Set your display name and choose the unit system (kg / lb). Your name appears in the greeting on the home screen.'),
  },
  {
    selector: '[data-tuto="settings-reminders"]',
    title: () => t('Health reminders'),
    text: () => t('Configure automatic reminders to weigh yourself and take measurements. Default: daily weigh-in at 7:00. You can change the frequency and time.'),
  },
  {
    selector: '[data-tuto="settings-notifications"]',
    title: () => t('Workout notifications'),
    text: () => t('Enable push notifications to get reminded on training days. The app sends one notification per planned workout day at the time you choose.'),
    bonus: true,
    progressLabel: () => t('Tip'),
  },
  {
    selector: '[data-tuto="settings-data"]',
    title: () => t('Data & backup'),
    text: () => t('Export all your data as JSON. Import it on another device to restore everything — workouts, weight history, routines, and settings.'),
  },
]

// ── Plan ─────────────────────────────────────────────────────────────────────
export const PLAN_STEPS = [
  {
    selector: '[data-tuto="plan-create"]',
    title: () => t('Create a programme'),
    text: () => t('Build a multi-week training plan from scratch — pick your routines, set the number of weeks, and let the app rotate sessions automatically.'),
  },
  {
    selector: '[data-tuto="plan-programmes"]',
    title: () => t('Your programmes'),
    text: () => t('Every programme you\'ve created, active or paused. Tap one to open it, track progress week by week, or resume where you left off.'),
  },
  {
    selector: '[data-tuto="plan-routines"]',
    title: () => t('Your routines'),
    text: () => t('Each routine is a named workout template with a fixed list of exercises. Tap to edit exercises, order, and set targets. Add routines to a programme with <b>+ Programme</b>.'),
  },
]

// ── Nutrition ────────────────────────────────────────────────────────────────
// Nutrition is a single-page tab switcher (Aujourd'hui/Semaine/Bilan/Aliments/
// Profil — see Nutrition.jsx). Each step switches to its real tab via ensure()
// before showing, so the highlighted content always matches what the step
// describes — the same "drive a real selection" technique used for demos.
export function nutritionSteps(setTab) {
  return [
    {
      selector: '[data-tuto="nutri-nav"]',
      title: () => t('Nutrition sections'),
      text: () => t('Switch between today\'s log, the weekly view, your calorie balance, the food database, and your profile.'),
      ensure: () => setTab('today'),
    },
    {
      selector: '[data-tuto="nutri-today"]',
      title: () => t("Today's intake"),
      text: () => t('Search for foods or enter them manually. Each entry shows calories, protein, carbs, and fat. The ring fills as you approach your daily target.'),
      ensure: () => setTab('today'),
    },
    {
      selector: '[data-tuto="nutri-week"]',
      title: () => t('Weekly view'),
      text: () => t('See your average daily intake vs. target over the last 7 days. Consistency matters more than hitting the exact number every day.'),
      ensure: () => setTab('week'),
    },
    {
      selector: '[data-tuto="nutri-profile"]',
      title: () => t('Nutrition profile'),
      text: () => t('Enter your stats to calculate your TDEE (total daily energy expenditure) and set your calorie target based on your goal. Enable <b>Suivre les mensurations</b> here to track measurements in Home and Stats.'),
      ensure: () => setTab('profile'),
    },
  ]
}
