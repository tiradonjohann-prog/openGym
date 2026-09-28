import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import Profile     from './nutrition/Profile.jsx'
import DayView     from './nutrition/DayView.jsx'
import WeekView    from './nutrition/WeekView.jsx'
import DayBalance  from './nutrition/DayBalance.jsx'
import CardioSection from './nutrition/CardioEntry.jsx'
import FoodsView  from './nutrition/FoodsView.jsx'
import { TutorialButton } from '../components/TutorialOverlay.jsx'
import { nutritionSteps } from '../lib/tutorials.js'

const TABS = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'Week' },
  { key: 'balance', label: 'Balance' },
  { key: 'foods',   label: 'Foods' },
  { key: 'profile', label: 'Profile' },
]

export default function Nutrition() {
  const nav = useNavigate()
  const [tab, setTab] = useState('today')
  const navRef = useRef(null)
  const [scroll, setScroll] = useState({ active: 0, scrollable: false })

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth
      if (max <= 2) { setScroll({ active: 0, scrollable: false }); return }
      const pct = el.scrollLeft / max
      setScroll({ active: Math.round(pct * (TABS.length - 1)), scrollable: true })
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])

  return (
    <div className="narrow">
      <div className="hdr">
        <button className="iconbtn" onClick={() => window.history.state?.idx > 0 ? nav(-1) : nav('/home', { replace: true })} aria-label={t('Home')}>
          <Icon name="chevronLeft" />
        </button>
        <div style={{ flex: 1, marginLeft: 10 }}><h1 className="font-display">{t('Nutrition')}</h1></div>
        <TutorialButton steps={nutritionSteps(setTab)} />
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
      </div>

      {/* Sub-navigation */}
      <nav className="nut-nav" ref={navRef} data-tuto="nutri-nav" aria-label={t('Nutrition sections')}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            className={tab === key ? 'on' : ''}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setTab(key)}
          >
            {t(label)}
          </button>
        ))}
      </nav>
      {scroll.scrollable && (
        <div className="nut-nav-dots" aria-hidden="true">
          {TABS.map((_, i) => <span key={i} className={i === scroll.active ? 'on' : ''} />)}
        </div>
      )}

      {/* Tab content */}
      <div key={tab} data-tuto={'nutri-' + tab} style={{ animation: 'viewfade var(--med) var(--ease) both' }}>
        {tab === 'today'   && <><DayView /><CardioSection /></>}
        {tab === 'week'    && <WeekView />}
        {tab === 'balance' && <DayBalance />}
        {tab === 'foods'   && <FoodsView />}
        {tab === 'profile' && <Profile />}
      </div>
    </div>
  )
}
