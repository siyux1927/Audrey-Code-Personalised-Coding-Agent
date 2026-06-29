export interface ParsedCommand {
  name: string
  args: string[]
}

export const KNOWN_COMMANDS = new Set([
  'model', 'cost', 'memory', 'save-memory', 'undo', 'rewind',
  'compact', 'clear', 'reset', 'diff', 'status', 'history',
  'init', 'config', 'tagline', 'parallel', 'mcp', 'resume',
  'doctor', 'bug', 'help',
])

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null
  const parts = trimmed.slice(1).split(/\s+/)
  const name = parts[0] ?? ''
  if (!KNOWN_COMMANDS.has(name)) return null
  return { name, args: parts.slice(1) }
}
