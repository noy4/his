/** Lowercased hostname; lowercased input if unparsable. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/** Hostname with a leading `www.` stripped. */
export function hostWithoutWww(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url
  } catch {
    return url
  }
}
