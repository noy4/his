import type { CSSProperties } from 'react'
import type { HistoryItem } from '../api'
import { timeLabel } from '../lib/dates'

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function tileStyle(host: string): CSSProperties {
  let h = 0
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) % 360
  return { background: `hsl(${h}, 30%, 34%)`, color: `hsl(${h}, 60%, 88%)` }
}

export function Row({ item }: { item: HistoryItem }) {
  const host = hostOf(item.url)
  return (
    <a className="row" href={item.url} target="_blank" rel="noreferrer">
      <span className="row-tile" style={tileStyle(host)} aria-hidden="true">
        {host.charAt(0).toUpperCase()}
      </span>
      <span className="row-main">
        <span className="row-title">{item.title || item.url}</span>
        <span className="row-url">{item.url}</span>
      </span>
      <span className="row-side">
        {item.visitCount > 1 && <span className="row-count">{item.visitCount}</span>}
        <time className="row-time">{timeLabel(item.lastVisit)}</time>
      </span>
    </a>
  )
}
