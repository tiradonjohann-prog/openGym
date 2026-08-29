import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

export default function RecipeCard({ recipe, onAdd }) {
  const macros = [
    recipe.prot  != null ? recipe.prot  + 'g P' : null,
    recipe.carbs != null ? recipe.carbs + 'g C' : null,
    recipe.fat   != null ? recipe.fat   + 'g F' : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="lrow tap" style={{ paddingRight: 8 }}>
      <span className="lrow-m">
        <span className="lrow-t">{recipe.name}</span>
        <span className="lrow-s">
          {recipe.kcal} kcal{macros ? '  ·  ' + macros : ''}
        </span>
      </span>
      <button
        className="btn tinted"
        style={{ minWidth: 0, padding: '5px 10px', fontSize: 13 }}
        onClick={() => onAdd(recipe)}
        aria-label={t('Add {0}', recipe.name)}
      >
        <Icon name="plus" />
        <span>{t('Add')}</span>
      </button>
    </div>
  )
}
