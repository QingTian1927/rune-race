import type { ReactNode } from 'react'
import { GameHeader } from './GameHeader'
import { SiteBanner } from '../banner/SiteBanner'

type SkyPageLayoutProps = {
  children: ReactNode
  playerName: string
  onPlayerNameChange: (value: string) => void
  onPlayerNameBlur: () => void
  footer?: ReactNode
  /** Extra controls rendered at the start of the fixed top nav (e.g. lobby back). */
  topNavExtra?: ReactNode
}

export function SkyPageLayout({
  children,
  playerName,
  onPlayerNameChange,
  onPlayerNameBlur,
  footer,
  topNavExtra,
}: SkyPageLayoutProps) {
  return (
    <div className="page">
      <SiteBanner placement="sky" />
      <GameHeader
        name={playerName}
        onNameChange={onPlayerNameChange}
        onNameBlur={onPlayerNameBlur}
        topNavExtra={topNavExtra}
      />
      {children}
      {footer}
    </div>
  )
}
