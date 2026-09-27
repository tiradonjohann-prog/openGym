import { createPortal } from 'react-dom'
import { useRive, Layout, Fit, Alignment, RuntimeLoader } from '@rive-app/react-webgl2'

// By default the Rive runtime fetches its ~2.2MB WASM binary from unpkg.com
// at runtime — a third-party CDN dependency the app doesn't otherwise have,
// uncacheable by our own-origin-only service worker (public/sw.js), and
// unusable offline in the Capacitor builds. Self-host it instead, from a
// static copy of node_modules/@rive-app/webgl2/rive.wasm in public/rive/.
// Must run before the first useRive() call below.
RuntimeLoader.setWasmUrl('/rive/rive.wasm')

// Rive animation shown for a fixed duration while the 3D screen opens —
// AnatomyView owns the 5s timer, this component just plays. Sized via the
// .anatomy-intro class (index.css) to match the app's own content column
// rather than the raw viewport, centered above everything except the tab
// bar (#tabbar is z-index:50, this is 40).
//
// Portaled to document.body rather than rendered in place: #app plays a
// transform animation on every route mount (.vfade), and a CSS transform on
// an ancestor makes that ancestor the containing block for any
// position:fixed descendant. On this route #app itself collapses to near
// -zero height (its only in-flow content is .anatomy-view, which is
// position:absolute and so contributes nothing to #app's own box), so for
// the ~220ms .vfade runs, this element's top:50%/max-height would resolve
// against that collapsed box instead of the real viewport. Portaling
// escapes #app entirely, so sizing is always against the viewport.
export default function LoadingIntro() {
  const { RiveComponent } = useRive({
    src: '/animations/gym.riv',
    autoplay: true,
    layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
  })

  return createPortal(
    <div className="anatomy-intro">
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>,
    document.body,
  )
}
