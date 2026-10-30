import type { ViewPlugin } from '../types'
import { Github } from '@/views/github/Github'
import GithubIcon from '~icons/mdi/github'

export const github: ViewPlugin = {
  id: 'github',
  label: 'GitHub',
  icon: GithubIcon,
  View: Github,
}
