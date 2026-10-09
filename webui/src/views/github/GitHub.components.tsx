import type { GithubKind } from '@/api'
import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'
import CloseIcon from '~icons/mdi/close'
import PullIcon from '~icons/octicon/git-pull-request-16'
import IssueIcon from '~icons/octicon/issue-opened-16'
import { fmtNum } from '@/lib/format'

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
