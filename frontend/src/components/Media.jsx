import { useState, useRef } from 'react'
import { imgSrc, gifSrc, swVideoSrc } from '../lib/exercises.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

// Plays SmartWorkout MP4 or falls back to the GIF animation.
// Tap toggles pause/play (video) or animation/still (GIF).
// `compact` shrinks it for superset cards.
// `minimizable` adds a persistent minimize/expand button (workout view, issue #12).
export default function Media({ ex, id, compact, minimizable }) {
  const videoUrl = swVideoSrc(ex.id)
  const [mode, setMode] = useState(videoUrl ? 'video' : 'gif')
  const [playing, setPlaying] = useState(true)
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)
  const videoRef = useRef(null)

  if (!ex.gif && !videoUrl) return null

  const mini = minimizable && gifSize === 'mini'
  const toggleSize = e => { e.stopPropagation(); update(s => { s.gifSize = mini ? 'full' : 'mini' }) }

  const togglePlay = () => {
    if (mode === 'video' && videoRef.current) {
      if (videoRef.current.paused) { videoRef.current.play(); setPlaying(true) }
      else { videoRef.current.pause(); setPlaying(false) }
    } else {
      setPlaying(p => !p)
    }
  }

  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '')} id={id} onClick={togglePlay}>
      {mode === 'video' ? (
        <video
          ref={videoRef}
          key={videoUrl}
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          style={{ width: '100%', display: 'block', borderRadius: 'inherit' }}
          onError={() => setMode('gif')}
        />
      ) : (
        ex.gif && <img decoding="async" src={playing ? gifSrc(ex) : imgSrc(ex)} alt={ex.n} />
      )}

      {/* GIF / VIDEO toggle — only shown when both are available */}
      {videoUrl && ex.gif && !mini && (
        <button
          className="giftoggle"
          onClick={e => { e.stopPropagation(); setMode(m => m === 'video' ? 'gif' : 'video') }}
          style={{ left: 8, right: 'auto' }}
        >
          {mode === 'video' ? 'GIF' : 'VIDEO'}
        </button>
      )}

      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}

      {!mini && (
        <span className="gifhint">
          <Icon name={playing ? 'pause' : 'play'} />
          {mode === 'video'
            ? (playing ? t('tap to pause') : t('tap to play'))
            : (playing ? t('tap to pause') : t('tap to play'))}
        </span>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  if (!ex.img) return <div className="thumb thumb-x"><Icon name="dumbbell" /></div>
  return <img className="thumb" loading="lazy" decoding="async" src={imgSrc(ex)} alt="" />
}
