import { query, view, type View } from './signals/ui'
import { Timeline } from './views/Timeline'
import { List } from './views/List'
import { ClockIcon, ListIcon, SearchIcon } from './components/icons'

const VIEWS: { id: View; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'list', label: 'List' },
]

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-row">
          <span className="brand">
            <ClockIcon size={20} />
            his
          </span>
          <nav className="switcher" aria-label="View">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={view.value === v.id ? 'switch-item active' : 'switch-item'}
                aria-pressed={view.value === v.id}
                onClick={() => (view.value = v.id)}
              >
                {v.id === 'timeline' ? <ClockIcon size={15} /> : <ListIcon size={15} />}
                {v.label}
              </button>
            ))}
          </nav>
        </div>
        <label className="search">
          <SearchIcon />
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
