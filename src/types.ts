export type ModelTier = 'lite' | 'standard' | 'reason'
export type PermissionMode = 'ask' | 'auto' | 'deny'

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolName?: string
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

export interface ChatOpts {
  maxTokens?: number
  signal?: AbortSignal
}

export interface McpServerConfig {
  command: string
  args: string[]
  autoStart: boolean
}
