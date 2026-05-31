import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type SkyFormStageProps = {
  backTo: string
  backLabel?: string
  children: ReactNode
  className?: string
}

export function SkyFormStage({
  backTo,
  backLabel = 'Quay về trang chủ',
  children,
  className = '',
}: SkyFormStageProps) {
  return (
    <div className={`home-form-stage sky-form-stage ${className}`.trim()}>
      <Link to={backTo} className="back-btn home-back-btn">
        <i className="bi bi-arrow-left-short inline-icon" aria-hidden="true" /> {backLabel}
      </Link>
      {children}
    </div>
  )
}
