import { BaseProvider } from './base.js'
import type { Message, ChatOpts, ModelTier } from '../types.js'
import type { AudreyConfig } from '../config.js'

export class DeepSeekProvider extends BaseProvider {
  readonly modelId: string
  readonly tier: ModelTier
  protected baseUrl = 'https://api.deepseek.com/v1'
  protected apiKey: string

  constructor(config: AudreyConfig, tier: 'standard' | 'reason') {
    super(config)
    this.tier = tier
    this.modelId = tier === 'reason' ? 'deepseek-reasoner' : 'deepseek-chat'
    this.apiKey = process.env.DEEPSEEK_API_KEY ?? ''
  }

  protected async *chatOnce(messages: Message[], opts?: ChatOpts): AsyncIterable<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs)
    try {
      const stream = await this.fetchStream(
        '/chat/completions',
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
