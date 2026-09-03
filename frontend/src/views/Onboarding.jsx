import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { loadStarterPlan } from '../sheets.jsx'

export default function Onboarding() {
  const update = useStore(s => s.update)
  const [name, setName] = useState('')

  const finish = (loadPlan) => {
    update(s => {
      s.displayName = name.trim() || null
      s.onboardingDone = true
    })
    if (loadPlan) loadStarterPlan()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* scrollable content */}
      <div className="narrow" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 120, paddingTop: 40, overflowY: 'auto' }}>

        {/* icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 22, fontSize: 32,
            background: 'color-mix(in srgb,var(--acc) 16%,transparent)',
            color: 'var(--acc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'badgePop .38s var(--ease)',
          }}>
            <Icon name="sparkles" />
          </div>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.024em', lineHeight: 1.15, textAlign: 'center', marginBottom: 6 }}>
          {name.trim() ? t('Hi {0}!', name.trim()) : t('Welcome to openGym!')}
        </h1>
        <div className="muted small" style={{ textAlign: 'center', marginBottom: 32, lineHeight: 1.5 }}>
          {t('Your personal fitness tracker — built for consistency.')}
        </div>

        {/* name input */}
        <div style={{ marginBottom: 8 }}>
          <div className="small muted" style={{ marginBottom: 6, fontWeight: 500 }}>{t('What should we call you?')}</div>
          <input
            className="input"
            autoFocus
            placeholder={t('Your first name or nickname')}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) finish(true) }}
            style={{ fontSize: 18, padding: '14px 18px', borderRadius: 14, width: '100%', boxSizing: 'border-box' }}
          />
          <div className="muted small" style={{ marginTop: 6, lineHeight: 1.4 }}>
            {t('Optional — shown in your greeting.')}
          </div>
        </div>
      </div>

      {/* fixed bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 560,
        padding: '12px 16px 28px',
        background: 'linear-gradient(to top, var(--bg) 75%, transparent)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <Button variant="primary" style={{ width: '100%', padding: 15, fontSize: 16 }} icon="sparkles"
          onClick={() => finish(true)}>
          {t("Let's go! Load starter plan")}
        </Button>
        <Button style={{ width: '100%', padding: 12, fontSize: 15 }} onClick={() => finish(false)}>
          {t("Skip — I'll build my plan manually")}
        </Button>
      </div>
    </div>
  )
}
