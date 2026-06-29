import { readFile, appendFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import os from 'os'

const INJECTION_PATTERNS = [
  '<system>',
  'ignore previous instructions',
  'ignore all previous',
  'system prompt',
  'you are now',
]

export function detectInjection(content: string): boolean {
  const lower = content.toLowerCase()
  return INJECTION_PATTERNS.some(p => lower.includes(p))
}

interface UsageEntry {
  date: string
  costCNY: number
  tokens: number
  model: string
}

export async function recordUsage(entry: UsageEntry): Promise<void> {
  const dir = join(process.env.HOME ?? os.homedir(), '.audrey')
  await mkdir(dir, { recursive: true })
  await appendFile(join(dir, 'stats.jsonl'), JSON.stringify(entry) + '\n', 'utf8')
}

export async function getTodaySpend(): Promise<number> {
  const path = join(process.env.HOME ?? os.homedir(), '.audrey', 'stats.jsonl')
  if (!existsSync(path)) return 0
  const today = new Date().toISOString().slice(0, 10)
  const lines = (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean)
  return lines.reduce((sum, line) => {
    try {
      const e = JSON.parse(line)
      return e.date === today ? sum + (e.costCNY ?? 0) : sum
    } catch { return sum }
  }, 0)
}
