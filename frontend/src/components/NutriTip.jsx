import { useState } from 'react'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'
import { SEVERITY } from '../lib/tips.js'

const ICON_MAP = {
  [SEVERITY.soft]: 'lightbulb',
  [SEVERITY.info]: 'info',
  [SEVERITY.ok]:   'checkCircle',
}
const COLOR_MAP = {
  [SEVERITY.soft]: 'var(--orange)',
  [SEVERITY.info]: 'var(--blue)',
  [SEVERITY.ok]:   'var(--green)',
}

export default function NutriTip({ tip, onDismiss }) {
  const [gone, setGone] = useState(false)
  if (gone) return null

  const dismiss = () => {
    setGone(true)
    onDismiss?.(tip.id)
  }

  return (
    <div className={`nutri-tip tip-${tip.severity}`} role="status">
      <span className="tip-icon" style={{ color: COLOR_MAP[tip.severity] }}>
        <Icon name={ICON_MAP[tip.severity] || 'info'} size={18} />
      </span>
      <span className="tip-text">{t(tip.message)}</span>
      <button className="tip-close iconbtn" onClick={dismiss} aria-label={t('Dismiss')}>
        <Icon name="xmark" size={16} />
      </button>
    </div>
  )
}
