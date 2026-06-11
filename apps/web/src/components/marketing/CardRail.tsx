import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { HOME_CARD_RAIL_TYPES } from '../../lib/marketingRunes'
import { RUNE_CARD_IMAGES, RUNE_CARD_LABELS, runeCardOrientationModifier } from '../../lib/runeAssets'

export function CardRail() {
  const railRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'prev' | 'next') => {
    railRef.current?.scrollBy({ left: direction === 'prev' ? -420 : 420, behavior: 'smooth' })
  }

  return (
    <div className="card-rail-wrap">
      <div className="card-rail" ref={railRef}>
        {HOME_CARD_RAIL_TYPES.map((type) => (
          <Link
            key={type}
            className={['rune-card', runeCardOrientationModifier(type, 'rune-card')].filter(Boolean).join(' ')}
            to="/guide#rune-library"
          >
            <img src={RUNE_CARD_IMAGES[type]} alt={`Thẻ ${RUNE_CARD_LABELS[type]}`} loading="lazy" />
          </Link>
        ))}
      </div>
      <div className="rail-controls">
        <button className="icon-btn" type="button" aria-label="Xem thẻ trước" onClick={() => scroll('prev')}>
          <i className="bi bi-arrow-left" aria-hidden="true" />
        </button>
        <button className="icon-btn" type="button" aria-label="Xem thẻ tiếp theo" onClick={() => scroll('next')}>
          <i className="bi bi-arrow-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
