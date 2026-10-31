import type { KeywordSearchParams, KeywordStats, SearchPage, StatsParams } from '@his/core'
import type { RpcCall } from '@/lib/rpc-transport'

export function keywordsApi(rpc: RpcCall) {
  return {
    stats: (params?: StatsParams) => rpc<KeywordStats>('keywords.stats', params),
    search: (params: KeywordSearchParams) => rpc<SearchPage>('keywords.search', params),
  }
}
