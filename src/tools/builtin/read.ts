import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { detectInjection } from '../../health/budget.js'

export const readTool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  async execute(args: { path: string }, config: any): Promise<string> {
    if (!existsSync(args.path)) throw new Error(`File not found: ${args.path}`)
    const content = await readFile(args.path, 'utf8')
    const maxChars = (config?.maxFileInjectTokens ?? 8000) * 3.5
    const truncated = content.length > maxChars ? content.slice(0, Math.floor(maxChars)) : content
    if (detectInjection(truncated)) {
      return `[警告: 文件内容含可疑注入模式，已截断显示]\n${truncated.slice(0, 500)}`
    }
    return truncated
  },
}
