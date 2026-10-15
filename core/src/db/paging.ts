import type { EpochMs } from '../types.ts'

// Cursor paging primitives shared by all list queries.

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const CURSOR_VERSION = 'v1'

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT)
}

/** limit+1 fetch → one page (extra row means more follow). */
export function paginate<T>(
  rows: readonly T[],
  limit: number,
  keyOf: (last: T) => [EpochMs, number],
): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  if (last === undefined || rows.length <= limit)
    return { items, nextCursor: null }
  const [time, id] = keyOf(last)
  return { items, nextCursor: encodeCursor(time, id) }
}

/** `v1:<base64url([time, id])>` */
export function encodeCursor(time: EpochMs, id: number): string {
  return `${CURSOR_VERSION}:${Buffer.from(JSON.stringify([time, id]), 'utf8').toString('base64url')}`
}

/** Parses encodeCursor output; null if invalid. */
export function decodeCursor(cursor: string): [EpochMs, number] | null {
  if (!cursor.startsWith(`${CURSOR_VERSION}:`)) return null
  try {
    const pair: unknown = JSON.parse(Buffer.from(cursor.slice(CURSOR_VERSION.length + 1), 'base64url').toString('utf8'))
    if (!Array.isArray(pair) || pair.length !== 2) return null
    const [time, id] = pair
    if (typeof time !== 'number' || typeof id !== 'number') return null
    return [time, id]
  } catch {
    return null
  }
}
