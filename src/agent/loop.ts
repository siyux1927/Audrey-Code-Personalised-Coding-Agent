import type { IProvider } from '../providers/base.js'
import type { Message, ToolCallData, PermissionMode } from '../types.js'
import type { AudreyConfig } from '../config.js'
import { ALL_TOOLS } from '../tools/index.js'
import { checkToolPermission, withTimeout } from '../tools/permissions.js'

export type LoopEvent =
  | { type: 'token'; content: string }
  | { type: 'turn_done'; content: string; toolCalls: ToolCallData[] }
  | { type: 'tool_start'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; result: string; isError: boolean }
  | { type: 'done' }

export interface AgentLoopOpts {
  maxIterations?: number
  permissionMode?: PermissionMode
  requestPermission?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>
}

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
      pattern: { type: 'string', description: 'Glob pattern (e.g. src/**/*.ts). Be specific — avoid **/* without a file extension.' },
      cwd: { type: 'string', description: 'Working directory (optional)' },
    },
    required: ['pattern'],
  },
  grep: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex or string to search for (case-insensitive)' },
      glob: { type: 'string', description: 'Limit search to files matching this glob, e.g. src/**/*.ts' },
      path: { type: 'string', description: 'Root directory to search in (default: cwd)' },
    },
    required: ['pattern'],
  },
  web_search: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query for web search' },
    },
    required: ['query'],
  },
} as const

const TOOL_SPECS = () => ALL_TOOLS.map(t => ({
  name: t.name,
  description: t.description,
  parameters: PARAM_SCHEMAS[t.name as keyof typeof PARAM_SCHEMAS] ?? { type: 'object', properties: {} },
}))

export async function* agentLoop(
  messages: Message[],
  provider: IProvider,
  config: AudreyConfig,
  opts: AgentLoopOpts = {},
): AsyncGenerator<LoopEvent> {
  const { maxIterations = 8, permissionMode = 'ask', requestPermission } = opts
  const current = [...messages]

  for (let i = 0; i < maxIterations; i++) {
    let iterContent = ''
    const toolCalls: ToolCallData[] = []

    for await (const event of provider.chatWithTools(current, TOOL_SPECS())) {
      if (event.type === 'token') {
        iterContent += event.content
        yield { type: 'token', content: event.content }
      } else if (event.type === 'tool_call') {
        toolCalls.push({ id: event.id, name: event.name, args: event.args })
      }
    }

    yield { type: 'turn_done', content: iterContent, toolCalls }

    if (toolCalls.length === 0) break

    current.push({ role: 'assistant', content: iterContent, toolCalls })

    // Permission check phase (sequential — can't show two prompts at once)
    type Verdict = { call: ToolCallData; allowed: boolean }
    const verdicts: Verdict[] = []
    for (const call of toolCalls) {
      const allowed = await checkToolPermission(
        call.name, call.args, permissionMode,
        config.toolPermissions, requestPermission,
      )
      verdicts.push({ call, allowed })
    }

    // Emit tool_start for approved calls
    for (const { call, allowed } of verdicts) {
      if (allowed) yield { type: 'tool_start', id: call.id, name: call.name, args: call.args }
    }

    // Execute approved tools in parallel
    const execResults = await Promise.all(
      verdicts.map(async ({ call, allowed }) => {
        if (!allowed) {
          return { call, result: '[denied by permission policy]', isError: true }
        }
        const tool = ALL_TOOLS.find(t => t.name === call.name)
        if (!tool) {
          // Provider-managed tools (e.g. GLM web_search) execute server-side.
          // Return empty string so the model continues with its own results.
          return { call, result: '', isError: false }
        }
        try {
          const result = await withTimeout(
            tool.execute(call.args as any, config),
            config.bashTimeoutMs,
          )
          return { call, result, isError: false }
        } catch (err: any) {
          return { call, result: (err as Error).message, isError: true }
        }
      }),
    )

    // Emit results and push to context
    for (const { call, result, isError } of execResults) {
      yield { type: 'tool_result', id: call.id, name: call.name, result, isError }
      current.push({ role: 'tool', content: result.slice(0, 2000), toolCallId: call.id, toolName: call.name })
    }
  }

  yield { type: 'done' }
}
