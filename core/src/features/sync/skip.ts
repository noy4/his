import type { IdMode, NormalizedVisit, SyncCheckpoint } from '../../types.ts'

export type IngestPlan = SkipState & {
  sourceMaxVisitId: number
  candidates: NormalizedVisit[]
}

export type PlanIngestParams = Omit<ComputeSkipParams, 'sourceMaxVisitId'> & {
  visits: NormalizedVisit[]
}

// plan one ingest: source max id -> flow policy -> the visits to write
export function planIngest({ visits, checkpoint, idMode, rescan }: PlanIngestParams): IngestPlan {
  let sourceMaxVisitId = 0
  for (const visit of visits) {
    if (visit.sourceVisitId > sourceMaxVisitId)
      sourceMaxVisitId = visit.sourceVisitId
  }
  const skip = computeSkip({ checkpoint, sourceMaxVisitId, idMode, rescan })
  return {
    ...skip,
    sourceMaxVisitId,
    candidates: visits.filter((visit) => visit.sourceVisitId > skip.skipBelow),
  }
}

// flow policy for one ingest, decided before touching any rows
export interface SkipState {
  cleared: boolean
  processAll: boolean
  sourceIdOffset: number
  skipBelow: number
}

export interface ComputeSkipParams {
  checkpoint: SyncCheckpoint
  sourceMaxVisitId: number
  idMode: IdMode
  rescan?: boolean
}

// decide cleared / sourceIdOffset / skipBelow from the checkpoint and this ingest's ids
export function computeSkip({ checkpoint, sourceMaxVisitId, idMode, rescan }: ComputeSkipParams): SkipState {
  const hashIds = idMode === 'hash' // hash ids carry no order, skip checkpoint logic
  const cleared = !hashIds && detectCleared(checkpoint, sourceMaxVisitId)
  const processAll = hashIds || rescan || cleared
  return {
    cleared,
    processAll,
    sourceIdOffset: cleared ? rebaseOffset(checkpoint) : checkpoint.sourceIdOffset,
    skipBelow: processAll ? -1 : checkpoint.lastSourceVisitId,
  }
}

export function detectCleared(checkpoint: SyncCheckpoint, sourceMaxVisitId: number): boolean {
  return checkpoint.lastSourceVisitId > 0 && sourceMaxVisitId < checkpoint.lastSourceVisitId
}

export function rebaseOffset(checkpoint: SyncCheckpoint): number {
  return checkpoint.sourceIdOffset + checkpoint.lastSourceVisitId
}
