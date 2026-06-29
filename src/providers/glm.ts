import { BaseProvider } from './base.js'
import type { Message, ChatOpts, ModelTier } from '../types.js'
import type { AudreyConfig } from '../config.js'

export class GLMProvider extends BaseProvider {
  readonly modelId: string
  readonly tier: ModelTier = 'lite'
  protected baseUrl = 'https://open.bigmodel.cn/api/paas/v4'
  protected apiKey: string

  constructor(config: AudreyConfig, modelId = 'glm-4-flash') {
    super(config)
    this.modelId = modelId
    this.apiKey = process.env.GLM_API_KEY ?? ''
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
