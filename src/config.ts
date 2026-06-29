import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import os from 'os'
import type { McpServerConfig } from './types.js'

export interface AudreyConfig {
  dailyBudgetCNY: number
  sessionMaxTokens: number
  contextWarningAt: number
  bashTimeoutMs: number
  subagentTimeoutMs: number
  maxConcurrentAgents: number
  maxFileInjectTokens: number
  retryMax: number
  retryBackoffMs: number
  requestTimeoutMs: number
  snapshotMaxCount: number
  sessionHistoryMax: number
  storageWarnMB: number
  allowedWriteDirs: string[]
  allowedCommands: string[]
  tagline: string
  memoryMaxTokens: number
  mcpServers: Record<string, McpServerConfig>
}

export const DEFAULT_CONFIG: AudreyConfig = {
  dailyBudgetCNY: 10,
  sessionMaxTokens: 60000,
  contextWarningAt: 0.7,
  bashTimeoutMs: 30000,
  subagentTimeoutMs: 60000,
  maxConcurrentAgents: 5,
  maxFileInjectTokens: 8000,
  retryMax: 3,
  retryBackoffMs: 1000,
  requestTimeoutMs: 30000,
  snapshotMaxCount: 100,
  sessionHistoryMax: 30,
  storageWarnMB: 500,
  allowedWriteDirs: ['$CWD'],
  allowedCommands: ['npm', 'git', 'node', 'tsc', 'npx'],
  tagline: '实习摸鱼，努力学习',
  memoryMaxTokens: 2000,
  mcpServers: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '$CWD'],
      autoStart: true,
    },
    fetch: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      autoStart: true,
    },
    'sequential-thinking': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      autoStart: false,
    },
  },
}

const audreyDir = () => join(process.env.HOME ?? os.homedir(), '.audrey')
const configPath = () => join(audreyDir(), 'config.json')

export async function ensureAudreyDir(): Promise<void> {
  await mkdir(audreyDir(), { recursive: true })
  await mkdir(join(audreyDir(), 'sessions'), { recursive: true })
  await mkdir(join(audreyDir(), 'snapshots'), { recursive: true })
}

export async function loadConfig(): Promise<AudreyConfig> {
  const path = configPath()
  if (!existsSync(path)) return { ...DEFAULT_CONFIG }
  const raw = await readFile(path, 'utf8')
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
}

export async function saveConfig(cfg: AudreyConfig): Promise<void> {
  await ensureAudreyDir()
  await writeFile(configPath(), JSON.stringify(cfg, null, 2), 'utf8')
}
