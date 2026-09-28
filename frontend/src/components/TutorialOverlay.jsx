// Generic tutorial engine — single motor, declarative steps.
// Follows skill: tutoriel-guide-interactif — one engine, never duplicated.
// Spotlight via SVG mask (supports multi-spotlight without bounding-box collapse).
// Bubble positioning: tries below → right → left → above → best-available.

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'

const PAD = 12      // spotlight padding around target
const GAP = 16      // gap between spotlight edge and bubble
const MIN_H = 120   // fallback bubble height before the real one is measured
const BUBBLE_W = 268
const EDGE = 8      // minimum gap kept between the bubble and any screen edge

// Resolves a step's selector to the real DOM element(s) it targets — never
// just their rects — so the engine can scroll them into view itself before
// measuring. The user must never have to scroll during a tutorial: the
// tutorial moves the page, not the other way around.
function getElements(selector) {
  if (!selector) return []
  if (typeof selector === 'function') {
    const result = selector()
    if (!result) return []
    return Array.isArray(result) ? result.filter(Boolean) : [result]
  }
  if (typeof selector === 'string') {
    const el = document.querySelector(selector)
    return el ? [el] : []
  }
  if (selector && selector.getBoundingClientRect) return [selector]
  return []
}

// Scrolls just enough that every target rect sits inside the viewport
// (with a margin) — never fights a step that's already fully visible, and
// scrolls the whole page as one move rather than each element separately.
function scrollTargetsIntoView(elements) {
  if (!elements.length) return
  const vh = window.innerHeight
  const margin = 24
  const rects = elements.map(el => el.getBoundingClientRect())
  const top = Math.min(...rects.map(r => r.top))
  const bottom = Math.max(...rects.map(r => r.bottom))
  if (top >= margin && bottom <= vh - margin) return
  const center = (top + bottom) / 2
  window.scrollBy({ top: center - vh / 2, left: 0, behavior: 'auto' })
}

// bubbleH is the bubble's real measured height once known (MIN_H as a
// starting estimate before the first measurement lands) — using the actual
// height, not a nominal minimum, is what keeps the bubble from being cut
// off by the bottom of the screen when its text runs to several lines.
function bubblePos(rects, vw, vh, bubbleH) {
  // rects = array of spotlight rects (padded)
  const combined = {
    left:   Math.min(...rects.map(r => r.left)),
    top:    Math.min(...rects.map(r => r.top)),
    right:  Math.max(...rects.map(r => r.right)),
    bottom: Math.max(...rects.map(r => r.bottom)),
  }
  const candidates = [
    // below
    { dir: 'below', x: Math.max(EDGE, Math.min(vw - BUBBLE_W - EDGE, combined.left + (combined.right - combined.left) / 2 - BUBBLE_W / 2)), y: combined.bottom + GAP, space: vh - combined.bottom - GAP },
    // right
    { dir: 'right', x: combined.right + GAP, y: Math.max(EDGE, combined.top), space: vw - combined.right - GAP },
    // left
    { dir: 'left', x: combined.left - BUBBLE_W - GAP, y: Math.max(EDGE, combined.top), space: combined.left - GAP },
    // above
    { dir: 'above', x: Math.max(EDGE, Math.min(vw - BUBBLE_W - EDGE, combined.left + (combined.right - combined.left) / 2 - BUBBLE_W / 2)), y: combined.top - GAP - bubbleH, space: combined.top - GAP },
  ]
  const valid = candidates.filter(c => c.space >= bubbleH && c.x >= 0 && c.x + BUBBLE_W <= vw)
  const best = valid.length ? valid[0] : candidates.reduce((a, b) => a.space > b.space ? a : b)
  // Final safety net: whichever direction won, never let the bubble's own
  // box cross a screen edge — a direction can be "best available" while
  // still not having enough room for the full height.
  const x = Math.max(EDGE, Math.min(vw - BUBBLE_W - EDGE, best.x))
  const y = Math.max(EDGE, Math.min(vh - bubbleH - EDGE, best.y))
  return { x, y }
}

export default function TutorialOverlay({ steps, onEnd }) {
  const [idx, setIdx] = useState(0)
  const [pos, setPos] = useState(null)      // { x, y }
  const [spotRects, setSpotRects] = useState([])
  const bubbleRef = useRef(null)
  const rafRef = useRef(null)
  const bubbleHRef = useRef(MIN_H) // real measured bubble height, kept in a ref so reposition() always reads the latest without depending on it

  const step = steps[idx] || steps[0]
  const total = steps.filter(s => !s.bonus).length
  const mainIdx = steps.slice(0, idx + 1).filter(s => !s.bonus).length
  const isLast = idx === steps.length - 1
  const isFirst = idx === 0

  const reposition = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const vw = window.innerWidth, vh = window.innerHeight
      const step = steps[idx]
      if (!step) return
      let rects = []
      const els = step.selector ? getElements(step.selector) : []
      if (els.length) {
        // The tutorial moves the page to its target, never the other way
        // around — scroll before measuring so the frame is computed from
        // the element's post-scroll position, not a stale one.
        scrollTargetsIntoView(els)
        const toPad = el => {
          const r = el.getBoundingClientRect()
          return { left: r.left - PAD, top: r.top - PAD, right: r.right + PAD, bottom: r.bottom + PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD }
        }
        rects = step.multiSpotlight ? els.map(toPad) : [toPad(els[0])]
      }
      setSpotRects(rects)
      if (rects.length) {
        const bp = bubblePos(rects, vw, vh, bubbleHRef.current)
        setPos(bp)
      } else {
        // No target — center on screen, still clamped to the real height
        // so a long tip can't run off the bottom of a short viewport.
        setPos({ x: vw / 2 - BUBBLE_W / 2, y: Math.min(vh * 0.35, vh - bubbleHRef.current - EDGE) })
      }
    })
  }, [idx, steps])

  useEffect(() => {
    if (step?.ensure) step.ensure()
    reposition()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [idx, step, reposition])

  // Track the bubble's real rendered height (it varies with title/body
  // length) so bubblePos() can use it instead of a nominal minimum —
  // otherwise a multi-line step can still be tall enough to get clipped by
  // the bottom of the screen even though positioning "succeeded".
  useEffect(() => {
    const el = bubbleRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect.height
      if (h && Math.abs(h - bubbleHRef.current) > 1) {
        bubbleHRef.current = h
        reposition()
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [pos, reposition]) // re-attach if the bubble element identity ever changes

  useEffect(() => {
    const handler = () => reposition()
    window.addEventListener('resize', handler)
    // Safety net: if anything still manages to scroll the page (e.g. an
    // input gaining focus), resync the frame to it rather than let it drift.
    window.addEventListener('scroll', handler, { passive: true })
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('scroll', handler)
    }
  }, [reposition])

  // Lock scrolling while the tutorial is open — the tutorial moves the
  // screen to its target itself; the user must not be able to scroll away
  // from it and desync the frame from what it's supposed to highlight.
  // overflow:hidden on body alone doesn't stop touch-drag scrolling in
  // every mobile browser, so wheel/touchmove are also blocked at the event
  // level (except inside the bubble, should its content ever need to
  // scroll on its own) — this still lets the engine's own scrollBy calls
  // through, since those aren't user gesture events.
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const preventScroll = e => {
      if (bubbleRef.current && bubbleRef.current.contains(e.target)) return
      e.preventDefault()
    }
    window.addEventListener('wheel', preventScroll, { passive: false })
    window.addEventListener('touchmove', preventScroll, { passive: false })
    return () => {
      document.body.style.overflow = prevBodyOverflow
      window.removeEventListener('wheel', preventScroll)
      window.removeEventListener('touchmove', preventScroll)
    }
  }, [])

  const goNext = () => { if (isLast) { onEnd(); } else { setIdx(i => i + 1) } }
  const goPrev = () => { if (!isFirst) setIdx(i => i - 1) }
  const doEnd  = () => { onEnd() }

  const vw = window.innerWidth, vh = window.innerHeight

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      fontFamily: 'var(--font, system-ui)',
    }}>
      {/* SVG dimming layer with spotlight holes */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="tuto-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotRects.map((r, i) => (
              <rect key={i} x={r.left} y={r.top} width={r.width} height={r.height} rx="14" fill="black" />
            ))}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask="url(#tuto-mask)" />
      </svg>

      {/* Highlight frames — one per spotlight target, layered above dimming */}
      {spotRects.map((r, i) => (
        <div key={'frame' + i} style={{
          position: 'fixed',
          left: r.left, top: r.top,
          width: r.width, height: r.height,
          borderRadius: 14,
          border: '2px solid var(--acc)',
          boxShadow: '0 0 0 4px color-mix(in srgb,var(--acc) 22%,transparent), 0 0 28px color-mix(in srgb,var(--acc) 45%,transparent), inset 0 0 0 1px color-mix(in srgb,var(--acc) 14%,transparent)',
          pointerEvents: 'none',
          animation: 'tuto-pulse 2s ease-in-out infinite',
        }} />
      ))}

      {/* Corner brackets */}
      {spotRects.map((r, i) => {
        const x = r.left, y = r.top, w = r.width, h = r.height
        const sz = 14, sw = 2.5
        return (
          <svg key={'corner' + i} style={{ position: 'fixed', left: x - sw, top: y - sw, width: w + sw * 2, height: h + sw * 2, pointerEvents: 'none', overflow: 'visible' }}>
            <g stroke="var(--acc)" strokeWidth={sw} fill="none" strokeLinecap="round" opacity="0.9">
              <path d={`M ${sz},${sw} L ${sw},${sw} L ${sw},${sz + sw}`} />
              <path d={`M ${w + sw - sz},${sw} L ${w + sw},${sw} L ${w + sw},${sz + sw}`} />
              <path d={`M ${sw},${h + sw - sz} L ${sw},${h + sw} L ${sz + sw},${h + sw}`} />
              <path d={`M ${w + sw - sz},${h + sw} L ${w + sw},${h + sw} L ${w + sw},${h + sw - sz}`} />
            </g>
          </svg>
        )
      })}

      {/* Step badge on the highlighted frame — top-left corner */}
      {spotRects.length > 0 && pos && (
        <div style={{
          position: 'fixed',
          left: spotRects[0].left,
          top: spotRects[0].top - 26,
          background: 'var(--acc)',
          color: 'var(--on-acc)',
          borderRadius: '8px 8px 0 0',
          padding: '3px 10px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.04em',
          lineHeight: 1.4,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          boxShadow: '0 -2px 8px color-mix(in srgb,var(--acc) 40%,transparent)',
        }}>
          {step.bonus
            ? (step.progressLabel || t('Tip'))
            : `${mainIdx} / ${total}` + (step.title ? ` — ${typeof step.title === 'function' ? step.title() : step.title}` : '')}
        </div>
      )}

      {/* Instruction bubble */}
      {pos && (
        <div ref={bubbleRef} style={{
          position: 'absolute',
          left: pos.x, top: pos.y,
          width: BUBBLE_W,
          // Last-resort safety net for a viewport too short to fit the
          // bubble at all even when pinned to the top edge (EDGE): the
          // bubble scrolls internally rather than spilling off-screen.
          maxHeight: `calc(100vh - ${EDGE * 2}px)`,
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,.38), 0 2px 8px rgba(0,0,0,.22), 0 0 0 1px color-mix(in srgb,var(--acc) 18%,transparent)',
          border: '1px solid color-mix(in srgb,var(--acc) 22%,transparent)',
          padding: '14px 14px 12px',
          userSelect: 'none',
        }}>
          {/* Accent top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 14, right: 14, height: 2,
            background: 'var(--acc)', borderRadius: '0 0 4px 4px', opacity: 0.7,
          }} />

          {/* Header row: dots + close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 2 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {steps.map((s, i) => (
                <div key={i} style={{
                  width: i === idx ? 14 : s.bonus ? 4 : 5,
                  height: s.bonus ? 4 : 5,
                  borderRadius: 99,
                  background: i === idx ? 'var(--acc)' : i < idx ? 'color-mix(in srgb,var(--acc) 40%,var(--surface-3))' : 'var(--surface-3)',
                  transition: 'width .25s var(--ease), background .2s',
                }} />
              ))}
            </div>
            <button onClick={doEnd} style={{
              background: 'var(--surface-2)', border: 'none', cursor: 'pointer',
              color: 'var(--label-3)', padding: '3px 6px', lineHeight: 1, fontSize: 13,
              borderRadius: 7, display: 'flex', alignItems: 'center',
            }} aria-label={t('Close tutorial')}>
              <Icon name="xmark" />
            </button>
          </div>

          {/* Title */}
          {step.title && (
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--label)', lineHeight: 1.3, marginBottom: 7 }}>
              {typeof step.title === 'function' ? step.title() : step.title}
            </div>
          )}

          {/* Body */}
          {step.text && (
            <div style={{ fontSize: 13, color: 'var(--label-2)', lineHeight: 1.58, marginBottom: 12 }}
              dangerouslySetInnerHTML={{ __html: typeof step.text === 'function' ? step.text() : step.text }} />
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isFirst && (
              <button onClick={goPrev} style={{
                background: 'var(--surface-2)', border: 'none', borderRadius: 10, padding: '8px 13px',
                fontSize: 13, fontWeight: 500, color: 'var(--label-2)', cursor: 'pointer', lineHeight: 1,
              }}>
                ← {t('Prev')}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={goNext} style={{
              background: 'var(--acc)', border: 'none', borderRadius: 10, padding: '8px 16px',
              fontSize: 13, fontWeight: 700, color: 'var(--on-acc)', cursor: 'pointer', lineHeight: 1,
              boxShadow: '0 2px 10px color-mix(in srgb,var(--acc) 45%,transparent)',
            }}>
              {isLast ? t('Done') + ' ✓' : t('Next') + ' →'}
            </button>
          </div>

          {/* Skip link */}
          {!isLast && (
            <div style={{ textAlign: 'center', marginTop: 9 }}>
              <button onClick={doEnd} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'var(--label-4)', textDecoration: 'underline',
              }}>
                {t('Skip tutorial')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}

// Convenience trigger button — "Tutoriel" pill.
// onOpen/onClose let a screen switch into a "demo" rendering mode for the
// duration of the tutorial — e.g. showing sample data in an empty section
// so a step can actually illustrate what it describes — without ever
// touching the real, persisted app state.
export function TutorialButton({ steps, label, onOpen, onClose }) {
  const [active, setActive] = useState(false)
  if (!steps || !steps.length) return null
  return <>
    <button
      data-tutorial-btn
      className="chip"
      onClick={() => { setActive(true); onOpen?.() }}
      aria-label={label || t('Tutorial')}
      style={{
        border: '1.5px solid color-mix(in srgb,var(--acc) 30%,transparent)',
        color: 'var(--acc)', fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {label || t('Tutorial')}
    </button>
    {active && <TutorialOverlay steps={steps} onEnd={() => { setActive(false); onClose?.() }} />}
  </>
}
