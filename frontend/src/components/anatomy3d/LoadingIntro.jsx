import { useRive, Layout, Fit, Alignment, RuntimeLoader } from '@rive-app/react-webgl2'

// By default the Rive runtime fetches its ~2.2MB WASM binary from unpkg.com
// at runtime — a third-party CDN dependency the app doesn't otherwise have,
// uncacheable by our own-origin-only service worker (public/sw.js), and
// unusable offline in the Capacitor builds. Self-host it instead, from a
// static copy of node_modules/@rive-app/webgl2/rive.wasm in public/rive/.
// Must run before the first useRive() call below.
RuntimeLoader.setWasmUrl('/rive/rive.wasm')

// Full-screen Rive animation shown for a fixed duration while the 3D screen
// opens — AnatomyView owns the 5s timer, this component just plays.
// position:fixed (not absolute inside .anatomy-canvas-wrap) so it covers the
// whole screen, including the header — everything except the tab bar, which
// sits on top at a higher z-index (#tabbar is z-index:50).
export default function LoadingIntro() {
  const { RiveComponent } = useRive({
    src: '/animations/gym.riv',
    autoplay: true,
    layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40,
      background: '#131519', // matches the <Canvas> background — no flash when it unmounts
    }}>
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
