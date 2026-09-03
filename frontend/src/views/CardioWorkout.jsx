import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { fmtNum, todayISO, uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { beep, vibrate } from '../lib/sound.js'
import { SPORTS, BLOCK_TYPES, INTENSITIES, isCardioSport, estimateBlockKcal } from '../lib/sports.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

function fmtSec(sec) {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
}

function blockStartSec(block) {
  if (!block) return 0
  return block.type === 'interval' ? (block.workSec || 60) : (block.duration || 0) * 60
}

export default function CardioWorkout() {
  const nav = useNavigate()
  const A = useStore(s => s.S.active)
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)

  // Guard: must be a cardio active session
  if (!A || !isCardioSport(A.sport)) return <Navigate to="/home" replace />

  const blocks = A.blocks || []
  const sport = A.sport
  const bw = A.bw

  // ── timer state (using refs to avoid stale closures in interval callbacks) ──
  const [displaySec, setDisplaySec] = useState(0)
  const [blockIdx, setBlockIdx] = useState(0)
  const [repIdx, setRepIdx] = useState(1)
  const [iPhase, setIPhase] = useState('work') // 'work' | 'rest'
  const [phase, setPhase] = useState('intro')  // 'intro' | 'running' | 'paused' | 'done'

  // Done screen state
  const [distKm, setDistKm] = useState('')
  const [kcalInput, setKcalInput] = useState('')
  const [notes, setNotes] = useState('')

  const currentSecRef = useRef(0)
  const blockIdxRef = useRef(0)
  const repIdxRef = useRef(1)
  const iPhaseRef = useRef('work')
  const timerRef = useRef(null)

  const snd = () => S.sound !== false

  const setBlockIdxAll = v => { blockIdxRef.current = v; setBlockIdx(v) }
  const setRepIdxAll   = v => { repIdxRef.current = v;   setRepIdx(v) }
  const setIPhaseAll   = v => { iPhaseRef.current = v;   setIPhase(v) }

  // Cleanup on unmount
  useEffect(() => () => { clearInterval(timerRef.current) }, [])

  const runInterval = () => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      currentSecRef.current -= 1
      setDisplaySec(currentSecRef.current)
      if (currentSecRef.current <= 0) {
        clearInterval(timerRef.current)
        advance()
      }
    }, 1000)
  }

  const startCountdown = (sec) => {
    currentSecRef.current = sec
    setDisplaySec(sec)
    runInterval()
  }

  const advance = () => {
    const block = blocks[blockIdxRef.current]
    if (!block) { finishWorkout(); return }

    if (block.type === 'interval') {
      const maxRep = block.repeat || 1
      const hasRest = (block.restSec || 0) > 0
      if (iPhaseRef.current === 'work' && hasRest) {
        setIPhaseAll('rest')
        if (snd()) beep()
        vibrate([100])
        startCountdown(block.restSec || 90)
      } else {
        if (repIdxRef.current < maxRep) {
          setRepIdxAll(repIdxRef.current + 1)
          setIPhaseAll('work')
          if (snd()) beep()
          vibrate([100])
          startCountdown(block.workSec || 60)
        } else {
          goToNextBlock()
        }
      }
    } else {
      goToNextBlock()
    }
  }

  const goToNextBlock = () => {
    const next = blockIdxRef.current + 1
    if (next >= blocks.length) {
      finishWorkout()
      return
    }
    setBlockIdxAll(next)
    setRepIdxAll(1)
    setIPhaseAll('work')
    if (snd()) { beep(); setTimeout(beep, 300) }
    vibrate([100, 50, 100])
    startCountdown(blockStartSec(blocks[next]))
  }

  const finishWorkout = () => {
    clearInterval(timerRef.current)
    if (snd()) { beep(); setTimeout(beep, 250); setTimeout(beep, 500) }
    vibrate([200, 100, 200])
    setPhase('done')
  }

  const startWorkout = () => {
    const first = blocks[0]
    if (!first) { finishWorkout(); return }
    setBlockIdxAll(0)
    setRepIdxAll(1)
    setIPhaseAll('work')
    setPhase('running')
    startCountdown(blockStartSec(first))
    if (snd()) beep()
  }

  const pause = () => {
    clearInterval(timerRef.current)
    setPhase('paused')
  }

  const resume = () => {
    setPhase('running')
    runInterval()
  }

  const skip = () => {
    clearInterval(timerRef.current)
    goToNextBlock()
    setPhase('running')
  }

  const estimatedKcal = useMemo(() => {
    if (!bw) return 0
    return blocks.reduce((sum, b) => {
      const k = estimateBlockKcal(b, sport, bw)
      return sum + (k || 0)
    }, 0)
  }, [blocks, sport, bw])

  const saveWorkout = () => {
    const dist = parseFloat(distKm) || null
    const kcal = parseInt(kcalInput) || estimatedKcal || null
    update(s => {
      s.workouts.push({
        id: uid(),
        d: todayISO(),
        name: A.name,
        routineId: A.routineId,
        sport: A.sport,
        bw: A.bw,
        start: A.start,
        end: Date.now(),
        duration: Math.round((Date.now() - A.start) / 60000),
        distKm: dist,
        kcal,
        notes: notes.trim() || undefined,
        entries: [],
      })
      s.active = null
    })
    nav('/home')
  }

  const discard = () => {
    clearInterval(timerRef.current)
    update(s => { s.active = null })
    nav('/home')
  }

  // ── current block metadata ──
  const currentBlock = blocks[blockIdx] || null
  const bt = currentBlock ? (BLOCK_TYPES[currentBlock.type] || {}) : {}
  const intensity = currentBlock ? (
    currentBlock.type === 'interval'
      ? (iPhase === 'work' ? (currentBlock.workIntensity || 4) : (currentBlock.restIntensity || 2))
      : (currentBlock.intensity || 3)
  ) : 3
  const intensityInfo = INTENSITIES[intensity - 1] || INTENSITIES[2]
  const sportInfo = SPORTS[sport] || {}

  const totalBlockSec = currentBlock ? (
    currentBlock.type === 'interval'
      ? (iPhase === 'work' ? (currentBlock.workSec || 60) : (currentBlock.restSec || 90))
      : (currentBlock.duration || 0) * 60
  ) : 1
  const progress = totalBlockSec > 0 ? 1 - displaySec / totalBlockSec : 1

  const elapsedMin = A.start ? Math.floor((Date.now() - A.start) / 60000) : 0

  /* ── Intro screen ── */
  if (phase === 'intro') {
    return (
      <div className="narrow" style={{ textAlign: 'center', paddingTop: 32 }}>
        <div className="hdr" style={{ justifyContent: 'space-between' }}>
          <button className="iconbtn" onClick={discard}><Icon name="xmark" /></button>
          <div style={{ fontWeight: 600 }}>{A.name}</div>
          <div style={{ width: 32 }} />
        </div>

        <div style={{ marginTop: 40, marginBottom: 32 }}>
          <div style={{ width: 96, height: 96, borderRadius: 28, background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, margin: '0 auto 20px' }}>
            <Icon name={sportInfo.icon || 'bolt'} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 6 }}>{A.name}</div>
          <div className="muted">{t(sportInfo.label || sport)} · {blocks.length} {t('blocks')}</div>
          {bw && <div className="dim small" style={{ marginTop: 4 }}>~{estimatedKcal} kcal {t('estimated')}</div>}
        </div>

        <div className="card" style={{ textAlign: 'left', marginBottom: 16 }}>
          {blocks.map((b, i) => {
            const bbt = BLOCK_TYPES[b.type] || {}
            return (
              <div key={b.id || i} className="row" style={{ gap: 10, padding: '8px 0', borderBottom: i < blocks.length - 1 ? '1px solid var(--sep)' : 'none' }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: bbt.color || 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flex: 'none', color: bbt.color ? '#fff' : 'var(--label)' }}>
                  <Icon name={bbt.icon || 'bolt'} />
                </span>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{t(bbt.label || b.type)}</div>
                  <div className="dim" style={{ fontSize: 12 }}>
                    {b.type === 'interval' ? `${b.repeat || 1}× ${b.workSec || 60}s / ${b.restSec || 90}s` : `${b.duration || 0} min`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <Button variant="primary" style={{ width: '100%', padding: '15px', fontSize: 18 }} onClick={startWorkout}>
          {t('Start')}
        </Button>
      </div>
    )
  }

  /* ── Done screen ── */
  if (phase === 'done') {
    return (
      <div className="narrow">
        <div className="hdr">
          <div style={{ fontWeight: 600 }}>{t('Workout done!')}</div>
        </div>

        <div className="card" style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 52 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{A.name}</div>
          <div className="muted">{elapsedMin} min · {t(sportInfo.label || sport)}</div>
        </div>

        <div className="card">
          {sportInfo.hasDistance && (
            <div style={{ marginBottom: 14 }}>
              <div className="small dim" style={{ marginBottom: 6 }}>{t('Distance (km)')}</div>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                placeholder="0.0"
                value={distKm}
                onChange={e => setDistKm(e.target.value)}
              />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div className="small dim" style={{ marginBottom: 6 }}>
              {t('Calories burned')}
              {estimatedKcal > 0 && <span className="muted"> ({t('estimated')}: ~{estimatedKcal} kcal)</span>}
            </div>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder={estimatedKcal > 0 ? String(estimatedKcal) : '0'}
              value={kcalInput}
              onChange={e => setKcalInput(e.target.value)}
            />
          </div>

          <div>
            <div className="small dim" style={{ marginBottom: 6 }}>{t('Notes (optional)')}</div>
            <input
              className="input"
              type="text"
              placeholder={t('How did it feel?')}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <Button variant="primary" style={{ width: '100%', marginBottom: 8 }} onClick={saveWorkout}>{t('Save workout')}</Button>
        <Button variant="ghost" className="dim" onClick={discard}>{t('Discard')}</Button>
      </div>
    )
  }

  /* ── Active / paused screen ── */
  const blockColor = bt.color || 'var(--acc)'

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <div className="hdr" style={{ padding: '12px 16px', flexShrink: 0 }}>
        <button className="iconbtn" onClick={discard}><Icon name="xmark" /></button>
        <div style={{ fontWeight: 600 }}>{A.name}</div>
        <div className="dim small">{fmtSec(elapsedMin * 60)} {t('elapsed')}</div>
      </div>

      {/* Block progress dots */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: '4px 16px', flexShrink: 0 }}>
        {blocks.map((_, i) => (
          <div key={i} style={{
            height: 4, flex: 1, maxWidth: 40, borderRadius: 2,
            background: i < blockIdx ? 'var(--acc)' : i === blockIdx ? blockColor : 'var(--surface-3)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', gap: 20 }}>

        {/* Block type badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, background: blockColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff' }}>
            <Icon name={bt.icon || 'bolt'} />
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{t(bt.label || currentBlock?.type || '')}</div>
            {currentBlock?.type === 'interval' && (
              <div className="muted small">
                {t('Rep')} {repIdx}/{currentBlock.repeat || 1} · {iPhase === 'work' ? t('Work') : t('Rest')}
              </div>
            )}
          </div>
        </div>

        {/* Giant timer */}
        <div style={{
          fontSize: 'clamp(72px, 20vw, 110px)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          color: phase === 'paused' ? 'var(--label-3)' : 'var(--label)',
          lineHeight: 1,
        }}>
          {fmtSec(displaySec)}
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', maxWidth: 300, height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            width: `${Math.max(0, Math.min(100, progress * 100))}%`,
            height: '100%',
            background: blockColor,
            borderRadius: 3,
            transition: 'width 1s linear',
          }} />
        </div>

        {/* Intensity badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 20,
          background: `color-mix(in srgb,${intensityInfo.color} 13%,transparent)`,
          color: intensityInfo.color,
          fontWeight: 600, fontSize: 14,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: intensityInfo.color, display: 'inline-block' }} />
          {t(intensityInfo.label)}
        </div>

        {/* Next block hint */}
        {blockIdx + 1 < blocks.length && (
          <div className="dim small" style={{ textAlign: 'center' }}>
            {t('Next')}: {t(BLOCK_TYPES[blocks[blockIdx + 1]?.type]?.label || '')}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: '16px 24px 32px', display: 'flex', gap: 12, flexShrink: 0 }}>
        {phase === 'running' ? (
          <>
            <Button
              style={{ flex: 1, padding: '14px', fontSize: 17 }}
              onClick={pause}
              icon="pause"
            >
              {t('Pause')}
            </Button>
            <Button
              style={{ flex: 1, padding: '14px', fontSize: 17 }}
              onClick={skip}
            >
              {t('Skip')} →
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              style={{ flex: 1, padding: '14px', fontSize: 17 }}
              onClick={resume}
              icon="play"
            >
              {t('Resume')}
            </Button>
            <Button
              variant="danger"
              style={{ padding: '14px 18px', fontSize: 17 }}
              onClick={discard}
            >
              {t('Stop')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
