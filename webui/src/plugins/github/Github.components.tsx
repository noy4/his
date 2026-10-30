import type { GithubKind } from '@/app/api'
import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'
import CloseIcon from '~icons/mdi/close'
import PullIcon from '~icons/octicon/git-pull-request-16'
import IssueIcon from '~icons/octicon/issue-opened-16'

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

type GithubAvatarProps = {
  owner: string
  size?: number
  className?: string
}

export function GithubAvatar({ owner, size = 18, className }: GithubAvatarProps) {
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

export function GithubKindAvatar({ owner, kind, size = 18, className }: GithubAvatarProps & { kind: GithubKind }) {
  const Icon = kind === 'pull' ? PullIcon : IssueIcon
  const badgeSize = Math.round(size * 0.6)
  return (
    <span
      className={cn('relative block shrink-0', className)}
      title={kind === 'pull' ? 'Pull request' : 'Issue'}
    >
      <GithubAvatar owner={owner} size={size} />
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

export function GithubItemAvatar({ kind, ...props }: GithubAvatarProps & { kind?: GithubKind }) {
  return kind
    ? <GithubKindAvatar {...props} kind={kind} />
    : <GithubAvatar {...props} />
}
