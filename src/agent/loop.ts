import type { IProvider } from '../providers/base.js'
import type { Message, ToolCallData } from '../types.js'
import type { AudreyConfig } from '../config.js'
import { ALL_TOOLS } from '../tools/index.js'

export type LoopEvent =
  | { type: 'token'; content: string }
  | { type: 'turn_done'; content: string; toolCalls: ToolCallData[] }
  | { type: 'tool_start'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; result: string; isError: boolean }
  | { type: 'done' }

const PARAM_SCHEMAS = {
  read_file: {
    type: 'object',
    properties: { path: { type: 'string', description: 'Absolute or relative file path' } },
    required: ['path'],
  },
  write_file: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write' },
      content: { type: 'string', description: 'File content' },
    },
    required: ['path', 'content'],
  },
  bash: {
    type: 'object',
    properties: { command: { type: 'string', description: 'Shell command to execute' } },
    required: ['command'],
  },
  glob: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g. src/**/*.ts)' },
      cwd: { type: 'string', description: 'Working directory (optional)' },
    },
    required: ['pattern'],
  },
} as const

const TOOL_SPECS = ALL_TOOLS.map(t => ({
  name: t.name,
  description: t.description,
  parameters: PARAM_SCHEMAS[t.name as keyof typeof PARAM_SCHEMAS] ?? { type: 'object', properties: {} },
}))

export async function* agentLoop(
  messages: Message[],
  provider: IProvider,
  config: AudreyConfig,
  maxIterations = 8,
): AsyncGenerator<LoopEvent> {
  const current = [...messages]

  for (let i = 0; i < maxIterations; i++) {
    let iterContent = ''
    const toolCalls: ToolCallData[] = []

    for await (const event of provider.chatWithTools(current, TOOL_SPECS)) {
      if (event.type === 'token') {
        iterContent += event.content
        yield { type: 'token', content: event.content }
      } else if (event.type === 'tool_call') {
        toolCalls.push({ id: event.id, name: event.name, args: event.args })
      }
    }

    yield { type: 'turn_done', content: iterContent, toolCalls }

    if (toolCalls.length === 0) break

    // Add assistant turn with tool calls to context
    current.push({
      role: 'assistant',
      content: iterContent,
      toolCalls,
    })

    // Execute each tool and add result to context
    for (const call of toolCalls) {
      yield { type: 'tool_start', id: call.id, name: call.name, args: call.args }
      const tool = ALL_TOOLS.find(t => t.name === call.name)
      try {
        const result = tool
          ? await tool.execute(call.args as any, config)
          : `Unknown tool: ${call.name}`
        yield { type: 'tool_result', id: call.id, name: call.name, result, isError: false }
        current.push({ role: 'tool', content: result, toolCallId: call.id, toolName: call.name })
      } catch (err: any) {
        const msg = (err as Error).message
        yield { type: 'tool_result', id: call.id, name: call.name, result: msg, isError: true }
        current.push({ role: 'tool', content: msg, toolCallId: call.id, toolName: call.name })
      }
    }
  }

  yield { type: 'done' }
}
