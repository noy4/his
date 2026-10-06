import type { SVGProps } from 'react'
import ArcIcon from '~icons/logos/arc'
import BraveIcon from '~icons/logos/brave'
import ChromeIcon from '~icons/logos/chrome'
import EdgeIcon from '~icons/logos/microsoft-edge'
import FirefoxIcon from '~icons/logos/firefox'
import OperaIcon from '~icons/logos/opera'
import SafariIcon from '~icons/logos/safari'
import VivaldiIcon from '~icons/logos/vivaldi-icon'
import TakeoutIcon from '~icons/mdi/file-download-outline'
import WebIcon from '~icons/mdi/web'

// browser slug → brand icon
const BROWSER_ICON_MAP: Record<string, typeof ChromeIcon> = {
  chrome: ChromeIcon,
  chromium: ChromeIcon,
  edge: EdgeIcon,
  brave: BraveIcon,
  vivaldi: VivaldiIcon,
  arc: ArcIcon,
  opera: OperaIcon,
  'opera-gx': OperaIcon,
  firefox: FirefoxIcon,
  safari: SafariIcon,
  takeout: TakeoutIcon,
}

export function BrowserIcon({ browser, ...rest }: { browser: string } & SVGProps<SVGSVGElement>) {
  const Icon = BROWSER_ICON_MAP[browser] ?? WebIcon
  return <Icon {...rest} />
}
