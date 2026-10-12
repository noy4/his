import type { IconComponent } from '@/components/icons'
import { AppModel } from '@/models/app'
import { Dashboard } from '@/views/dashboard/Dashboard'
import { GitHub } from '@/views/github/GitHub'
import { Urls } from '@/views/urls/Urls'
import { Sources } from '@/views/sources/Sources'
import { Visits } from '@/views/visits/Visits'
import { type ComponentType, type ReactNode } from 'react'
import ChartBoxOutline from '~icons/mdi/chart-box-outline'
import DatabaseImport from '~icons/mdi/database-import'
import GithubIcon from '~icons/mdi/github'
import LinkVariant from '~icons/mdi/link-variant'
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
  { id: 'visits', label: 'Visits', icon: History, content: Visits },
  { id: 'urls', label: 'URLs', icon: LinkVariant, content: Urls },
  { id: 'github', label: 'GitHub', icon: GithubIcon, content: GitHub },
  { id: 'sources', label: 'Sources', icon: DatabaseImport, content: Sources },
]

export default function App() {
  const app = useModel(() => new AppModel())
  const CurrentView = VIEWS.find((v) => v.id === app.view.value)?.content

  return (
    <Root>
      <HeaderRoot>
        <Brand />
        <ViewNav app={app} />
      </HeaderRoot>
      <MainRoot>
        {CurrentView && (
          <CurrentView app={app} />
        )}
      </MainRoot>
    </Root>
  )
}

// --- components ---

function Root({ children }: { children: ReactNode }) {
  return <div className="flex h-dvh flex-col">{children}</div>
}

// Header

function HeaderRoot({ children }: { children: ReactNode }) {
  return (
    <header className="flex shrink-0 items-center gap-4 border-b px-4 py-2.5">
      {children}
    </header>
  )
}

function Brand() {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 font-semibold">
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
      className="flex gap-1 rounded-sm bg-bg-3 p-0.5 text-sm"
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
      className={`inline-flex items-center gap-1.5 rounded px-3 pl-2.5 py-1 font-medium transition-colors ${active ? 'bg-bg-2 text-text' : 'text-muted hover:text-text'
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

function MainRoot({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-0 flex-1">
      {children}
    </main>
  )
}
