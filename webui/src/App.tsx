import IconMdiFormatListBulleted from '~icons/mdi/format-list-bulleted'
import IconMdiHistory from '~icons/mdi/history'
import IconMdiMagnify from '~icons/mdi/magnify'
import { query, view, type View } from './signals/ui'
import { Timeline } from './views/Timeline'
import { List } from './views/List'

const VIEWS: { id: View; label: string; icon: typeof IconMdiHistory }[] = [
  { id: 'timeline', label: 'Timeline', icon: IconMdiHistory },
  { id: 'list', label: 'List', icon: IconMdiFormatListBulleted },
]

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-row">
          <span className="brand">
            <IconMdiHistory width={22} height={22} />
            his
          </span>
          <nav className="switcher" aria-label="View">
            {VIEWS.map((v) => {
              const Icon = v.icon
              return (
                <button
                  key={v.id}
                  type="button"
                  className={view.value === v.id ? 'switch-item active' : 'switch-item'}
                  aria-pressed={view.value === v.id}
                  onClick={() => (view.value = v.id)}
                >
                  <Icon width={15} height={15} />
                  {v.label}
                </button>
              )
            })}
          </nav>
        </div>
        <label className="search">
          <IconMdiMagnify width={16} height={16} />
          <input
            type="search"
            placeholder="Search history…"
            value={query.value}
            onInput={(e) => (query.value = e.currentTarget.value)}
          />
        </label>
      </header>
      <main className="content">
        {view.value === 'timeline' ? <Timeline /> : <List />}
      </main>
    </div>
  )
}
