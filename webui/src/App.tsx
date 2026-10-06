import type { IconComponent } from '@/components/icons'
import { AppModel } from '@/models/app'
import { Dashboard } from '@/views/Dashboard'
import { List } from '@/views/List'
import { Sources } from '@/views/sources/Sources'
import { Timeline } from '@/views/timeline/Timeline'
import { type ComponentType, type ReactNode } from 'react'
import ChartBoxOutline from '~icons/mdi/chart-box-outline'
import DatabaseImport from '~icons/mdi/database-import'
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
  { id: 'sources', label: 'Sources', icon: DatabaseImport, content: Sources },
]

export default function App() {
  const app = useModel(() => new AppModel())

  return (
    <Root>
      <Header app={app} />
      <Main app={app} />
    </Root>
  )
}

// --- components ---

function Root({ children }: { children: ReactNode }) {
  return <div className="flex h-dvh flex-col">{children}</div>
}

// Header

function Header({ app }: { app: AppModel }) {
  return (
    <HeaderRoot>
      <Brand />
      <ViewNav app={app} />
    </HeaderRoot>
  )
}

function HeaderRoot({ children }: { children: ReactNode }) {
  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-line px-4 py-2.5">
      {children}
    </header>
  )
}

function Brand() {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 font-semibold text-ink-strong">
      <History width={20} height={20} className="text-primary" />
      his
    </span>
  )
}

function ViewNav({ app }: { app: AppModel }) {
  const view = app.view.value

  return (
    <ViewNavRoot>
      {VIEWS.map((v) => (
        <ViewNavItem
          key={v.id}
          view={v}
          active={view === v.id}
          onClick={() => app.setView(v.id)}
        />
      ))}
    </ViewNavRoot>
  )
}

function ViewNavRoot({ children }: { children: ReactNode }) {
  return (
    <nav
      className="flex gap-1 rounded-sm bg-surface-2 p-0.5 text-sm"
      aria-label="View"
    >
      {children}
    </nav>
  )
}

function ViewNavItem({
  view,
  active,
  onClick,
}: {
  view: ViewDef
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded px-3 py-1 font-medium transition-colors ${active ? 'bg-surface text-ink-strong' : 'text-muted hover:text-ink-strong'
        }`}
      aria-pressed={active}
      onClick={onClick}
    >
      <view.icon width={15} height={15} />
      {view.label}
    </button>
  )
}

// Main

function Main({ app }: { app: AppModel }) {
  const view = app.view.value

  return (
    <main className="min-h-0 flex-1">
      {VIEWS.map((v) => v.id === view
        ? <v.content key={v.id} app={app} />
        : null
      )}
    </main>
  )
}
