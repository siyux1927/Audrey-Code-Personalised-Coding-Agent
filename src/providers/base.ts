import type { Message, ChatOpts, ModelTier, ToolSpec, ChatEvent } from '../types.js'
import type { AudreyConfig } from '../config.js'

export type { ToolSpec, ChatEvent }

export interface IProvider {
  readonly modelId: string
  readonly tier: ModelTier
  chat(messages: Message[], opts?: ChatOpts): AsyncIterable<string>
  chatWithTools(messages: Message[], tools: ToolSpec[], opts?: ChatOpts): AsyncIterable<ChatEvent>
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

  async *chatWithTools(
    messages: Message[],
    tools: ToolSpec[],
    opts?: ChatOpts,
  ): AsyncIterable<ChatEvent> {
    const { retryMax, retryBackoffMs } = this.config
    let attempt = 0
    while (attempt <= retryMax) {
      try {
        yield* this.chatWithToolsOnce(messages, tools, opts)
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

  protected async *chatWithToolsOnce(
    messages: Message[],
    tools: ToolSpec[],
    opts?: ChatOpts,
  ): AsyncIterable<ChatEvent> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs)
    try {
      const body: Record<string, unknown> = {
        model: this.modelId,
        messages: messages.map(m => formatMessageForApi(m)),
        stream: true,
      }
      if (opts?.maxTokens) body.max_tokens = opts.maxTokens
      if (tools.length > 0) {
        body.tools = tools.map(t => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.parameters },
        }))
      }
      const stream = await this.fetchStream(
        '/chat/completions',
        body,
        opts?.signal ?? controller.signal,
      )
      yield* this.parseSSEWithTools(stream)
    } finally {
      clearTimeout(timer)
    }
  }

  countTokens(messages: Message[]): number {
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

  protected async *parseSSEWithTools(
    stream: ReadableStream<Uint8Array>,
  ): AsyncIterable<ChatEvent> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    // Accumulate tool call arguments per index (they stream in fragments)
    const accum = new Map<number, { id: string; name: string; args: string }>()

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
          if (data === '[DONE]') {
            yield* flushToolCalls(accum)
            return
          }
          try {
            const json = JSON.parse(data)
            const choice = json.choices?.[0]
            if (!choice) continue
            const delta = choice.delta

            if (delta?.content) yield { type: 'token', content: delta.content }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx: number = tc.index ?? 0
                if (!accum.has(idx)) accum.set(idx, { id: '', name: '', args: '' })
                const entry = accum.get(idx)!
                if (tc.id) entry.id = tc.id
                if (tc.function?.name) entry.name = tc.function.name
                if (tc.function?.arguments) entry.args += tc.function.arguments
              }
            }

            if (choice.finish_reason === 'tool_calls') {
              yield* flushToolCalls(accum)
              return
            }
          } catch {}
        }
      }
      // Flush any remaining tool calls if stream ended without [DONE]
      yield* flushToolCalls(accum)
    } finally {
      reader.releaseLock()
    }
  }
}

function* flushToolCalls(
  accum: Map<number, { id: string; name: string; args: string }>,
): Iterable<ChatEvent> {
  for (const [, tc] of [...accum].sort(([a], [b]) => a - b)) {
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(tc.args) } catch {}
    yield { type: 'tool_call', id: tc.id, name: tc.name, args }
  }
  accum.clear()
}

function formatMessageForApi(m: Message): unknown {
  // Tool result message
  if (m.role === 'tool') {
    return { role: 'tool', tool_call_id: m.toolCallId ?? m.toolName ?? '', content: m.content }
  }
  // Assistant message that made tool calls
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: m.content || null,
      tool_calls: m.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      })),
    }
  }
  return { role: m.role, content: m.content }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
