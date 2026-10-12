import { useModel } from '@/lib/useModel'
import { AppModel } from '@/models/app'
import { UrlsModel } from '@/models/urls'
import { SearchBar } from '@/components/SearchBar'
import { HistoryRow } from '@/views/HistoryRow'

export function Urls({ app }: { app: AppModel }) {
  const {
    items,
    filters,
    loading,
    done,
    setSentinel,
  } = useModel(() => new UrlsModel(app.api))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-4 pb-3">
        <SearchBar filters={filters} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-10">
        <div className="grid">
          {items.value.map((it) => (
            <HistoryRow key={it.id} item={it} />
          ))}
        </div>
        {loading.value && <p className="py-4 text-center font-mono text-[0.75rem] text-muted">Loading…</p>}
        {done.value && items.value.length === 0 && (
          <p className="py-4 text-center font-mono text-[0.75rem] text-muted">No history</p>
        )}
        <div ref={(el) => setSentinel(el)} aria-hidden="true" />
      </div>
    </div>
  )
}
