import { glob as globFn } from 'glob'

const IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/.next/**',
  '**/__pycache__/**',
  '**/.venv/**',
]

const MAX_RESULTS = 500

export const globTool = {
  name: 'glob',
  description: 'Find files matching a glob pattern',
  async execute(args: { pattern: string; cwd?: string }, _config?: unknown): Promise<string> {
    const files = await globFn(args.pattern, {
      cwd: args.cwd ?? process.cwd(),
      ignore: IGNORE,
    })
    if (files.length === 0) return '(no matches)'
    const truncated = files.length > MAX_RESULTS
    const result = files.slice(0, MAX_RESULTS).join('\n')
    return truncated ? `${result}\n…(${files.length - MAX_RESULTS} more, truncated)` : result
  },
}
