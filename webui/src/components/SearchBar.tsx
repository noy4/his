import Magnify from '~icons/mdi/magnify'
import type { AppModel } from '@/models/app'

export function SearchBar({ app }: { app: AppModel }) {
  return (
    <label className="flex w-fit items-center gap-1.5 text-muted">
      <Magnify width={15} height={15} />
      <input
        type="search"
        placeholder="Search titles & URLs…"
        className="w-72 rounded-sm border-0 bg-surface-2 px-2 py-1 text-sm text-ink-strong outline-0 ring-1 ring-line placeholder:text-muted focus:ring-primary [&::-webkit-search-cancel-button]:appearance-none"
        value={app.filters.input.value}
        onInput={(e) => app.filters.setInput(e.currentTarget.value)}
      />
    </label>
  )
}
