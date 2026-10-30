import type { IconComponent } from '@/components/icons'
import type { ComponentType } from 'react'
import type { AppModel } from '@/app/app'

export interface ViewPlugin {
  id: string
  label: string
  icon: IconComponent
  View: ComponentType<{ app: AppModel }>
}
