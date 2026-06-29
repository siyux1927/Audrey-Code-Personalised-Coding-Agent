import type { IProvider } from '../providers/base.js'
import type { Message } from '../types.js'
import type { AudreyConfig } from '../config.js'

export interface SubTask {
  id: string
  prompt: string
  provider: IProvider
  context?: Message[]
}

export interface SubResult {
  id: string
  output: string
  success: boolean
  error?: string
}

export async function runSubAgents(
  tasks: SubTask[],
  config: AudreyConfig,
  depth = 0,
): Promise<SubResult[]> {
  if (depth > 2) throw new Error('Sub-agent depth limit exceeded (max 2)')
  const limited = tasks.slice(0, config.maxConcurrentAgents)
  return Promise.all(limited.map(task => runOne(task, config)))
}

async function runOne(task: SubTask, config: AudreyConfig): Promise<SubResult> {
  const controller = new AbortController()
  const messages: Message[] = [
    ...(task.context ?? []),
    { role: 'user', content: task.prompt },
  ]

  const chatPromise = (async () => {
    let output = ''
    for await (const chunk of task.provider.chat(messages, { signal: controller.signal })) {
      output += chunk
    }
    return output
  })()

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Sub-agent timed out')), config.subagentTimeoutMs),
  )

  try {
    const output = await Promise.race([chatPromise, timeoutPromise])
    return { id: task.id, output, success: true }
  } catch (err: any) {
    controller.abort()
    return { id: task.id, output: '', success: false, error: err.message }
  }
}
