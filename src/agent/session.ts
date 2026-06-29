import { writeFile, readFile, readdir, stat, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import os from 'os'
import type { Message, PermissionMode } from '../types.js'
import type { AudreyConfig } from '../config.js'

export interface Session {
  id: string
  createdAt: number
  messages: Message[]
  modelOverride?: string   // model ID, e.g. 'glm-4-flash', 'deepseek-chat'
  permissionMode: PermissionMode
  modifiedFiles: string[]
}

const sessionsDir = () =>
  join(process.env.HOME ?? os.homedir(), '.audrey', 'sessions')

export function createSession(_config: AudreyConfig): Session {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
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
  return Math.min(tokens / maxTokens, 1)
}

export async function saveSession(session: Session): Promise<void> {
  const dir = sessionsDir()
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${session.id}.json`), JSON.stringify(session, null, 2), 'utf8')
}

export async function loadLastSession(): Promise<Session | null> {
  const dir = sessionsDir()
  if (!existsSync(dir)) return null
  const files = await readdir(dir)
  const jsonFiles = files.filter(f => f.endsWith('.json'))
  if (jsonFiles.length === 0) return null

  let newest = { file: '', mtime: 0 }
  for (const file of jsonFiles) {
    const { mtimeMs } = await stat(join(dir, file))
    if (mtimeMs > newest.mtime) newest = { file, mtime: mtimeMs }
  }

  const raw = await readFile(join(dir, newest.file), 'utf8')
  return JSON.parse(raw) as Session
}
