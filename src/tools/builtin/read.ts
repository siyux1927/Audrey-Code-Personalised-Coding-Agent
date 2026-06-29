import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

export const readTool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  async execute(args: { path: string }, _config: unknown): Promise<string> {
    if (!existsSync(args.path)) throw new Error(`File not found: ${args.path}`)
    return readFile(args.path, 'utf8')
  },
}
