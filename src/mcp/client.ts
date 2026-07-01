import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { McpServerConfig } from '../types.js'
import type { Tool } from '../tools/index.js'

export class McpClient {
  private client: Client
  private transport: StdioClientTransport | null = null
  private _tools: Tool[] = []

  constructor() {
    this.client = new Client({ name: 'audrey-code', version: '0.1.1' }, { capabilities: {} })
  }

  async connect(name: string, cfg: McpServerConfig): Promise<void> {
    const resolvedArgs = cfg.args.map(a => a === '$CWD' ? process.cwd() : a)
    this.transport = new StdioClientTransport({
      command: cfg.command,
      args: resolvedArgs,
      stderr: 'ignore',
    })
    await this.client.connect(this.transport)
    const { tools } = await this.client.listTools()
    this._tools = tools.map(t => ({
      name: `mcp_${name}_${t.name}`,
      description: `[MCP:${name}] ${t.description ?? t.name}`,
      execute: async (args: Record<string, unknown>): Promise<string> => {
        const result = await this.client.callTool({ name: t.name, arguments: args })
        return (result.content as any[])
          .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
          .join('\n')
      },
    }))
  }

  get tools(): Tool[] {
    return this._tools
  }

  async disconnect(): Promise<void> {
    try { await this.client.close() } catch {}
    try { await this.transport?.close() } catch {}
  }
}
