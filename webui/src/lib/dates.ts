const DAY = 86_400_000

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

export function dayKey(epoch: number): string {
  const d = new Date(epoch)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function dayLabel(epoch: number): string {
  const today = dayKey(Date.now())
  const key = dayKey(epoch)
  if (key === today) return 'Today'
  if (key === dayKey(Date.now() - DAY)) return 'Yesterday'
  return weekdayFormat.format(epoch)
}

export function timeLabel(epoch: number): string {
  return timeFormat.format(epoch)
}
