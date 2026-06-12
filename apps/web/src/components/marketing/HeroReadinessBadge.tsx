import type { ReadinessUiStatus } from '../../hooks/useSystemReadiness'
import { useSystemReadiness } from '../../hooks/useSystemReadiness'

const BADGE_COPY: Record<ReadinessUiStatus, string> = {
  checking: 'Đang kiểm tra…',
  ready: 'Sẵn sàng tạo phòng',
  degraded: 'Sẵn sàng hạn chế',
  down: 'Tạm gián đoạn',
}

const BADGE_ARIA: Record<ReadinessUiStatus, string> = {
  checking: 'Đang kiểm tra trạng thái hệ thống',
  ready: 'Hệ thống sẵn sàng tạo phòng',
  degraded: 'Hệ thống hoạt động một phần, vẫn có thể chơi',
  down: 'Hệ thống tạm gián đoạn',
}

export function HeroReadinessBadge() {
  const { status } = useSystemReadiness()

  return (
    <div
      className={['hero-float', `hero-float--${status}`].join(' ')}
      role="status"
      aria-live="polite"
      aria-label={BADGE_ARIA[status]}
    >
      <span className={['pulse', `pulse--${status}`].join(' ')} aria-hidden />
      {BADGE_COPY[status]}
    </div>
  )
}
