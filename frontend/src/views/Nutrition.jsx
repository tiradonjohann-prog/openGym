import { useState } from 'react'
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
import { NUTRITION_STEPS } from '../lib/tutorials.js'

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

  return (
    <div className="narrow">
      <div className="hdr">
        <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}>
          <Icon name="chevronLeft" />
        </button>
        <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Nutrition')}</h1></div>
        <TutorialButton steps={NUTRITION_STEPS} />
      </div>

      {/* Sub-navigation */}
      <nav className="nut-nav" aria-label={t('Nutrition sections')}>
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

      {/* Tab content */}
      <div key={tab} style={{ animation: 'viewfade var(--med) var(--ease) both' }}>
        {tab === 'today'   && <><DayView /><CardioSection /></>}
        {tab === 'week'    && <WeekView />}
        {tab === 'balance' && <DayBalance />}
        {tab === 'foods'   && <FoodsView />}
        {tab === 'profile' && <Profile />}
      </div>
    </div>
  )
}
