// frontend/src/components/Media.jsx
import { useState, useRef } from 'react'
import { imgSrc, gifSrc, videoSrc, photoSrc } from '../lib/exercises.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

// Plays a SmartWorkout video, or falls back to a static photo, or (residual cardio
// exercises only) a GIF/still image. Tap toggles pause/play (video) or animation/still (GIF).
// `compact` shrinks it for superset cards.
// `minimizable` adds a persistent minimize/expand button (workout view, issue #12).
export default function Media({ ex, id, compact, minimizable }) {
  const videoUrl = videoSrc(ex)
  const photoUrl = photoSrc(ex)
  const [mode, setMode] = useState(videoUrl ? 'video' : 'gif')
  const [playing, setPlaying] = useState(true)
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)
  const videoRef = useRef(null)

  const hasGif = !!ex.gif
  if (!hasGif && !videoUrl && !photoUrl) return null

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
          onError={() => setMode(hasGif ? 'gif' : 'photo')}
        />
      ) : mode === 'gif' && hasGif ? (
        <img decoding="async" src={playing ? gifSrc(ex) : imgSrc(ex)} alt={ex.n} />
      ) : (
        photoUrl && <img decoding="async" src={photoUrl} alt={ex.n} />
      )}

      {/* GIF / VIDEO toggle — only shown when both are available (residual cardio) */}
      {videoUrl && hasGif && !mini && (
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

      {!mini && mode !== 'photo' && (
        <span className="gifhint">
          <Icon name={playing ? 'pause' : 'play'} />
          {playing ? t('tap to pause') : t('tap to play')}
        </span>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  if (ex.img) return <img className="thumb" loading="lazy" decoding="async" src={imgSrc(ex)} alt="" />
  const photo = photoSrc(ex)
  if (photo) return <img className="thumb" loading="lazy" decoding="async" src={photo} alt="" />
  // Exercises with only a video (e.g. the local-video fallback) and no
  // static image/gif otherwise showed a bare placeholder icon in the list.
  // Autoplaying it was unreliable (the browser paused it almost immediately
  // in a list of many videos), so instead seek to a representative frame
  // once metadata loads and leave it as a static "poster" — no play needed.
  const video = videoSrc(ex)
  if (video) {
    return (
      <video
        className="thumb"
        src={video}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={e => { e.currentTarget.currentTime = Math.min(1, (e.currentTarget.duration || 2) / 4) }}
      />
    )
  }
  return <div className="thumb thumb-x"><Icon name="dumbbell" /></div>
}
