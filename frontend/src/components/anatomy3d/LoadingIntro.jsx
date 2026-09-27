import { useRive, Layout, Fit, Alignment } from '@rive-app/react-webgl2'

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
