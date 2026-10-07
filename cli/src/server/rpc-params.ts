import { INVALID_PARAMS, rpcError } from './rpc-frame.ts'
import type { SearchFilter } from '@his/core'

// Per-param validators — throw INVALID_PARAMS on shape mismatch, keeping
// dispatch handlers declarative.

export function stringParam(params: unknown, key: string): string {
  const raw = typeof params === 'object' && params !== null ? (params as Record<string, unknown>)[key] : undefined
  if (typeof raw !== 'string' || raw === '') throw rpcError(INVALID_PARAMS, `params.${key}: string required`)
  return raw
}

export function numberParam(params: unknown, key: string): number {
  const raw = typeof params === 'object' && params !== null ? (params as Record<string, unknown>)[key] : undefined
  if (typeof raw !== 'number' || !Number.isFinite(raw)) throw rpcError(INVALID_PARAMS, `params.${key}: number required`)
  return raw
}

export function optionalNumber(params: unknown, key: string): number | undefined {
  const raw = typeof params === 'object' && params !== null ? (params as Record<string, unknown>)[key] : undefined
  if (raw === undefined) return undefined
  if (typeof raw !== 'number' || !Number.isFinite(raw)) throw rpcError(INVALID_PARAMS, `params.${key}: number required`)
  return raw
}

export function monthParam(params: unknown): string | undefined {
  const raw = typeof params === 'object' && params !== null ? (params as Record<string, unknown>)['month'] : undefined
  if (raw === undefined) return undefined
  if (typeof raw !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    throw rpcError(INVALID_PARAMS, 'params.month: YYYY-MM string required')
  }
  return raw
}

export function optionalBoolean(params: unknown, key: string): boolean | undefined {
  const raw = typeof params === 'object' && params !== null ? (params as Record<string, unknown>)[key] : undefined
  if (raw === undefined) return undefined
  if (typeof raw !== 'boolean') throw rpcError(INVALID_PARAMS, `params.${key}: boolean required`)
  return raw
}

export function searchFilter(params: unknown): SearchFilter {
  const raw = asObject(params) ?? {}
  const filter: SearchFilter = {}
  const query = raw.query
  if (query !== undefined) {
    if (typeof query !== 'string') throw rpcError(INVALID_PARAMS, 'params.query: string required')
    filter.query = query
  }
  const cursor = raw.cursor
  if (cursor !== undefined) {
    if (typeof cursor !== 'string') throw rpcError(INVALID_PARAMS, 'params.cursor: string required')
    filter.cursor = cursor
  }
  for (const key of ['from', 'to'] as const) {
    const value = raw[key]
    if (value === undefined) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) throw rpcError(INVALID_PARAMS, `params.${key}: number required`)
    filter[key] = value
  }
  const limit = raw.limit
  if (limit !== undefined) {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) throw rpcError(INVALID_PARAMS, 'params.limit: number required')
    filter.limit = limit
  }
  return filter
}

export function syncOptions(params: unknown): { full?: boolean; targets?: string[] } {
  const raw = asObject(params) ?? {}
  const options: { full?: boolean; targets?: string[] } = { full: optionalBoolean(params, 'full') ?? false }
  const targets = raw.targets
  if (targets !== undefined) {
    if (!Array.isArray(targets)) throw rpcError(INVALID_PARAMS, 'params.targets: string[] required')
    options.targets = targets.map((target, i) => {
      if (typeof target !== 'string' || target === '')
        throw rpcError(INVALID_PARAMS, `params.targets[${i}]: non-empty string required`)
      return target
    })
  }
  return options
}

function asObject(params: unknown): Record<string, unknown> | null {
  return typeof params === 'object' && params !== null ? (params as Record<string, unknown>) : null
}
