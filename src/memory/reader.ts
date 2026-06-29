import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import os from 'os'

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

/**
 * Returns directories from cwd up to stopAt (inclusive), ordered distant-first
 * so that closer directories override further ones when combining layers.
 */
function getAncestors(cwd: string, stopAt: string): string[] {
  const dirs: string[] = []
  let current = cwd
  while (current !== stopAt && current !== dirname(current)) {
    dirs.push(current)
    current = dirname(current)
  }
  dirs.push(stopAt)
  return dirs.reverse() // distant (home) first, project last
}

/**
 * Load all AUDREY.md files relevant to cwd, from global (~/.audrey/AUDREY.md)
 * through ancestor directories up to home, then the project dir itself.
 * Returns combined content truncated to maxTokens.
 */
export async function loadMemory(cwd: string, maxTokens: number): Promise<string> {
  const home = process.env.HOME ?? os.homedir()
  const layers: string[] = []

  // Global memory
  const globalPath = join(home, '.audrey', 'AUDREY.md')
  if (existsSync(globalPath)) {
    layers.push(await readFile(globalPath, 'utf8'))
  }

  // Ancestor directories between home and cwd (exclusive of home since that's global)
  const ancestors = getAncestors(cwd, home)
  for (const dir of ancestors) {
    if (dir === home) continue // already loaded as global
    const filePath = join(dir, 'AUDREY.md')
    if (existsSync(filePath)) {
      layers.push(await readFile(filePath, 'utf8'))
    }
  }

  if (layers.length === 0) return ''

  let combined = layers.join('\n\n---\n\n')

  // Trim the tail until within maxTokens
  while (estimateTokens(combined) > maxTokens && combined.length > 0) {
    combined = combined.slice(0, Math.floor(combined.length * 0.9))
  }

  return combined
}
