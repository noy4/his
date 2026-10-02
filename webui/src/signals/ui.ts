import { signal } from '@preact/signals-react'

export type View = 'timeline' | 'list'

export const view = signal<View>('timeline')
export const query = signal('')
