import { readTool } from './builtin/read.js'
import { writeTool } from './builtin/write.js'
import { bashTool } from './builtin/bash.js'
import { globTool } from './builtin/glob.js'

export const ALL_TOOLS = [readTool, writeTool, bashTool, globTool]
export { readTool, writeTool, bashTool, globTool }

export type Tool = {
  name: string
  description: string
  execute(args: Record<string, unknown>, config?: unknown): Promise<string>
}
