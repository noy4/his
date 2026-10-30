import type { SearchPage, StatsParams, YoutubeSearchParams, YoutubeStats } from '@his/core'
import type { RpcCall } from '@/lib/rpc-transport'

export function youtubeApi(rpc: RpcCall) {
  return {
    stats: (params?: StatsParams) => rpc<YoutubeStats>('youtube.stats', params),
    search: (params: YoutubeSearchParams) => rpc<SearchPage>('youtube.search', params),
  }
}
