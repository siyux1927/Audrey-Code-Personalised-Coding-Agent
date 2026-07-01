const DDG_API = 'https://api.duckduckgo.com/'
const DDG_HTML = 'https://html.duckduckgo.com/html/'
const TIMEOUT_MS = 10_000

async function ddgInstant(query: string): Promise<string | null> {
  const url = `${DDG_API}?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Audrey-Code/0.1.1' },
      signal: controller.signal,
    })
    const data = await res.json() as Record<string, any>
    const lines: string[] = []

    if (data.AbstractText) {
      lines.push(`${data.AbstractText}`)
      if (data.AbstractURL) lines.push(`Source: ${data.AbstractURL}`)
    }

    const topics: any[] = data.RelatedTopics ?? []
    const results = topics
      .filter((t: any) => t.Text && t.FirstURL)
      .slice(0, 5)

    if (results.length > 0) {
      if (lines.length) lines.push('')
      lines.push('Related:')
      for (const r of results) {
        lines.push(`• ${r.Text.slice(0, 120)}`)
        lines.push(`  ${r.FirstURL}`)
      }
    }

    return lines.length > 0 ? lines.join('\n') : null
  } finally {
    clearTimeout(timer)
  }
}

async function ddgHtmlFallback(query: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(DDG_HTML, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible)',
      },
      body: `q=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })
    const html = await res.text()

    // Extract result snippets from DuckDuckGo HTML response
    const snippetRe = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
    const titleRe = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

    const titles: { href: string; text: string }[] = []
    const snippets: string[] = []

    let m: RegExpExecArray | null
    while ((m = titleRe.exec(html)) !== null) {
      titles.push({ href: m[1]!, text: stripTags(m[2]!) })
      if (titles.length >= 5) break
    }
    while ((m = snippetRe.exec(html)) !== null) {
      snippets.push(stripTags(m[1]!))
      if (snippets.length >= 5) break
    }

    if (titles.length === 0) return 'No results found.'

    const lines: string[] = []
    for (let i = 0; i < titles.length; i++) {
      const t = titles[i]!
      lines.push(`${i + 1}. ${t.text}`)
      if (snippets[i]) lines.push(`   ${snippets[i].slice(0, 200)}`)
      lines.push(`   ${t.href}`)
    }
    return lines.join('\n')
  } finally {
    clearTimeout(timer)
  }
}

export const searchTool = {
  name: 'search',
  description: 'Search the web using DuckDuckGo. Use for current information, documentation, or anything outside your training data.',
  async execute(args: { query: string }): Promise<string> {
    const instant = await ddgInstant(args.query)
    if (instant) return instant
    return ddgHtmlFallback(args.query)
  },
}
