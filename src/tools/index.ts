import { readTool } from './builtin/read.js'
import { writeTool } from './builtin/write.js'
import { bashTool } from './builtin/bash.js'
import { globTool } from './builtin/glob.js'
import { grepTool } from './builtin/grep.js'

export type Tool = {
  name: string
  description: string
  execute(args: Record<string, unknown>, config?: unknown): Promise<string>
}

// Stub for GLM's server-side web_search plugin — returns '' so GLM injects its own results
const webSearchStub: Tool = {
  name: 'web_search',
  description: 'Search the web (handled server-side by GLM)',
  async execute(): Promise<string> { return '' },
}

export const ALL_TOOLS: Tool[] = [
  readTool, writeTool, bashTool, globTool, grepTool, webSearchStub,
]

export function registerTool(tool: Tool): void {
  if (!ALL_TOOLS.find(t => t.name === tool.name)) {
    ALL_TOOLS.push(tool)
  }
}

export { readTool, writeTool, bashTool, globTool, grepTool }
