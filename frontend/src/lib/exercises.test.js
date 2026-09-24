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
