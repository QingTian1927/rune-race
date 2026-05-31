type PanelCollapseButtonProps = {
  collapsed: boolean
  onClick: () => void
  /** Direction the panel content expands when opened */
  expandDirection?: 'left' | 'right' | 'down'
  className?: string
}

type ChevronDirection = 'left' | 'right' | 'up' | 'down'

function chevronDirection(
  expandDirection: 'left' | 'right' | 'down',
  collapsed: boolean,
): ChevronDirection {
  if (expandDirection === 'right') {
    return collapsed ? 'right' : 'left'
  }
  if (expandDirection === 'left') {
    return collapsed ? 'left' : 'right'
  }
  return collapsed ? 'down' : 'up'
}

function ChevronIcon({ direction }: { direction: ChevronDirection }) {
  const rotation: Record<ChevronDirection, string> = {
    right: 'rotate(0deg)',
    down: 'rotate(90deg)',
    left: 'rotate(180deg)',
    up: 'rotate(-90deg)',
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: rotation[direction] }}
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function ariaLabel(collapsed: boolean) {
  return collapsed ? 'Mở rộng' : 'Thu gọn'
}

export function PanelCollapseButton({
  collapsed,
  onClick,
  expandDirection = 'right',
  className = '',
}: PanelCollapseButtonProps) {
  const direction = chevronDirection(expandDirection, collapsed)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={!collapsed}
      aria-label={ariaLabel(collapsed)}
      className={['game-hud-icon-btn', className].filter(Boolean).join(' ')}
    >
      <ChevronIcon direction={direction} />
    </button>
  )
}
