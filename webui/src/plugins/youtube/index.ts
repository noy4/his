import type { ViewPlugin } from '../types'
import { Youtube } from '@/views/youtube/Youtube'
import YoutubeIcon from '~icons/mdi/youtube'

export const youtube: ViewPlugin = {
  id: 'youtube',
  label: 'YouTube',
  icon: YoutubeIcon,
  View: Youtube,
}
