export function formatPlayTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)

  if (hours > 0 && minutes > 0) return `${hours} giờ ${minutes} phút`
  if (hours > 0) return `${hours} giờ`
  if (minutes > 0) return `${minutes} phút`
  return '0 phút'
}

export function formatWinRate(wins: number, games: number): string {
  if (games <= 0) return '—'
  return `${Math.round((wins / games) * 100)}%`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatUptime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(safe / 86_400)
  const hours = Math.floor((safe % 86_400) / 3600)
  const minutes = Math.floor((safe % 3600) / 60)

  if (days > 0) return `${days} ngày ${hours} giờ`
  if (hours > 0) return `${hours} giờ ${minutes} phút`
  if (minutes > 0) return `${minutes} phút`
  return `${safe} giây`
}
