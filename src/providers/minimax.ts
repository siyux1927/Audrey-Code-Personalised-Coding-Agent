import { BaseProvider } from './base.js'
import type { Message, ChatOpts, ModelTier } from '../types.js'
import type { AudreyConfig } from '../config.js'

export class MiniMaxProvider extends BaseProvider {
  readonly modelId = 'MiniMax-Text-01'
  readonly tier: ModelTier = 'standard'
  protected baseUrl = 'https://api.minimax.chat/v1'
  protected apiKey: string

  constructor(config: AudreyConfig) {
    super(config)
    this.apiKey = process.env.MINIMAX_API_KEY ?? ''
  }

  protected async *chatOnce(messages: Message[], opts?: ChatOpts): AsyncIterable<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs)
    try {
      const stream = await this.fetchStream(
        '/text/chatcompletion_v2',
        {
          model: this.modelId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: opts?.maxTokens ?? 4096,
          stream: true,
        },
        opts?.signal ?? controller.signal,
      )
      yield* this.parseSSE(stream)
    } finally {
      clearTimeout(timer)
    }
  }
}
