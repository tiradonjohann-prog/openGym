import { useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'
import { todayISO, uid, fmtDate } from '../../lib/format.js'
import { lastBW } from '../../lib/history.js'
import { CARDIO_TYPES, calcCardioKcal, calcPace, dayCardioKcal } from '../../lib/cardio.js'
import Icon from '../../components/Icon.jsx'
import { NumberField, Stepper, Switch, Button, Section, Row } from '../../components/ui.jsx'

export function CardioForm({ weightKg, onSave, onCancel }) {
  const types = Object.entries(CARDIO_TYPES)
  const [type,     setType]     = useState('run')
  const [duration, setDuration] = useState(null)
  const [distance, setDistance] = useState(null)
  const [elevation,setElev]     = useState(null)
  const [intensity,setIntensity]= useState(null)
  const [kcalInput, setKcalInput] = useState(null) // null = use auto-calculated
  const [date, setDate]         = useState(todayISO())

  const spec    = CARDIO_TYPES[type]
  const hasDistance  = spec.fields.includes('distance')
  const hasElevation = spec.fields.includes('elevation')

  const autoKcal = calcCardioKcal(type, weightKg, duration, hasDistance ? distance : null)
  const pace     = hasDistance ? calcPace(duration, distance) : null
  // Display: user value if set, else auto-calculated. Save: same logic, default to 0.
  const displayKcal = kcalInput !== null ? kcalInput : autoKcal
  const isManual    = kcalInput !== null
  const kcal        = kcalInput !== null ? (kcalInput || 0) : (autoKcal || 0)

  const canSave  = duration && duration > 0

  const handleTypeChange = k => { setType(k); setDistance(null); setElev(null) }

  const save = () => {
    if (!canSave) return
    onSave({
      id: uid(),
      type, label: t(spec.label),
      duration, distance: hasDistance ? distance : null,
      elevation: hasElevation ? elevation : null,
      kcal, manualKcal: isManual,
      intensity, pace,
      date,
    })
  }

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* Type chips */}
      <div className="cardio-chips" style={{ padding: '0 16px 14px' }}>
        {types.map(([k, v]) => (
          <button
            key={k}
            className={'chip' + (type === k ? ' on' : '')}
            onClick={() => handleTypeChange(k)}
            aria-pressed={type === k}
          >
            <Icon name={v.icon} size={16} />
            {t(v.label)}
          </button>
        ))}
      </div>

      {/* Main metric inputs — prominent card */}
      <div style={{ display: 'grid', gridTemplateColumns: hasDistance ? '1fr 1fr' : '1fr', gap: 10, padding: '0 16px 14px' }}>
        <div className="input-metric-card">
          <div className="imc-label">{t('Duration')}</div>
          <div className="imc-row">
            <NumberField
              value={duration}
              decimal={false}
              nullable
              onChange={setDuration}
              className="imc-input"
              placeholder="0"
              aria-label={t('Duration')}
            />
            <span className="imc-unit">min</span>
          </div>
        </div>
        {hasDistance && (
          <div className="input-metric-card">
            <div className="imc-label">{t('Distance')}</div>
            <div className="imc-row">
              <NumberField
                value={distance}
                nullable
                onChange={setDistance}
                className="imc-input"
                placeholder="0"
                aria-label={t('Distance')}
              />
              <span className="imc-unit">km</span>
            </div>
          </div>
        )}
        {hasElevation && (
          <div className="input-metric-card">
            <div className="imc-label">{t('Elevation gain')}</div>
            <div className="imc-row">
              <NumberField
                value={elevation}
                decimal={false}
                nullable
                onChange={setElev}
                className="imc-input"
                placeholder="0"
                aria-label={t('Elevation gain')}
              />
              <span className="imc-unit">m</span>
            </div>
          </div>
        )}
      </div>

      {/* Derived stat: pace */}
      {pace != null && (
        <div style={{ padding: '0 16px 10px' }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
            <Icon name="bolt" style={{ color: 'var(--yellow)', fontSize: 16, flexShrink: 0 }} />
            <span className="small" style={{ color: 'var(--label-2)', flex: 1 }}>{t('Average speed')}</span>
            <span style={{ fontWeight: 600, fontSize: 16 }}>{pace} km/h</span>
          </div>
        </div>
      )}

      {/* Secondary settings */}
      <Section>
        <Row icon="flame" iconTint="var(--orange)" title={t('Calories burned')}
          subtitle={isManual ? t('Manual entry') : weightKg ? t('Estimated — Ainsworth 2011') : t('No weight logged — enter here')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NumberField value={displayKcal} decimal={false} nullable onChange={setKcalInput} style={{ width: 72, textAlign: 'right' }} placeholder="—" />
            {isManual && (
              <button className="iconbtn" style={{ fontSize: 12, width: 24, height: 24, opacity: .5 }}
                onClick={() => setKcalInput(null)} aria-label={t('Reset to auto')}>
                <Icon name="xmark" style={{ fontSize: 11 }} />
              </button>
            )}
          </div>
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
