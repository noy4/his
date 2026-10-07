const LOCAL_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|::1|fe80:[0-9a-f:]*|\[::1\])$/i

export function isLocalDomain(host: string): boolean {
  return LOCAL_HOST.test(host) || host.toLowerCase().endsWith('.local')
}
