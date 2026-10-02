import FormatListBulleted from '~icons/mdi/format-list-bulleted'
import History from '~icons/mdi/history'
import Magnify from '~icons/mdi/magnify'
import { useState, type ComponentType } from 'react'
import type { IconComponent } from '@/components/icons'
import { AppModel } from '@/models/app'
import { List } from '@/views/List'
import { Timeline } from '@/views/timeline/Timeline'

const VIEWS: {
  id: string
  label: string
  icon: IconComponent
  content: ComponentType<{ app: AppModel }>
}[] = [
    { id: 'timeline', label: 'Timeline', icon: History, content: Timeline },
    { id: 'list', label: 'List', icon: FormatListBulleted, content: List },
  ]

export default function App() {
  const [app] = useState(() => new AppModel())
  const Current = (VIEWS.find((v) => v.id === app.view.value) ?? VIEWS[0]).content
  return (
    <div className="mx-auto min-h-screen max-w-[720px] px-4">
      <header className="glass sticky top-0 z-10 grid gap-2.5 border-b border-line py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[1.05rem] font-bold tracking-[-0.01em] text-ink-strong">
            <History width={22} height={22} className="text-primary" />
            his
          </span>
          <nav
            className="inline-flex gap-0.5 rounded-full border border-line bg-surface p-[3px]"
            aria-label="View"
          >
            {VIEWS.map((v) => {
              const Icon = v.icon
              return (
                <button
                  key={v.id}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.8rem] font-semibold text-muted transition-colors hover:text-ink-strong aria-pressed:bg-primary-soft aria-pressed:text-primary"
                  aria-pressed={app.view.value === v.id}
                  onClick={() => app.setView(v.id)}
                >
                  <Icon width={15} height={15} />
                  {v.label}
                </button>
              )
            })}
          </nav>
        </div>
        <label className="flex items-center gap-2 rounded-[10px] border border-line bg-surface py-2 pr-3 pl-3 text-muted focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-soft">
          <Magnify width={16} height={16} />
          <input
            type="search"
            placeholder="Search history…"
            className="min-w-0 flex-1 border-0 bg-transparent outline-0 text-ink-strong placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none"
            value={app.query.value}
            onInput={(e) => app.setQuery(e.currentTarget.value)}
          />
        </label>
      </header>
      <main className="pt-5 pb-16">
        <Current app={app} />
      </main>
    </div>
  )
}
