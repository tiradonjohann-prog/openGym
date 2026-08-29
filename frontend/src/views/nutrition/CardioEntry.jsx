import { useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { todayISO, uid, fmtDate } from '../../lib/format.js'
import { lastBW } from '../../lib/history.js'
import { CARDIO_TYPES, calcCardioKcal, calcPace, dayCardioKcal } from '../../lib/cardio.js'
import Icon from '../../components/Icon.jsx'
import { NumberField, Stepper, Switch, Button, Section, Row } from '../../components/ui.jsx'

function CardioForm({ weightKg, onSave, onCancel }) {
  const types = Object.entries(CARDIO_TYPES)
  const [type,     setType]     = useState('run')
  const [duration, setDuration] = useState(null)
  const [distance, setDistance] = useState(null)
  const [elevation,setElev]     = useState(null)
  const [intensity,setIntensity]= useState(null)
  const [manualKcal, setManualKcal] = useState(false)
  const [kcalOverride, setKcalOverride] = useState(null)
  const [date, setDate]         = useState(todayISO())

  const spec    = CARDIO_TYPES[type]
  const hasDistance  = spec.fields.includes('distance')
  const hasElevation = spec.fields.includes('elevation')

  const autoKcal = calcCardioKcal(type, weightKg, duration, hasDistance ? distance : null)
  const pace     = hasDistance ? calcPace(duration, distance) : null
  const kcal     = manualKcal ? (kcalOverride || 0) : (autoKcal || 0)

  const canSave  = duration && duration > 0

  const save = () => {
    if (!canSave) return
    onSave({
      id: uid(),
      type, label: t(spec.label),
      duration, distance: hasDistance ? distance : null,
      elevation: hasElevation ? elevation : null,
      kcal, manualKcal,
      intensity, pace,
      date,
    })
  }

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* Type picker */}
      <div className="cardio-chips" style={{ padding: '0 16px 12px' }}>
        {types.map(([k, v]) => (
          <button
            key={k}
            className={'chip' + (type === k ? ' on' : '')}
            onClick={() => { setType(k); setDistance(null); setElev(null) }}
            aria-pressed={type === k}
          >
            <Icon name={v.icon} size={16} />
            {t(v.label)}
          </button>
        ))}
      </div>

      <Section>
        <Row icon="timer" iconTint="var(--acc)" title={t('Duration')} subtitle={t('minutes')}>
          <NumberField value={duration} decimal={false} nullable onChange={setDuration} style={{ width: 68, textAlign: 'right' }} placeholder="—" />
        </Row>
        {hasDistance && (
          <Row icon="target" iconTint="var(--blue)" title={t('Distance')} subtitle="km">
            <NumberField value={distance} nullable onChange={setDistance} style={{ width: 68, textAlign: 'right' }} placeholder="—" />
          </Row>
        )}
        {hasElevation && (
          <Row icon="arrowUp" iconTint="var(--teal)" title={t('Elevation gain')} subtitle="m">
            <NumberField value={elevation} decimal={false} nullable onChange={setElev} style={{ width: 68, textAlign: 'right' }} placeholder="—" />
          </Row>
        )}
        {pace != null && (
          <Row icon="bolt" iconTint="var(--yellow)" title={t('Average speed')} value={pace + ' km/h'} />
        )}
        <Row icon="flame" iconTint="var(--orange)" title={t('Calories burned')}
          subtitle={manualKcal ? t('Manual entry') : t('Calculated — Ainsworth 2011')}
        >
          {manualKcal
            ? <NumberField value={kcalOverride} decimal={false} nullable onChange={setKcalOverride} style={{ width: 68, textAlign: 'right' }} placeholder="—" />
            : <span className="lrow-v">{autoKcal != null ? autoKcal + ' kcal' : '—'}</span>
          }
        </Row>
        <Row icon="pencil" iconTint="var(--label-3)" title={t('Override calories')}>
          <Switch checked={manualKcal} onChange={v => { setManualKcal(v); if (!v) setKcalOverride(null) }} />
        </Row>
        <Row icon="heart" iconTint="var(--red)" title={t('Perceived effort')} subtitle={t('1 = easy · 5 = maximal')}>
          <Stepper value={intensity ?? 0} step={1} decimal={false} onChange={v => setIntensity(Math.max(0, Math.min(5, v)) || null)} />
        </Row>
        <Row icon="calendar" iconTint="var(--label-3)" title={t('Date')} value={fmtDate(date, true)}>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={todayISO()}
            style={{ opacity: 0, position: 'absolute', right: 0, width: 120, height: 44 }}
          />
        </Row>
      </Section>

      {!weightKg && (
        <p className="sect-f" style={{ color: 'var(--orange)' }}>{t('Log a body weight to get automatic calorie estimates.')}</p>
      )}

      <div style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button variant="primary" onClick={save} disabled={!canSave}>{t('Save activity')}</Button>
        <Button variant="plain" onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    </div>
  )
}

// Standalone cardio history + add button, embedded in the DayView or accessible from Nutrition
export default function CardioSection() {
  const S = useStore(s => s.S)
  const { update } = useStore()
  const { openSheet } = useUI()
  const today = todayISO()

  const bw       = lastBW(S)
  const weightKg = bw ? (S.unit === 'lb' ? bw.w / 2.2046 : bw.w) : null
  const log      = S.nutritionLog || {}
  const sports   = (log[today]?.sport || [])

  const addCardio = entry => {
    update(s => {
      const d = entry.date || today
      if (!s.nutritionLog)     s.nutritionLog = {}
      if (!s.nutritionLog[d])  s.nutritionLog[d] = { meals: [], sport: [] }
      s.nutritionLog[d].sport.push(entry)
    })
  }

  const removeCardio = (date, id) => {
    update(s => {
      if (!s.nutritionLog?.[date]?.sport) return
      s.nutritionLog[date].sport = s.nutritionLog[date].sport.filter(entry => entry.id !== id)
    })
  }

  const openAdd = () => openSheet(close => (
    <>
      <h3>{t('Log activity')}</h3>
      <CardioForm
        weightKg={weightKg}
        onSave={entry => { addCardio(entry); close() }}
        onCancel={close}
      />
    </>
  ))

  const totalKcal = dayCardioKcal(log, today)

  return (
    <section className="sect">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 2px' }}>
        <h2 className="sect-t" style={{ margin: 0 }}>{t('Activities')}</h2>
        {totalKcal > 0 && (
          <span style={{ fontSize: 13, color: 'var(--label-3)', paddingRight: 16 }}>−{totalKcal} kcal</span>
        )}
      </div>
      <div className="sect-b">
        {sports.map(s => (
          <div key={s.id} className="lrow">
            <span className="lrow-i" style={{ '--tint': 'var(--orange)' }}>
              <Icon name={CARDIO_TYPES[s.type]?.icon || 'bolt'} />
            </span>
            <span className="lrow-m">
              <span className="lrow-t">{t(CARDIO_TYPES[s.type]?.label || s.label)}</span>
              <span className="lrow-s">
                {s.duration} min
                {s.distance ? ' · ' + s.distance + ' km' : ''}
                {s.pace ? ' · ' + s.pace + ' km/h' : ''}
              </span>
            </span>
            <span className="lrow-v">{s.kcal} kcal</span>
            <button className="iconbtn" style={{ opacity: .4 }} onClick={() => removeCardio(today, s.id)} aria-label={t('Remove')}>
              <Icon name="minus" />
            </button>
          </div>
        ))}
        <button className="lrow tap" style={{ color: 'var(--acc)', fontWeight: 500 }} onClick={openAdd}>
          <Icon name="plus" />
          <span style={{ marginLeft: 8, fontSize: 15 }}>{t('Log activity')}</span>
        </button>
      </div>
    </section>
  )
}
