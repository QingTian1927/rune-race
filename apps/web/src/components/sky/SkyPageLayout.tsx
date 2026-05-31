import type { ReactNode } from 'react'
import { GameHeader } from './GameHeader'

type SkyPageLayoutProps = {
  children: ReactNode
  playerName: string
  onPlayerNameChange: (value: string) => void
  onPlayerNameBlur: () => void
  footer?: ReactNode
}

export function SkyPageLayout({
  children,
  playerName,
  onPlayerNameChange,
  onPlayerNameBlur,
  footer,
}: SkyPageLayoutProps) {
  return (
    <div className="page">
      <GameHeader
        name={playerName}
        onNameChange={onPlayerNameChange}
        onNameBlur={onPlayerNameBlur}
      />
      {children}
      {footer}
    </div>
  )
}
