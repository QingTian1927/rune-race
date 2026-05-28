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
  const rotations: Record<ChevronDirection, string> = {
    right: 'rotate-0',
    down: 'rotate-90',
    left: 'rotate-180',
    up: '-rotate-90',
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={['h-5 w-5', rotations[direction]].join(' ')}
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
      className={[
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-gray-300 bg-white p-0 text-gray-800 shadow-sm transition-all hover:border-gray-400 hover:bg-gray-50 active:scale-95',
        className,
      ].join(' ')}
    >
      <ChevronIcon direction={direction} />
    </button>
  )
}
