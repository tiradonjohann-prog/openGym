// Tutorial step arrays — one per screen.
// Each step: { selector, title, text, bonus?, progressLabel?, forceAbove?, multiSpotlight? }
// selector: CSS string, function → Element, or function → Element[]
// text: supports simple HTML (<b>, <br>)

import { t } from './i18n.js'

export const HOME_STEPS = [
  {
    selector: '[data-tuto="home-header"]',
    title: () => t('Welcome to Sasoian!'),
    text: () => t('Your training starts here. This screen shows your programme for today and a quick overview of your progress.'),
  },
  {
    selector: '[data-tuto="home-week"]',
    title: () => t('Weekly calendar'),
    text: () => t('Tap a day to see or change the planned workout. The coloured dot shows: <b>planned</b>, <b>modified</b>, or <b>done</b>.'),
  },
  {
    selector: '[data-tuto="home-today"]',
    title: () => t("Today's workout"),
    text: () => t('Tap here to start the session planned for today. If no routine is assigned, you can pick one or add a rest day.'),
  },
  {
    selector: '[data-tuto="home-bw"]',
    title: () => t('Body weight'),
    text: () => t('Log your weight daily — ideally fasted and after using the toilet for consistent readings. Tap the graph to see your full history.'),
  },
  {
    selector: '[data-tuto="home-quicklog"]',
    title: () => t('Quick log'),
    text: () => t('Log your body weight or body measurements in one tap. The more regularly you track, the more accurate your progress data becomes.'),
  },
  {
    selector: '[data-tuto="home-streak"]',
    title: () => t('Streak'),
    text: () => t('Your consecutive training weeks. The arc shows how much of this week\'s sessions you\'ve completed vs. planned.'),
    bonus: true,
    progressLabel: () => t('Tip'),
  },
  {
    selector: '[data-tuto="home-activity"]',
    title: () => t('Log activity'),
    text: () => t('Log a cardio session: running, cycling, rowing… The app calculates estimated calorie burn from your profile.'),
    bonus: true,
    progressLabel: () => t('Tip'),
  },
]

export const WORKOUT_STEPS = [
  {
    selector: '[data-tuto="workout-header"]',
    title: () => t('Active workout'),
    text: () => t('You are now in a live session. The timer starts automatically. Finish at your own pace — the session is saved when you tap <b>Finish</b>.'),
  },
  {
    selector: '[data-tuto="workout-exercises"]',
    title: () => t('Exercises'),
    text: () => t('Each card is one exercise from your routine. Expand it to log sets. The last session\'s values are pre-filled to save time.'),
  },
  {
    selector: '[data-tuto="workout-set"]',
    title: () => t('Logging a set'),
    text: () => t('Enter the weight and reps. Tap <b>✓</b> to validate the set. A new row appears automatically so you can log the next set without extra taps.'),
  },
  {
    selector: '[data-tuto="workout-rest"]',
    title: () => t('Rest timer'),
    text: () => t('The timer starts after each completed set. You can adjust the duration or skip it. A vibration alerts you when time is up.'),
    bonus: true,
    progressLabel: () => t('Tip'),
  },
  {
    selector: '[data-tuto="workout-finish"]',
    title: () => t('Finishing the session'),
    text: () => t('Tap <b>Finish</b> to save the workout. The app calculates total volume, PRs, and updates your stats automatically.'),
  },
]

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
    text: () => t('Track changes in chest, waist, arm, thigh and calf over time. Each zone has its own colour for easy reading.'),
    bonus: true,
    progressLabel: () => t('Tip'),
  },
]

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
  },
  {
    selector: '[data-tuto="bw-history"]',
    title: () => t('History & measurements'),
    text: () => t('Tap any past entry to delete it. Below is a summary of your latest body measurements — tap to add a new set.'),
  },
]

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

export const PLAN_STEPS = [
  {
    selector: '[data-tuto="plan-week"]',
    title: () => t('Weekly plan'),
    text: () => t('Assign a routine to each day of the week. Leave a day empty for rest. You can reassign any day without losing logged workouts.'),
  },
  {
    selector: '[data-tuto="plan-routines"]',
    title: () => t('Your routines'),
    text: () => t('Each routine is a named workout template with a fixed list of exercises. Tap to edit exercises, order, and set targets.'),
  },
  {
    selector: '[data-tuto="plan-programmes"]',
    title: () => t('Training programmes'),
    text: () => t('A programme is a multi-week plan that rotates routines automatically. Great for progressive overload phases like PPL, 5/3/1, or hypertrophy blocks.'),
    bonus: true,
    progressLabel: () => t('Tip'),
  },
]

export const NUTRITION_STEPS = [
  {
    selector: '[data-tuto="nutri-profile"]',
    title: () => t('Nutrition profile'),
    text: () => t('Enter your stats to calculate your TDEE (total daily energy expenditure). The app uses this to set your calorie target based on your goal.'),
  },
  {
    selector: '[data-tuto="nutri-today"]',
    title: () => t("Today's intake"),
    text: () => t('Search for foods or enter them manually. Each entry shows calories, protein, carbs, and fat. The ring fills as you approach your daily target.'),
  },
  {
    selector: '[data-tuto="nutri-week"]',
    title: () => t('Weekly view'),
    text: () => t('See your average daily intake vs. target over the last 7 days. Consistency matters more than hitting the exact number every day.'),
  },
]
