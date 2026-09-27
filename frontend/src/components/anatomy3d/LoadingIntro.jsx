import { useRive } from '@rive-app/react-webgl2'

// Full-bleed Rive animation shown for a fixed duration while the 3D screen
// opens — AnatomyView owns the 5s timer, this component just plays.
export default function LoadingIntro() {
  const { RiveComponent } = useRive({
    src: '/animations/gym-workout-icons.riv',
    autoplay: true,
  })

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 3,
      background: '#131519', // matches the <Canvas> background — no flash when it unmounts
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 160, height: 160 }}>
        <RiveComponent />
      </div>
    </div>
  )
}
