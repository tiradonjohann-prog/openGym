// @vitest-environment jsdom
//
// This file is the first in the project to need a real `document` global at
// import time: AnatomyView.jsx transitively imports store/useStore.js, which
// wires a `document.addEventListener('visibilitychange', ...)` at module
// scope. Every other test file here runs fine under vitest's default 'node'
// environment (see src/lib/wakelock.test.js, which fakes `document` by hand
// because its target module only touches it lazily, inside function calls).
// AnatomyView's chain touches it eagerly on import, before any vi.spyOn or
// manual fake could run, so a real DOM environment is required for this file.
import { describe, it, expect, vi } from 'vitest'
import { hasWebGL } from './AnatomyView.jsx'

describe('hasWebGL', () => {
  it('returns true when the canvas reports a webgl2 context', () => {
    const fakeCanvas = { getContext: vi.fn(ctx => (ctx === 'webgl2' ? {} : null)) }
    vi.spyOn(document, 'createElement').mockReturnValue(fakeCanvas)
    expect(hasWebGL()).toBe(true)
    document.createElement.mockRestore()
  })

  it('returns false when neither webgl2 nor webgl is available', () => {
    const fakeCanvas = { getContext: vi.fn(() => null) }
    vi.spyOn(document, 'createElement').mockReturnValue(fakeCanvas)
    expect(hasWebGL()).toBe(false)
    document.createElement.mockRestore()
  })

  it('returns false instead of throwing if getContext itself throws', () => {
    const fakeCanvas = { getContext: vi.fn(() => { throw new Error('no GPU') }) }
    vi.spyOn(document, 'createElement').mockReturnValue(fakeCanvas)
    expect(hasWebGL()).toBe(false)
    document.createElement.mockRestore()
  })
})
