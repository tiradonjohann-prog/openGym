import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { SasoianMark } from '../components/SasoianLogo.jsx'
import { loadStarterPlan } from '../sheets.jsx'

const FEATURES = [
  { icon: 'dumbbell', color: 'var(--acc)',    label: 'Smart progression', desc: 'Auto-increments weight, predicts your next set.' },
  { icon: 'chartLine', color: 'var(--blue)',  label: 'Track everything',  desc: 'PRs, volume, body weight, measurements, macros.' },
  { icon: 'flame',     color: 'var(--orange)', label: 'Stay consistent',  desc: 'Weekly streak, muscle balance heatmap, calendar.' },
]

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflowX: 'hidden' }}>
      {/* ambient glow behind logo */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 320, height: 320,
        background: 'radial-gradient(ellipse at center, color-mix(in srgb,var(--acc) 12%,transparent) 0%, transparent 72%)',
        pointerEvents: 'none',
      }} />

      {/* scrollable content */}
      <div className="narrow" style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 140, paddingTop: 60, overflowY: 'auto', position: 'relative' }}>

        {/* logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, animation: 'badgePop .45s var(--ease)' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: -12,
              background: 'radial-gradient(circle, color-mix(in srgb,var(--acc) 20%,transparent), transparent 70%)',
              borderRadius: '50%',
            }} />
            <SasoianMark size={76} />
          </div>
        </div>

        {/* headline */}
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.028em', lineHeight: 1.12, textAlign: 'center', marginBottom: 8 }}>
          {name.trim() ? t('Hi {0}! 👋', name.trim()) : t('Welcome to Sasoian!')}
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--label-2)', fontSize: 15, lineHeight: 1.5, marginBottom: 32 }}>
          {t('Your personal fitness tracker — built for consistency.')}
        </p>

        {/* feature rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {FEATURES.map(f => (
            <div key={f.icon} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: `linear-gradient(135deg,color-mix(in srgb,${f.color} 9%,var(--surface)),var(--surface))`,
              border: `1px solid color-mix(in srgb,${f.color} 16%,transparent)`,
              borderRadius: 14, padding: '12px 14px',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11,
                background: `color-mix(in srgb,${f.color} 18%,var(--surface-2))`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: f.color, fontSize: 18, flexShrink: 0,
              }}>
                <Icon name={f.icon} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-.01em' }}>{t(f.label)}</div>
                <div style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 2, lineHeight: 1.35 }}>{t(f.desc)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* name input */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-2)', marginBottom: 8, letterSpacing: '.01em' }}>
            {t('What should we call you?')}
          </div>
          <input
            className="input"
            autoFocus
            placeholder={t('Your first name or nickname')}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') finish(true) }}
            style={{ fontSize: 17, padding: '14px 16px', borderRadius: 14, width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: 12, color: 'var(--label-4)', marginTop: 6 }}>
            {t('Optional — shown in your greeting.')}
          </div>
        </div>
      </div>

      {/* fixed bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 560,
        padding: '16px 16px calc(16px + env(safe-area-inset-bottom,0px))',
        background: 'linear-gradient(to top, var(--bg) 72%, transparent)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <Button variant="primary" style={{ width: '100%', padding: '15px 0', fontSize: 16, borderRadius: 14 }} icon="sparkles"
          onClick={() => finish(true)}>
          {t("Let's go! Load starter plan")}
        </Button>
        <Button style={{ width: '100%', padding: '12px 0', fontSize: 14, borderRadius: 12 }} onClick={() => finish(false)}>
          {t("Skip — I'll build my plan manually")}
        </Button>
      </div>
    </div>
  )
}
