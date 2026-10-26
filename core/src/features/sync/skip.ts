import type { IdMode, SyncCheckpoint } from '../../types.ts'

// flow policy for one batch, decided before touching any rows
export interface SkipState {
  cleared: boolean
  processAll: boolean
  offset: number
  skipBelow: number
}

export interface ComputeSkipParams {
  checkpoint: SyncCheckpoint
  maxSeen: number
  idMode: IdMode
  rescan?: boolean
}

// decide cleared / offset / skipBelow from the checkpoint and this batch's ids
export function computeSkip({ checkpoint, maxSeen, idMode, rescan }: ComputeSkipParams): SkipState {
  const hashIds = idMode === 'hash' // hash ids carry no order, skip checkpoint logic
  const cleared = !hashIds && detectCleared(checkpoint, maxSeen)
  const processAll = hashIds || rescan || cleared
  return {
    cleared,
    processAll,
    offset: cleared ? resetOffset(checkpoint) : checkpoint.sourceIdOffset,
    skipBelow: processAll ? -1 : checkpoint.lastSourceVisitId,
  }
}

export function detectCleared(checkpoint: SyncCheckpoint, sourceMaxVisitId: number): boolean {
  return checkpoint.lastSourceVisitId > 0 && sourceMaxVisitId < checkpoint.lastSourceVisitId
}

export function resetOffset(checkpoint: SyncCheckpoint): number {
  return checkpoint.sourceIdOffset + checkpoint.lastSourceVisitId
}
