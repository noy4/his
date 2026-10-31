import type { ViewPlugin } from '../types'
import { Keywords } from './Keywords'
import MagnifyIcon from '~icons/mdi/magnify'

export const keywords: ViewPlugin = {
  name: 'keywords',
  label: 'Keywords',
  icon: MagnifyIcon,
  View: Keywords,
}
