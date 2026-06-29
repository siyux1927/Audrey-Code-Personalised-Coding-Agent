export type ModelTier = 'lite' | 'standard' | 'reason'
export type PermissionMode = 'ask' | 'auto' | 'deny'

export interface ToolCallData {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolName?: string
  toolCalls?: ToolCallData[]  // assistant messages that called tools
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  content: string
  isError: boolean
}

export interface ToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type ChatEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }

export interface ChatOpts {
  maxTokens?: number
  signal?: AbortSignal
}

export interface McpServerConfig {
  command: string
  args: string[]
  autoStart: boolean
}
