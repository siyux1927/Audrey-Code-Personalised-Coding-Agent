import { glob as globFn } from 'glob'

export const globTool = {
  name: 'glob',
  description: 'Find files matching a glob pattern',
  async execute(args: { pattern: string; cwd?: string }, _config?: unknown): Promise<string> {
    const files = await globFn(args.pattern, { cwd: args.cwd ?? process.cwd() })
    return files.length > 0 ? files.join('\n') : '(no matches)'
  },
}
