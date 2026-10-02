import FormatListBulleted from '~icons/mdi/format-list-bulleted'
import History from '~icons/mdi/history'
import Magnify from '~icons/mdi/magnify'
import { useState, type ComponentType } from 'react'
import type { IconComponent } from './components/icons'
import { AppModel } from './models/app'
import { Timeline } from './views/Timeline'
import { List } from './views/List'

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
    <div className="app">
      <header className="topbar">
        <div className="topbar-row">
          <span className="brand">
            <History width={22} height={22} />
            his
          </span>
          <nav className="switcher" aria-label="View">
            {VIEWS.map((v) => {
              const Icon = v.icon
              return (
                <button
                  key={v.id}
                  type="button"
                  className={app.view.value === v.id ? 'switch-item active' : 'switch-item'}
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
        <label className="search">
          <Magnify width={16} height={16} />
          <input
            type="search"
            placeholder="Search history…"
            value={app.query.value}
            onInput={(e) => app.setQuery(e.currentTarget.value)}
          />
        </label>
      </header>
      <main className="content">
        <Current app={app} />
      </main>
    </div>
  )
}
