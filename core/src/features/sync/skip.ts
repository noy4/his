import type { IdMode, NormalizedVisit, SyncCheckpoint } from '../../types.ts'

// flow policy for one ingest, decided before touching any rows
export interface SkipDecision {
  cleared: boolean
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
export function computeSkip({ checkpoint, sourceMaxVisitId, idMode, rescan }: ComputeSkipParams): SkipDecision {
  const hashIds = idMode === 'hash' // hash ids carry no order, skip checkpoint logic
  const cleared = !hashIds && detectCleared(checkpoint, sourceMaxVisitId)
  const processAll = hashIds || rescan || cleared
  return {
    cleared,
    sourceIdOffset: cleared ? rebaseOffset(checkpoint) : checkpoint.sourceIdOffset,
    skipBelow: processAll ? -1 : checkpoint.lastSourceVisitId,
  }
}

export type IngestPlan = Omit<SkipDecision, 'skipBelow'> & {
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
  const { cleared, sourceIdOffset, skipBelow } = computeSkip({
    checkpoint,
    sourceMaxVisitId,
    idMode,
    rescan,
  })
  return {
    cleared,
    sourceIdOffset,
    sourceMaxVisitId,
    candidates: visits.filter((visit) => visit.sourceVisitId > skipBelow),
  }
}

export function detectCleared(checkpoint: SyncCheckpoint, sourceMaxVisitId: number): boolean {
  return checkpoint.lastSourceVisitId > 0 && sourceMaxVisitId < checkpoint.lastSourceVisitId
}

export function rebaseOffset(checkpoint: SyncCheckpoint): number {
  return checkpoint.sourceIdOffset + checkpoint.lastSourceVisitId
}
