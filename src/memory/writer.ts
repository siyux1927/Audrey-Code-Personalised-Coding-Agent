import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

/**
 * Append newContent to the AUDREY.md file at filePath.
 * - Skips write if newContent is already present (dedup).
 * - Creates the file if it does not exist.
 * - Compresses (removes early lines) if the result exceeds maxTokens.
 */
export async function appendMemory(
  filePath: string,
  newContent: string,
  maxTokens: number,
): Promise<void> {
  let existing = ''
  if (existsSync(filePath)) {
    existing = await readFile(filePath, 'utf8')
  }

  // Dedup: skip if content already present
  if (existing.includes(newContent.trim())) return

  const datestamp = new Date().toISOString().slice(0, 10)
  const appended = existing
    ? `${existing}\n\n<!-- ${datestamp} -->\n${newContent}`
    : newContent

  // Compress if over token limit: drop ~10% of lines from the top (after first)
  let final = appended
  while (estimateTokens(final) > maxTokens) {
    const lines = final.split('\n')
    if (lines.length <= 1) break // can't compress further
    lines.splice(1, Math.max(1, Math.ceil(lines.length * 0.1)))
    final = lines.join('\n')
  }

  await writeFile(filePath, final, 'utf8')
}
