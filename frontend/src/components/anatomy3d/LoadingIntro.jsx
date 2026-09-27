import { createPortal } from 'react-dom'
import { t } from '../../lib/i18n.js'

// Plain full-screen loading placeholder shown for a fixed duration while the
// 3D screen opens — AnatomyView owns the 5s timer, this component just
// renders. Replaces an earlier Rive-animation version: it kept producing a
// visible black/grey glitch before playing (traced to a real containing-
// block bug and fixed, but the user asked to drop the animation entirely
// rather than keep chasing render glitches) — a static overlay has nothing
// to load, fetch, or mis-size, so there is nothing left to glitch.
//
// Portaled to document.body: #app plays a transform animation on every
// route mount (.vfade), and a CSS transform on an ancestor becomes the
// containing block for position:fixed descendants. On this route #app's own
// box collapses to near-zero height (its only in-flow content,
// .anatomy-view, is position:absolute). Portaling escapes that entirely, so
// this always covers the true viewport from the very first paint.
export default function LoadingIntro({ bg }) {
  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40,
      background: bg, // matches the <Canvas> background for this theme — no flash when it unmounts
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="font-display" style={{ color: 'var(--label-3)', fontSize: 15 }}>{t('Loading in progress…')}</div>
    </div>,
    document.body,
  )
}
