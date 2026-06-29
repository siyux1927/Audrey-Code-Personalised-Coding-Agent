import { readdirSync, statSync, unlinkSync, renameSync } from 'fs'
import { join } from 'path'
import os from 'os'
import type { AudreyConfig } from '../config.js'

export async function rotateStorage(config: AudreyConfig): Promise<void> {
  const base = join(process.env.HOME ?? os.homedir(), '.audrey')
  rotateDir(join(base, 'snapshots'), config.snapshotMaxCount)
  rotateDir(join(base, 'sessions'), config.sessionHistoryMax)

  const statsPath = join(base, 'stats.jsonl')
  try {
    const size = statSync(statsPath).size
    if (size > 10 * 1024 * 1024) {
      renameSync(statsPath, join(base, `stats-${Date.now()}.jsonl`))
    }
  } catch {}
}

function rotateDir(dir: string, max: number): void {
  try {
    const files = readdirSync(dir).sort()
    if (files.length > max) {
      for (const f of files.slice(0, files.length - max)) {
        unlinkSync(join(dir, f))
      }
    }
  } catch {}
}
