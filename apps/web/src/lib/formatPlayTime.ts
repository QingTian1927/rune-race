/** Format stored seconds as "X giờ Y phút" (omits hours when zero). */
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
