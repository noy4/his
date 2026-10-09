import type { GithubKind, GithubVisitKind, HistoryItem } from '@/api'
import { relativeDateLabel } from '@/lib/date'
import { parseGithubUrl } from '@his/core/github'
import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'
import CloseIcon from '~icons/mdi/close'
import ListIcon from '~icons/mdi/format-list-bulleted'
import GridIcon from '~icons/mdi/view-grid-outline'
import PullIcon from '~icons/octicon/git-pull-request-16'
import IssueIcon from '~icons/octicon/issue-opened-16'
import { Row } from '../Row'
import { Card, CardTitle } from '../stats/Stats.components'
import { CardGrid, VisitCard } from './GitHub.cards'
import { GithubModel } from './github.model'
import { fmtNum } from '@/lib/format'

const KIND_OPTIONS: { value: GithubVisitKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'repo', label: 'Repos' },
  { value: 'code', label: 'Code' },
  { value: 'issue_pr', label: 'Issues/PRs' },
]

export function RecentVisits({ gh }: { gh: GithubModel }) {
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
    <div className="mt-4">
      <Card>
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
                  <VisitCard key={v.id} item={v} avatar={(owner, size) => <KindAvatar owner={owner} kind={parseGithubUrl(v.url)?.kind} size={size} />} />
                ))}
              </CardGrid>
            ) : (
              g.items.map((v) => (
                <Row key={v.id} item={v} icon={<KindAvatar owner={parseGithubUrl(v.url)?.owner ?? ''} kind={parseGithubUrl(v.url)?.kind} size={24} />} />
              ))
            )}
          </VisitsGroupRoot>
        ))}
        {hasMore && <LoadMoreButton onClick={() => gh.loadMore()} />}
      </Card>
    </div>
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

export function EmptyMessage({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      {...props}
      className={cn('py-6 text-center text-sm text-muted', className)}
    />
  )
}

export function LoadMoreButton({ children = 'Show more', className, ...props }: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      className={cn('mt-2 w-full rounded py-1.5 text-sm text-muted hover:bg-bg-3 hover:text-text', className)}
    >
      {children}
    </button>
  )
}

export function FilterChip({ selected = false, className, ...props }: ComponentProps<'button'> & { selected?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      aria-pressed={selected}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        selected
          ? 'border-primary bg-primary-soft text-primary'
          : 'text-muted hover:text-text',
        className,
      )}
    />
  )
}

type RemovableChipProps = ComponentProps<'span'> & {
  label?: ReactNode
  removeLabel?: string
  onRemove: () => void
}

export function RemovableChip({
  children,
  className,
  label,
  removeLabel = 'Remove filter',
  onRemove,
  ...props
}: RemovableChipProps) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pl-2.5 pr-0.5 text-xs font-medium text-primary',
        className,
      )}
    >
      {label ?? children}
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="-my-0.5 inline-flex shrink-0 items-center justify-center rounded-full p-1 transition-[background-color,scale] duration-150 hover:bg-primary-soft hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <CloseIcon width={12} height={12} aria-hidden="true" />
      </button>
    </span>
  )
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

export function ToggleGroupRoot({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="group"
      {...props}
      className={cn('inline-flex shrink-0 gap-0.5 rounded-sm bg-bg-3 p-0.5', className)}
    />
  )
}

export function ToggleGroupButton({ selected = false, className, ...props }: ComponentProps<'button'> & { selected?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      aria-pressed={selected}
      className={cn(
        'rounded p-1 transition-colors',
        selected
          ? 'bg-bg-2 text-text'
          : 'text-muted hover:text-text',
        className,
      )}
    />
  )
}

export function Avatar({ owner, size = 18 }: { owner: string; size?: number }) {
  return (
    <img
      src={`https://github.com/${owner}.png?size=${size * 2}`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-bg-3"
    />
  )
}

export function KindAvatar({ owner, kind, size = 18, className }: {
  owner: string
  kind?: GithubKind
  size?: number
  className?: string
}) {
  const Icon = kind === 'pull' ? PullIcon : IssueIcon
  const badge = Math.round(size * 0.6)
  return (
    <span
      className={cn('relative block shrink-0', className)}
      title={kind ? (kind === 'pull' ? 'Pull request' : 'Issue') : undefined}
    >
      <Avatar owner={owner} size={size} />
      {kind && (
        <Icon
          width={badge}
          height={badge}
          className={cn(
            'absolute -right-1 -bottom-1 rounded-full bg-bg-2 p-px',
            kind === 'pull' ? 'text-primary' : 'text-muted',
          )}
        />
      )}
    </span>
  )
}

export function Count({ n }: { n: number }) {
  return (
    <span
      title='visits count'
      className="shrink-0 font-mono text-xs text-muted tabular-nums"
    >
      {fmtNum(n)}
    </span>
  )
}
