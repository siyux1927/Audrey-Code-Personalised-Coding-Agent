import type { PermissionMode } from '../types.js'
import type { AudreyConfig } from '../config.js'

// Tools that are read-only and safe to run without prompting in ask mode
const SAFE_TOOLS = new Set(['read_file', 'grep', 'glob', 'web_search'])

export async function checkToolPermission(
  toolName: string,
  args: Record<string, unknown>,
  mode: PermissionMode,
  toolPermissions: Record<string, 'allow' | 'ask' | 'deny'> | undefined,
  requestPermission?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>,
): Promise<boolean> {
  if (mode === 'auto') return true
  if (mode === 'deny') return false

  // Per-tool override from config takes precedence
  const override = toolPermissions?.[toolName]
  if (override === 'allow') return true
  if (override === 'deny') return false

  // Safe tools auto-allow in ask mode
  if (SAFE_TOOLS.has(toolName)) return true

  // Risky tools: prompt user if callback provided, else allow
  if (!requestPermission) return true
  return requestPermission(toolName, args)
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ])
}
