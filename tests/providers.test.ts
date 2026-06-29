import { describe, it, expect, vi, afterEach } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.js'
import { DeepSeekProvider } from '../src/providers/deepseek.js'
import { GLMProvider } from '../src/providers/glm.js'
import { resolveProvider } from '../src/providers/registry.js'

describe('resolveProvider', () => {
  it('returns GLMProvider for lite', () => {
    const p = resolveProvider('lite', DEFAULT_CONFIG)
    expect(p.modelId).toBe('glm-4-flash')
    expect(p.tier).toBe('lite')
  })

  it('returns DeepSeekProvider for standard', () => {
    const p = resolveProvider('standard', DEFAULT_CONFIG)
    expect(p.modelId).toBe('deepseek-chat')
  })

  it('returns deepseek-reasoner for reason', () => {
    const p = resolveProvider('reason', DEFAULT_CONFIG)
    expect(p.modelId).toBe('deepseek-reasoner')
  })
})

describe('countTokens', () => {
  it('estimates token count from char length', () => {
    const p = new GLMProvider(DEFAULT_CONFIG)
    const msgs = [{ role: 'user' as const, content: 'hello world' }]
    expect(p.countTokens(msgs)).toBeGreaterThan(0)
  })
})

describe('BaseProvider retry', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('retries on 429 and succeeds on third attempt', async () => {
    const p = new DeepSeekProvider(DEFAULT_CONFIG, 'standard')
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls++
      if (calls < 3) {
        const err: any = new Error('rate limited')
        err.status = 429
        throw err
      }
      // Return a minimal SSE stream
      const body = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n'))
          c.close()
        },
      })
      return { ok: true, body, status: 200 }
    })
    const chunks: string[] = []
    for await (const chunk of p.chat([{ role: 'user', content: 'test' }])) {
      chunks.push(chunk)
    }
    expect(chunks.join('')).toBe('hi')
    expect(calls).toBe(3)
  })
})
