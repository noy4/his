import type { GithubVisitKind, HistoryItem } from '@/api'
import { ToggleGroupButton, ToggleGroupRoot } from '@/components/ui/toggle-group'
import { relativeDateLabel } from '@/lib/date'
import { parseGithubUrl } from '@his/core/github'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import ListIcon from '~icons/mdi/format-list-bulleted'
import GridIcon from '~icons/mdi/view-grid-outline'
import { Row } from '../Row'
import { Card, CardTitle } from '../stats/Stats.components'
import { CardGrid, VisitCard } from './GitHub.cards'
import {
  EmptyMessage,
  FilterChip,
  GitHubItemAvatar,
  LoadMoreButton,
  RemovableChip,
} from './GitHub.components'
import type { GithubModel } from './github.model'

const KIND_OPTIONS: { value: GithubVisitKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'repo', label: 'Repos' },
  { value: 'code', label: 'Code' },
  { value: 'issue_pr', label: 'Issues/PRs' },
]

export function RecentVisitsCard({ gh }: { gh: GithubModel }) {
  const f = gh.filter.value
  const k = gh.kind.value
  const shown = gh.visits.value
  const hasMore = gh.nextCursor.value !== null
  const cards = gh.view.value === 'card'
  const groups: { label: string; items: HistoryItem[] }[] = []
  for (const v of shown) {
    const label = relativeDateLabel(v.lastVisit)
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(v)
    else groups.push({ label, items: [v] })
  }

  return (
    <Card className="mt-4">
      <CardTitle>Recent Visits</CardTitle>
      <VisitsToolbarRoot>
        {KIND_OPTIONS.map((o) => (
          <FilterChip
            key={o.value}
            selected={k === o.value}
            onClick={() => gh.setKind(o.value)}
          >
            {o.label}
          </FilterChip>
        ))}
        <span className="ml-auto" />
        {f && (
          <RemovableChip
            onRemove={() => gh.setFilter(null)}
            removeLabel={`Remove filter: ${f.repo ? `${f.owner}/${f.repo}` : f.owner}`}
            label={f.repo ? `${f.owner}/${f.repo}` : f.owner}
          />
        )}
        <ViewToggle gh={gh} />
      </VisitsToolbarRoot>

      {groups.length === 0 && <VisitsEmptyMessage />}

      {groups.map((g) => (
        <VisitsGroupRoot key={g.label}>
          <VisitsGroupTitle>{g.label}</VisitsGroupTitle>
          {cards ? (
            <CardGrid>
              {g.items.map((v) => (
                <VisitCard
                  key={v.id}
                  item={v}
                  avatar={(owner, size) => (
                    <GitHubItemAvatar
                      owner={owner}
                      kind={parseGithubUrl(v.url)?.kind}
                      size={size}
                    />
                  )}
                />
              ))}
            </CardGrid>
          ) : (
            g.items.map((v) => (
              <Row
                key={v.id}
                item={v}
                icon={(
                  <GitHubItemAvatar
                    owner={parseGithubUrl(v.url)?.owner ?? ''}
                    kind={parseGithubUrl(v.url)?.kind}
                    size={24}
                  />
                )}
              />
            ))
          )}
        </VisitsGroupRoot>
      ))}
      {hasMore && <LoadMoreButton onClick={() => gh.loadMore()} />}
    </Card>
  )
}

export function VisitsToolbarRoot({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('mb-2 flex flex-wrap items-center gap-1.5', className)}
    />
  )
}

export function VisitsGroupRoot({ className, ...props }: ComponentProps<'section'>) {
  return <section {...props} className={cn('mb-2', className)} />
}

export function VisitsGroupTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      {...props}
      className={cn('sticky -top-4 z-10 bg-bg-2 py-1 text-xs font-semibold text-muted', className)}
    />
  )
}

export function VisitsEmptyMessage(props: Omit<ComponentProps<'p'>, 'children'>) {
  return <EmptyMessage {...props}>No visits</EmptyMessage>
}

function ViewToggle({ gh }: { gh: GithubModel }) {
  const v = gh.view.value
  const opts = [
    { value: 'list', label: 'List', Icon: ListIcon },
    { value: 'card', label: 'Cards', Icon: GridIcon },
  ] as const
  return (
    <ToggleGroupRoot aria-label="View">
      {opts.map(({ value, label, Icon }) => (
        <ToggleGroupButton
          key={value}
          title={label}
          aria-label={label}
          selected={v === value}
          onClick={() => gh.setView(value)}
        >
          <Icon width={14} height={14} />
        </ToggleGroupButton>
      ))}
    </ToggleGroupRoot>
  )
}
