import { writeFile, copyFile, mkdir, readdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import os from 'os'
import { checkPathSafety } from '../../agent/permissions.js'
import type { AudreyConfig } from '../../config.js'

async function snapshot(filePath: string, config: AudreyConfig): Promise<void> {
  if (!existsSync(filePath)) return
  const snapDir = join(process.env.HOME ?? os.homedir(), '.audrey', 'snapshots')
  await mkdir(snapDir, { recursive: true })
  const ts = Date.now()
  const safeName = filePath.replace(/[/\\]/g, '__')
  await copyFile(filePath, join(snapDir, `${ts}__${safeName}`))

  // rotate: keep only newest snapshotMaxCount
  const snaps = (await readdir(snapDir)).sort()
  if (snaps.length > config.snapshotMaxCount) {
    for (const old of snaps.slice(0, snaps.length - config.snapshotMaxCount)) {
      await unlink(join(snapDir, old))
    }
  }
}

export const writeTool = {
  name: 'write_file',
  description: 'Write content to a file (creates directories if needed)',
  async execute(
    args: { path: string; content: string },
    config: AudreyConfig,
  ): Promise<string> {
    if (!checkPathSafety(args.path, config)) {
      throw new Error(`Path not allowed: ${args.path}`)
    }
    await snapshot(args.path, config)
    await mkdir(dirname(args.path), { recursive: true })
    await writeFile(args.path, args.content, 'utf8')
    return `Written: ${args.path}`
  },
}
