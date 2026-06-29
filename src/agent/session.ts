import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import os from 'os'
import type { Message, ModelTier, PermissionMode } from '../types.js'
import type { AudreyConfig } from '../config.js'

export interface Session {
  id: string
  startedAt: string
  messages: Message[]
  modelOverride?: ModelTier
  permissionMode: PermissionMode
  modifiedFiles: string[]
}

const lastSessionPath = () => join(process.env.HOME ?? os.homedir(), '.audrey', 'sessions', 'last.json')

export function createSession(config: AudreyConfig): Session {
  return {
    id: Date.now().toString(),
    startedAt: new Date().toISOString(),
    messages: [],
    permissionMode: 'ask',
    modifiedFiles: [],
  }
}

export function addMessage(session: Session, msg: Message): Session {
  return { ...session, messages: [...session.messages, msg] }
}

export function getContextUsage(session: Session, maxTokens: number): number {
  const chars = session.messages.reduce((sum, m) => sum + m.content.length, 0)
  const tokens = Math.ceil(chars / 3.5)
  return tokens / maxTokens
}

export async function saveSession(session: Session): Promise<void> {
  await writeFile(lastSessionPath(), JSON.stringify(session, null, 2), 'utf8')
}

export async function loadLastSession(): Promise<Session | null> {
  const path = lastSessionPath()
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw) as Session
}
