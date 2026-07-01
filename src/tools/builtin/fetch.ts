const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254']
const MAX_BYTES = 512 * 1024
const TIMEOUT_MS = 15_000

function isBlockedUrl(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url)
    if (protocol !== 'http:' && protocol !== 'https:') return true
    return BLOCKED_HOSTS.some(h => hostname === h) || /^169\.254\./.test(hostname)
  } catch {
    return true
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export const fetchTool = {
  name: 'fetch',
  description: 'Fetch the content of a URL. Use for documentation, APIs, or any publicly accessible web resource. Do not use for local/internal addresses.',
  async execute(args: { url: string; method?: string; body?: string }): Promise<string> {
    if (isBlockedUrl(args.url)) {
      throw new Error(`Blocked URL: ${args.url}`)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(args.url, {
        method: args.method ?? 'GET',
        headers: { 'User-Agent': 'Audrey-Code/0.1.1' },
        body: args.body,
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)

      const contentType = res.headers.get('content-type') ?? ''
      const buf = await res.arrayBuffer()
      if (buf.byteLength > MAX_BYTES) {
        const text = new TextDecoder().decode(buf.slice(0, MAX_BYTES))
        const content = contentType.includes('html') ? stripHtml(text) : text
        return content.slice(0, 8000) + `\n\n[truncated — original size: ${buf.byteLength} bytes]`
      }

      const text = new TextDecoder().decode(buf)
      const content = contentType.includes('html') ? stripHtml(text) : text
      return content.slice(0, 8000)
    } finally {
      clearTimeout(timer)
    }
  },
}
