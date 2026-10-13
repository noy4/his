import { cn } from 'cn'

export const buttonBase = cn(
  // layout
  'inline-flex items-center gap-1.5 whitespace-nowrap select-none',
  // transition
  'transition',
  // press feedback
  'active:scale-[0.98]',
  // focus ring
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
  // disabled
  'disabled:pointer-events-none disabled:opacity-40',
)

// Sizes
const sizeSm = 'rounded-sm px-1.5 py-1 text-xs'
const sizeMd = 'rounded-sm px-3 py-1.5 text-sm'

// Skins
const skinGhost = 'text-muted hover:bg-bg-3 hover:text-text'
const skinPrimary = 'bg-primary font-medium text-white hover:opacity-90'

export const buttonPrimary = cn(buttonBase, sizeMd, skinPrimary)
export const buttonSmGhost = cn(buttonBase, sizeSm, skinGhost)
