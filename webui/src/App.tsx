import type { IconComponent } from '@/components/icons'
import { AppModel } from '@/models/app'
import { Dashboard } from '@/views/Dashboard'
import { List } from '@/views/List'
import { Timeline } from '@/views/timeline/Timeline'
import { type ComponentType } from 'react'
import ChartBoxOutline from '~icons/mdi/chart-box-outline'
import FormatListBulleted from '~icons/mdi/format-list-bulleted'
import History from '~icons/mdi/history'
import { useModel } from './lib/useModel'

type ViewDef = {
  id: string
  label: string
  icon: IconComponent
  content: ComponentType<{ app: AppModel }>
}

const VIEWS: ViewDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: ChartBoxOutline, content: Dashboard },
  { id: 'timeline', label: 'Timeline', icon: History, content: Timeline },
  { id: 'list', label: 'List', icon: FormatListBulleted, content: List },
]

export default function App() {
  const app = useModel(() => new AppModel())
  const view = app.view.value

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-line px-4 py-2.5">
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
      </header>

      <main className="min-h-0 flex-1">
        {VIEWS.map((v) => v.id === view
          ? <v.content key={v.id} app={app} />
          : null
        )}
      </main>
    </div>
  )
}
