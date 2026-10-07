import type { CSSProperties } from 'react'
import { isLocalDomain } from '@/lib/domain'
import Lock from '~icons/mdi/lock'

/** Hosts whose dark, transparent favicons are hard to see on dark backgrounds */
const WHITE_BG_HOSTS = /(^|\.)github\.com$/

function tileStyle(host: string): CSSProperties {
  let h = 0
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) % 360
  return { background: `hsl(${h}, 30%, 34%)`, color: `hsl(${h}, 60%, 88%)` }
}

export function Favicon({ host, size = 30 }: { host: string; size?: number }) {
  if (isLocalDomain(host)) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Lock
          width={size * 0.8}
          height={size * 0.8}
          className="text-text-2"
        />
      </span>
    )
  }
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md font-bold select-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.5),
        ...tileStyle(host),
      }}
      aria-hidden="true"
    >
      <RemoteIcon host={host} />
    </span>
  )
}

function RemoteIcon({ host }: { host: string }) {
  return (
    <>
      <span className="tile-letter">{host.charAt(0).toUpperCase()}</span>
      <img
        className="absolute inset-0 h-full w-full object-contain p-0.5"
        src={`https://${host}/favicon.ico`}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
        onLoad={(e) => {
          const img = e.currentTarget
          if (img.naturalWidth === 0) {
            img.style.display = 'none'
            return
          }
          const tile = img.parentElement as HTMLElement
          const letter = img.previousElementSibling as HTMLElement
          tile.style.background = WHITE_BG_HOSTS.test(host) ? '#fff' : 'transparent'
          letter.style.display = 'none'
        }}
      />
    </>
  )
}
