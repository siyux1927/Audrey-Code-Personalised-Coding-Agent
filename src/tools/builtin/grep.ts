import { readFile } from 'fs/promises'
import { glob as globFn } from 'glob'
import { join } from 'path'

const IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.next/**']
const MAX_MATCHES = 50

export const grepTool = {
  name: 'grep',
  description: 'Search for a pattern in files. Use this BEFORE glob/read to locate specific symbols, functions, or strings.',
  async execute(args: { pattern: string; path?: string; glob?: string }, _config?: unknown): Promise<string> {
    const cwd = process.cwd()
    const searchGlob = args.glob ?? '**/*'
    const files = await globFn(searchGlob, {
      cwd: args.path ?? cwd,
      ignore: IGNORE,
      nodir: true,
    })

    const regex = new RegExp(args.pattern, 'i')
    const matches: string[] = []

    for (const file of files) {
      if (matches.length >= MAX_MATCHES) break
      try {
        const fullPath = join(args.path ?? cwd, file)
        const content = await readFile(fullPath, 'utf8')
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i]!)) {
            matches.push(`${file}:${i + 1}: ${lines[i]!.trim()}`)
            if (matches.length >= MAX_MATCHES) break
          }
        }
      } catch {
        // skip unreadable files (binary etc.)
      }
    }

    if (matches.length === 0) return '(no matches)'
    const truncated = matches.length >= MAX_MATCHES
    return matches.join('\n') + (truncated ? `\n…(truncated at ${MAX_MATCHES} matches)` : '')
  },
}
