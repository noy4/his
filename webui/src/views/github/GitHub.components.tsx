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

type GitHubAvatarProps = {
  owner: string
  size?: number
  className?: string
}

export function GitHubAvatar({ owner, size = 18, className }: GitHubAvatarProps) {
  return (
    <img
      src={`https://github.com/${owner}.png?size=${size * 2}`}
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0 rounded-full bg-bg-3', className)}
    />
  )
}

export function GitHubKindAvatar({ owner, kind, size = 18, className }: GitHubAvatarProps & { kind: GithubKind }) {
  const Icon = kind === 'pull' ? PullIcon : IssueIcon
  const badgeSize = Math.round(size * 0.6)
  return (
    <span
      className={cn('relative block shrink-0', className)}
      title={kind === 'pull' ? 'Pull request' : 'Issue'}
    >
      <GitHubAvatar owner={owner} size={size} />
      <Icon
        width={badgeSize}
        height={badgeSize}
        className={cn(
          'absolute -right-1 -bottom-1 rounded-full bg-bg-2 p-px',
          kind === 'pull' ? 'text-primary' : 'text-muted',
        )}
      />
    </span>
  )
}

export function GitHubItemAvatar({ kind, ...props }: GitHubAvatarProps & { kind?: GithubKind }) {
  return kind
    ? <GitHubKindAvatar {...props} kind={kind} />
    : <GitHubAvatar {...props} />
}

export function VisitCount({ n }: { n: number }) {
  return (
    <span
      title='visit count'
      className="shrink-0 font-mono text-xs text-muted tabular-nums"
    >
      {fmtNum(n)}
    </span>
  )
}
