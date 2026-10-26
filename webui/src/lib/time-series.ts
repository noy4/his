import dayjs from 'dayjs'

// all-time daily charts are clamped to the most recent N days
export const ALL_TIME_DAYS = 90

// zero-fill daily rows across [from, to] so the trend is continuous.
// `zero` lists the numeric fields (e.g. { visits: 0 } or { repo: 0, issue_pr: 0, other: 0 })
// and their field names are preserved so charts can select a series with dataKey.
export function dailySeries<T extends { day: string }>(
  byDay: T[],
  from: string,
  to: string,
  zero: Omit<T, 'day'>,
): T[] {
  const byKey = new Map(byDay.map((d) => [d.day, d]))
  const end = dayjs(to)
  const out: T[] = []
  for (let cur = dayjs(from); !cur.isAfter(end, 'day'); cur = cur.add(1, 'day')) {
    const day = cur.format('YYYY-MM-DD')
    out.push(byKey.get(day) ?? ({ day, ...zero } as T))
  }
  return out
}
