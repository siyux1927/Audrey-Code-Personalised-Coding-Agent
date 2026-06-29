import type { Message, ChatOpts, ModelTier } from '../types.js'
import type { AudreyConfig } from '../config.js'

export interface IProvider {
  readonly modelId: string
  readonly tier: ModelTier
  chat(messages: Message[], opts?: ChatOpts): AsyncIterable<string>
  countTokens(messages: Message[]): number
}

export abstract class BaseProvider implements IProvider {
  abstract readonly modelId: string
  abstract readonly tier: ModelTier

  protected abstract baseUrl: string
  protected abstract apiKey: string
  protected config: AudreyConfig

  constructor(config: AudreyConfig) {
    this.config = config
  }

  async *chat(messages: Message[], opts?: ChatOpts): AsyncIterable<string> {
    const { retryMax, retryBackoffMs } = this.config
    let attempt = 0
    while (attempt <= retryMax) {
      try {
        yield* this.chatOnce(messages, opts)
        return
      } catch (err: any) {
        const retryable = err.status === 429 || (err.status >= 500 && err.status < 600)
        if (!retryable || attempt === retryMax) throw err
        await sleep(retryBackoffMs * 2 ** attempt)
        attempt++
      }
    }
  }

  protected abstract chatOnce(messages: Message[], opts?: ChatOpts): AsyncIterable<string>

  countTokens(messages: Message[]): number {
    // rough estimate: 1 token ≈ 3.5 chars for Chinese/English mix
    const chars = messages.reduce((sum, m) => sum + m.content.length, 0)
    return Math.ceil(chars / 3.5)
  }

  protected async fetchStream(
    path: string,
    body: object,
    signal?: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) {
      const text = await res.text()
      const err: any = new Error(`HTTP ${res.status}: ${text}`)
      err.status = res.status
      throw err
    }
    return res.body!
  }

  protected async *parseSSE(stream: ReadableStream<Uint8Array>): AsyncIterable<string> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()!
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') return
          try {
            const json = JSON.parse(data)
            const delta = json.choices?.[0]?.delta?.content
            if (delta) yield delta
          } catch {}
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
