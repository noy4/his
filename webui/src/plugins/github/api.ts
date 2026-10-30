import type { GithubSearchParams, GithubStats, SearchPage, StatsParams } from '@his/core'
import type { RpcCall } from '@/lib/rpc-transport'

export function githubApi(rpc: RpcCall) {
  return {
    stats: (params?: StatsParams) => rpc<GithubStats>('github.stats', params),
    search: (params: GithubSearchParams) => rpc<SearchPage>('github.search', params),
  }
}
