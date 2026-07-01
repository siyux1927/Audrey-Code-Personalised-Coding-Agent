import { McpClient } from './client.js'
import type { McpServerConfig } from '../types.js'
import { registerTool } from '../tools/index.js'

export class McpRegistry {
  private clients = new Map<string, McpClient>()

  async startAll(servers: Record<string, McpServerConfig>): Promise<string[]> {
    const errors: string[] = []
    await Promise.all(
      Object.entries(servers)
        .filter(([, cfg]) => cfg.autoStart)
        .map(async ([name, cfg]) => {
          const client = new McpClient()
          try {
            await client.connect(name, cfg)
            this.clients.set(name, client)
            for (const tool of client.tools) registerTool(tool)
          } catch (err: any) {
            errors.push(`MCP ${name}: ${err.message}`)
          }
        })
    )
    return errors
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.clients.values()].map(c => c.disconnect()))
    this.clients.clear()
  }
}

export const mcpRegistry = new McpRegistry()
