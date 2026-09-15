import { useState, useRef, useEffect } from 'react'
import { searchFood, searchCiqual } from '../lib/foodSearch.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { SearchField } from './ui.jsx'

export default function FoodSearch({ onSelect }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const tmRef = useRef(null)

  useEffect(() => {
    clearTimeout(tmRef.current)

    if (query.trim().length < 2) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }

    // CIQUAL: résultats locaux immédiats (pas de réseau)
    const local = searchCiqual(query)
    setResults(local)
    setError(null)

    // OFF: résultats réseau en parallèle (après 400 ms de debounce)
    const controller = new AbortController()
    setLoading(true)

    tmRef.current = setTimeout(async () => {
      try {
        const remote = await searchFood(query, controller.signal)
        if (!controller.signal.aborted) {
          const localNames = new Set(local.map(r => r.name.toLowerCase()))
          const extra = remote.filter(r => !localNames.has(r.name.toLowerCase()))
          setResults([...local, ...extra])
        }
      } catch (e) {
        if (e.name !== 'AbortError') setError(t('Search unavailable — check your connection.'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 400)

    return () => {
      clearTimeout(tmRef.current)
      controller.abort()
    }
  }, [query])

  return (
    <div>
      <div className="food-search-wrap">
        <SearchField
          value={query}
          onChange={e => setQuery(e.target.value)}
          onClear={() => { setQuery(''); setResults([]) }}
          placeholder={t('Search food…')}
          autoFocus
        />
      </div>

      {loading && (
        <p className="sect-f" style={{ textAlign: 'center', paddingTop: 8 }}>{t('Searching…')}</p>
      )}

      {error && (
        <p className="sect-f" style={{ color: 'var(--red)', paddingTop: 8 }}>{error}</p>
      )}

      {!loading && results.length === 0 && query.trim().length >= 2 && !error && (
        <p className="sect-f" style={{ paddingTop: 8 }}>{t('No results. Try a different search or add manually.')}</p>
      )}

      {results.length > 0 && (
        <div className="sect-b" style={{ marginTop: 4 }}>
          {results.map(item => (
            <button key={item.id || item.name} className="lrow tap" onClick={() => onSelect(item)}>
              <span className="lrow-m">
                <span className="lrow-t">{item.name}</span>
                <span className="lrow-s">
                  {item.brand ? item.brand + ' · ' : ''}
                  {item.kcal != null ? item.kcal + ' kcal/100g' : t('Incomplete data')}
                  {!item.complete && item.kcal != null ? ' · ' + t('Macros incomplete') : ''}
                </span>
              </span>
              <Icon name="plus" className="lrow-c" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
