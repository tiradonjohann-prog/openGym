import { useState, useRef, useEffect } from 'react'
import { searchFood } from '../lib/foodSearch.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { SearchField } from './ui.jsx'

export default function FoodSearch({ onSelect }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const abortRef = useRef(null)
  const tmRef    = useRef(null)

  useEffect(() => {
    clearTimeout(tmRef.current)
    if (query.trim().length < 2) { setResults([]); setError(null); return }

    tmRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      setLoading(true)
      setError(null)
      try {
        const items = await searchFood(query, abortRef.current.signal)
        setResults(items)
      } catch (e) {
        if (e.name !== 'AbortError') setError(t('Search unavailable — check your connection.'))
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      clearTimeout(tmRef.current)
      abortRef.current?.abort()
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
