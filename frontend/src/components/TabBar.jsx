import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine } from '../lib/history.js'
import { activeProgramme, nextSession } from '../lib/programme.js'
import { isCardioSport } from '../lib/sports.js'
import { startFlowForProgramme, pauseWorkout, resumeWorkout, confirmStartSheet } from '../sheets.jsx'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

// Warms the 3D screen's lazy JS chunk AND its two runtime-fetched assets
// (Rive's wasm engine, the .riv animation itself) on pointerdown — before
// the click/navigation even lands — so LoadingIntro's useRive() call
// resolves from an already-warm browser cache instead of starting three
// cold network fetches after the route has already mounted. Guarded so a
// second tap doesn't re-issue the same requests.
let anatomyPrefetched = false
function prefetchAnatomy() {
  if (anatomyPrefetched) return
  anatomyPrefetched = true
  import('../views/AnatomyView.jsx')
  fetch('/rive/rive.wasm')
  fetch('/animations/gym.riv')
}

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (cur === 'history' && k === 'stats') || (cur === 'settings' && k === 'home')

  const startWorkout = () => {
    if (S.active) {
      if (S.active.pausedAt) {
        resumeWorkout()
        nav(isCardioSport(S.active.sport) ? '/cardio' : '/workout')
      } else {
        pauseWorkout()
      }
      return
    }
    const prog = activeProgramme(S)
    const ns = prog && nextSession(prog, S.routines)
    if (ns && ns.routine) { confirmStartSheet(ns.routine, () => startFlowForProgramme(prog.id, ns.weekNum, ns.sessionIdx)); return }
    const r = effectiveRoutine(S, todayISO())
    if (r && r.ex.length) { confirmStartSheet(r, () => onStart(r.id)); return }
    nav('/workout')
  }
  const Tab = ({ k, icon, to, label, onPointerDown }) => {
    const active = on(k)
    return (
      <button className={active ? 'on' : ''} onPointerDown={onPointerDown} onClick={() => nav(to)}>
        {active
          ? <span className="tab-pill"><Icon name={icon} /><span>{label}</span></span>
          : <><Icon name={icon} /><span>{label}</span></>}
      </button>
    )
  }

  return (
    <nav id="tabbar">
      <Tab k="home" icon="house" to="/home" label={t('Home')} />
      <Tab k="plan" icon="calendar" to="/plan" label={t('Plan')} />
      <Tab
        k="anatomy" icon="cube" to="/anatomy" label={t('3D')}
        onPointerDown={prefetchAnatomy}
      />
      <button
        className={'start' + (S.active ? ' rec' : '')}
        onClick={startWorkout}
        aria-label={S.active ? (S.active.pausedAt ? t('Reprendre') : t('Pause')) : t('Start')}
      >
        <span className="cir"><Icon name={S.active ? (S.active.pausedAt ? 'play' : 'pause') : 'dumbbell'} /></span>
        <span className="lbl">{S.active ? (S.active.pausedAt ? t('Reprendre') : t('Pause')) : t('Start')}</span>
      </button>
      <Tab k="stats" icon="chart" to="/stats" label={t('Stats')} />
      <Tab k="library" icon="list" to="/library" label={t('Exercises')} />
      <Tab k="nutrition" icon="utensils" to="/nutrition" label={t('Nutrition')} />
    </nav>
  )
}
