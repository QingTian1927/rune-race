import { useState } from 'react'
import { runeCardOrientationModifier } from '../../lib/runeAssets'
import {
  MARKETING_RUNE_CARDS,
  RUNE_FILTER_LABELS,
  type RuneCardGroup,
} from '../../lib/marketingRunes'

type FilterKey = RuneCardGroup | 'all'

export function RuneLibrary() {
  const [filter, setFilter] = useState<FilterKey>('all')

  return (
    <>
      <div className="filter-row" role="group" aria-label="Lọc thẻ Rune">
        {(Object.keys(RUNE_FILTER_LABELS) as FilterKey[]).map((key) => (
          <button
            key={key}
            className={`filter-btn${filter === key ? ' active' : ''}`}
            type="button"
            onClick={() => setFilter(key)}
          >
            {RUNE_FILTER_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="rune-library">
        {MARKETING_RUNE_CARDS.map((card) => (
          <article
            key={card.type}
            className={[
              'library-card',
              runeCardOrientationModifier(card.type, 'library-card'),
              filter !== 'all' && card.group !== filter ? 'is-hidden' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-card-group={card.group}
          >
            <img src={card.image} alt={card.label} loading="lazy" />
          </article>
        ))}
      </div>
    </>
  )
}
