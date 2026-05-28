import type { LegalMove } from '@rune-race/shared'

type MoveSelectionPanelProps = {
  visible: boolean
  moves: LegalMove[]
  hoveredTokenId: string | null
  onHoverToken: (tokenId: string | null) => void
  onSelectMove: (moveId: string) => void
}

function tokenNumberFromId(tokenId: string) {
  return Number(tokenId.split(':').pop() ?? '0') + 1
}

function moveLabel(move: LegalMove) {
  const tokenNumber = tokenNumberFromId(move.tokenId)
  if (move.moveType === 'spawn') {
    return {
      title: `Quân #${tokenNumber} xuất chuồng`,
      subtitle: `Ra đường chính (ô ${move.destination})`,
    }
  }
  if (move.moveType === 'capture') {
    return {
      title: `Di chuyển quân #${tokenNumber}`,
      subtitle: `Đến ô ${move.destination} và ăn quân đối thủ`,
    }
  }
  return {
    title: `Di chuyển quân #${tokenNumber}`,
    subtitle: `Đến ô ${move.destination}`,
  }
}

export function MoveSelectionPanel({
  visible,
  moves,
  hoveredTokenId,
  onHoverToken,
  onSelectMove,
}: MoveSelectionPanelProps) {
  if (!visible || moves.length === 0) return null

  return (
    <div className="pointer-events-auto fixed bottom-16 left-1/2 z-20 w-[360px] -translate-x-1/2 rounded-2xl border border-amber-200 bg-white/80 p-3 shadow-lg backdrop-blur-sm">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Hãy chọn nước đi</p>
      <div className="space-y-2">
        {moves.map((move) => {
          const label = moveLabel(move)
          const isHovered = hoveredTokenId === move.tokenId
          return (
            <button
              key={move.id}
              type="button"
              onMouseEnter={() => onHoverToken(move.tokenId)}
              onMouseLeave={() => onHoverToken(null)}
              onFocus={() => onHoverToken(move.tokenId)}
              onBlur={() => onHoverToken(null)}
              onClick={() => onSelectMove(move.id)}
              className={[
                'w-full rounded-xl border px-3 py-2 text-left transition-all duration-200',
                isHovered
                  ? 'border-amber-300 bg-amber-50/90 shadow-md'
                  : 'border-amber-100 bg-white/75 hover:border-amber-300 hover:bg-amber-50/80',
              ].join(' ')}
            >
              <div className="text-sm font-bold text-gray-900">{label.title}</div>
              <div className="text-xs font-medium text-gray-600">{label.subtitle}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
