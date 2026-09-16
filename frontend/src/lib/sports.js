// Multi-sport support for routines and cardio workout sessions.
// MET values from Ainsworth et al. 2011 (same source as cardio.js).
// Formula: kcal = MET × weightKg × durationHours

import { uid } from './format.js'
import { t } from './i18n.js'

export const SPORTS = {
  strength: { label: 'Strength training', icon: 'dumbbell',  cardio: false },
  run:      { label: 'Running',           icon: 'figureRun', cardio: true, hasDistance: true,  hasElevation: true  },
  walk:     { label: 'Walking',           icon: 'person',    cardio: true, hasDistance: true,  hasElevation: true  },
  bike:     { label: 'Cycling',           icon: 'bike',      cardio: true, hasDistance: true,  hasElevation: true  },
  swim:     { label: 'Swimming',          icon: 'swim',      cardio: true, hasDistance: true,  hasElevation: false },
  aqua:     { label: 'Aqua aerobics',     icon: 'bolt',      cardio: true, hasDistance: false, hasElevation: false },
}

export const INTENSITIES = [
  { level: 1, label: 'Very easy', pct: 40, color: 'var(--teal)'   },
  { level: 2, label: 'Easy',      pct: 55, color: 'var(--blue)'   },
  { level: 3, label: 'Moderate',  pct: 70, color: 'var(--yellow)' },
  { level: 4, label: 'Hard',      pct: 83, color: 'var(--orange)' },
  { level: 5, label: 'Maximal',   pct: 95, color: 'var(--red)'    },
]

export const BLOCK_TYPES = {
  warmup:   { label: 'Warm-up',     icon: 'sun',     color: 'var(--teal)'   },
  steady:   { label: 'Steady pace', icon: 'bolt',    color: 'var(--blue)'   },
  interval: { label: 'Intervals',   icon: 'shuffle', color: 'var(--orange)' },
  cooldown: { label: 'Cool-down',   icon: 'moon',    color: 'var(--indigo)' },
}

// MET values indexed by intensity level 1-5
const MET_TABLE = {
  run:  [5.0, 7.0,  9.0, 11.0, 13.5],
  walk: [2.5, 3.5,  4.5,  5.5,  6.5],
  bike: [4.0, 5.0,  7.0, 10.0, 12.0],
  swim: [4.5, 6.0,  7.5,  9.0, 11.0],
  aqua: [3.5, 4.5,  5.5,  6.5,  7.5],
}

function metFor(sport, intensity) {
  const tbl = MET_TABLE[sport]
  return tbl ? tbl[Math.max(0, Math.min(4, (intensity || 3) - 1))] : null
}

export function isCardioSport(sport) {
  return SPORTS[sport]?.cardio === true
}

export function blockDurationMin(block) {
  if (block.type === 'interval') {
    const repeat = block.repeat || 1
    return Math.ceil(repeat * ((block.workSec || 60) + (block.restSec || 90)) / 60)
  }
  return block.duration || 0
}

export function routineTotalDuration(blocks) {
  return (blocks || []).reduce((s, b) => s + blockDurationMin(b), 0)
}

export function estimateBlockKcal(block, sport, weightKg) {
  if (!weightKg) return null
  if (block.type === 'interval') {
    const workSec = (block.repeat || 1) * (block.workSec || 60)
    const restSec = (block.repeat || 1) * (block.restSec || 90)
    const wMET = metFor(sport, block.workIntensity || 4)
    const rMET = metFor(sport, block.restIntensity || 2)
    if (!wMET || !rMET) return null
    return Math.round((wMET * workSec / 3600 + rMET * restSec / 3600) * weightKg)
  }
  const met = metFor(sport, block.intensity || 3)
  if (!met) return null
  return Math.round(met * weightKg * (block.duration || 0) / 60)
}

export function blockSummary(block) {
  switch (block.type) {
    case 'warmup':
    case 'cooldown': {
      const intLabel = t(INTENSITIES[(block.intensity || 1) - 1]?.label || 'Very easy')
      return `${block.duration ?? 0} min · ${intLabel}`
    }
    case 'steady': {
      const parts = [`${block.duration ?? 0} min`]
      if (block.distKm) parts.push(block.distKm + ' km')
      if (block.intensity) parts.push(t(INTENSITIES[(block.intensity || 3) - 1]?.label || ''))
      return parts.filter(Boolean).join(' · ')
    }
    case 'interval': {
      const workLabel = (block.workSec || 60) >= 60
        ? (block.workSec / 60) + ' min'
        : (block.workSec || 60) + ' s'
      const restLabel = (block.restSec || 90) >= 60
        ? (block.restSec / 60) + ' min'
        : (block.restSec || 90) + ' s'
      return `${block.repeat || 1}× ${workLabel} / ${restLabel} ${t('rest')}`
    }
    default: return ''
  }
}

export function defaultCardioBlocks(sport) {
  if (sport === 'swim' || sport === 'aqua') {
    return [
      { id: uid(), type: 'warmup',   duration: 5,  intensity: 1 },
      { id: uid(), type: 'steady',   duration: 25, intensity: 3, distKm: null },
      { id: uid(), type: 'cooldown', duration: 5,  intensity: 1 },
    ]
  }
  return [
    { id: uid(), type: 'warmup',   duration: 10, intensity: 1 },
    { id: uid(), type: 'steady',   duration: 20, intensity: 3, distKm: null, targetPace: null },
    { id: uid(), type: 'cooldown', duration: 5,  intensity: 1 },
  ]
}

export function isHybrid(r) {
  return Array.isArray(r?.items)
}

export function hybridExItems(r) {
  return (r.items || []).filter(x => x.kind === 'ex')
}
