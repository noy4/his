import Magnify from '~icons/mdi/magnify'
import type { FilterModel } from '@/lib/signal/filter'

export function SearchBar({ filters }: { filters: FilterModel }) {
  return (
    <label className="flex w-fit items-center gap-1.5 text-muted">
      <Magnify width={15} height={15} />
      <input
        type="search"
        placeholder="Search titles & URLs…"
        className="w-72 rounded-sm border-0 bg-bg-3 px-2 py-1 text-sm  outline-0 ring-1 ring-border-2 placeholder:text-muted focus:ring-primary [&::-webkit-search-cancel-button]:appearance-none"
        value={filters.input.value}
        onInput={(e) => filters.setInput(e.currentTarget.value)}
      />
    </label>
  )
}
