import { readTool } from './builtin/read.js'
import { writeTool } from './builtin/write.js'
import { bashTool } from './builtin/bash.js'
import { globTool } from './builtin/glob.js'
import { grepTool } from './builtin/grep.js'

export const ALL_TOOLS = [readTool, writeTool, bashTool, globTool, grepTool]
export { readTool, writeTool, bashTool, globTool, grepTool }

export type Tool = {
  name: string
  description: string
  execute(args: Record<string, unknown>, config?: unknown): Promise<string>
}
