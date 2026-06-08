import { RUNE_CARD_IMAGES, RUNE_CARD_LABELS } from '../../lib/runeAssets'
import { useRuneTriggerFlash } from '../../contexts/RuneTriggerFlashContext'

export function RuneTriggerFlashOverlay() {
  const flash = useRuneTriggerFlash()
  const stack = flash?.flashStack ?? []

  if (stack.length === 0) return null

  return (
    <div className="game-hud-slot game-hud-slot--rune-flash" aria-live="polite" aria-label="Rune đã kích hoạt">
      <div className="rune-trigger-flash-stack">
        {stack.map((item) => {
          const label = RUNE_CARD_LABELS[item.cardType]
          return (
            <div
              key={item.key}
              className={[
                'rune-trigger-flash-item',
                item.exiting ? 'rune-trigger-flash-item--exit' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <img
                src={RUNE_CARD_IMAGES[item.cardType]}
                alt=""
                className="rune-trigger-flash-card"
              />
              <span className="rune-trigger-flash-label">{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
