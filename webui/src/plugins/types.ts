import type { IconComponent } from '@/components/icons'
import type { HisApi } from '@/app/api'
import type { ReactNode } from 'react'

export interface ViewContext {
  api: HisApi
}

export interface ViewPlugin {
  id: string
  label: string
  icon: IconComponent
  View: (props: { app: ViewContext }) => ReactNode
}
