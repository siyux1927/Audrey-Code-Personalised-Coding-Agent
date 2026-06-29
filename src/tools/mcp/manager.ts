import { connectMcpServer, type McpTool } from './client.js'
import type { McpServerConfig } from '../../types.js'

export interface McpServerStatus {
  name: string
  online: boolean
  toolCount: number
  error?: string
}

export class McpManager {
  private connections: Map<string, { tools: McpTool[]; disconnect: () => Promise<void> }> = new Map()

  async start(servers: Record<string, McpServerConfig>): Promise<McpServerStatus[]> {
    const statuses: McpServerStatus[] = []
    for (const [name, cfg] of Object.entries(servers)) {
      if (!cfg.autoStart) {
        statuses.push({ name, online: false, toolCount: 0 })
        continue
      }
      try {
        const conn = await connectMcpServer(name, cfg)
        this.connections.set(name, conn)
        statuses.push({ name, online: true, toolCount: conn.tools.length })
      } catch (err: any) {
        statuses.push({ name, online: false, toolCount: 0, error: err.message })
      }
    }
    return statuses
  }

  async startOne(name: string, cfg: McpServerConfig): Promise<McpServerStatus> {
    try {
      const conn = await connectMcpServer(name, cfg)
      this.connections.set(name, conn)
      return { name, online: true, toolCount: conn.tools.length }
    } catch (err: any) {
      return { name, online: false, toolCount: 0, error: err.message }
    }
  }

  async stop(name?: string): Promise<void> {
    if (name) {
      await this.connections.get(name)?.disconnect()
      this.connections.delete(name)
    } else {
      for (const conn of this.connections.values()) await conn.disconnect()
      this.connections.clear()
    }
  }

  getTools(): McpTool[] {
    return [...this.connections.values()].flatMap(c => c.tools)
  }

  healthCheck(): McpServerStatus[] {
    return [...this.connections.entries()].map(([name, conn]) => ({
      name,
      online: true,
      toolCount: conn.tools.length,
    }))
  }
}
