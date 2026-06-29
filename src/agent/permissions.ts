import { resolve, normalize } from 'path'
import type { AudreyConfig } from '../config.js'
import type { PermissionMode } from '../types.js'

export type PermissionDecision = 'allow' | 'deny' | 'ask'

const ALWAYS_CONFIRM = ['rm', 'sudo', 'curl', 'wget', 'chmod', 'chown', 'dd', 'mkfs']

export function checkPathSafety(filePath: string, config: AudreyConfig): boolean {
  const normalized = normalize(resolve(filePath))
  const allowedDirs = config.allowedWriteDirs.map(d =>
    resolve(d === '$CWD' ? process.cwd() : d),
  )
  return allowedDirs.some(dir => normalized === dir || normalized.startsWith(dir + '/'))
}

export function getCommandBase(command: string): string {
  return command.trim().split(/\s+/)[0] ?? ''
}

export function isBashAllowed(
  command: string,
  mode: PermissionMode,
  config: AudreyConfig,
): PermissionDecision {
  const base = getCommandBase(command)
  if (ALWAYS_CONFIRM.includes(base)) return 'ask'
  if (mode === 'auto') return 'allow'
  if (mode === 'deny') return 'deny'
  if (config.allowedCommands.includes(base)) return 'allow'
  return 'ask'
}
