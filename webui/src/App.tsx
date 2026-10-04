import { useState, type ComponentType } from 'react'
import type { IconComponent } from '@/components/icons'
import ChartBoxOutline from '~icons/mdi/chart-box-outline'
import FormatListBulleted from '~icons/mdi/format-list-bulleted'
import History from '~icons/mdi/history'
import Magnify from '~icons/mdi/magnify'
import { AppModel } from '@/models/app'
import { Dashboard } from '@/views/Dashboard'
import { List } from '@/views/List'
import { Timeline } from '@/views/timeline/Timeline'

const VIEWS: {
  id: string
  label: string
  icon: IconComponent
  content: ComponentType<{ app: AppModel }>
}[] = [
    { id: 'dashboard', label: 'Dashboard', icon: ChartBoxOutline, content: Dashboard },
    { id: 'timeline', label: 'Timeline', icon: History, content: Timeline },
    { id: 'list', label: 'List', icon: FormatListBulleted, content: List },
  ]

export default function App() {
  const [app] = useState(() => new AppModel())
  const view = app.view.value
  const Current = (VIEWS.find((v) => v.id === view) ?? VIEWS[0]).content
  return (
    <div className="min-h-screen px-4">

      <header className="glass sticky top-0 z-10 grid gap-2.5 border-b border-line py-2.5">
        <div className="flex items-center gap-4">
          <span className="inline-flex shrink-0 items-center gap-2 text-[0.95rem] font-semibold tracking-[-0.01em] text-ink-strong">
            <History width={20} height={20} className="text-primary" />
            his
          </span>
          <nav
            className="flex gap-1 rounded-sm bg-surface-2 p-0.5 text-sm"
            aria-label="View"
          >
            {VIEWS.map((v) => {
              const Icon = v.icon
              const active = view === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  className={`inline-flex items-center gap-1.5 rounded px-3 py-1 font-medium transition-colors ${active ? 'bg-surface text-ink-strong' : 'text-muted hover:text-ink-strong'
                    }`}
                  aria-pressed={active}
                  onClick={() => app.setView(v.id)}
                >
                  <Icon width={15} height={15} />
                  {v.label}
                </button>
              )
            })}
          </nav>
        </div>
        {view !== 'dashboard' && (
          <label className="flex items-center gap-2 rounded-[10px] border border-line bg-surface py-2 pr-3 pl-3 text-muted focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-soft">
            <Magnify width={16} height={16} />
            <input
              type="search"
              placeholder="Search history…"
              className="min-w-0 flex-1 border-0 bg-transparent outline-0 text-ink-strong placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none"
              value={app.filters.input.value}
              onInput={(e) => app.filters.setInput(e.currentTarget.value)}
            />
          </label>
        )}
      </header>
      <main className="pt-5 pb-16">
        <Current app={app} />
      </main>
    </div>
  )
}
