import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { McpServerConfig } from '../../types.js'

export interface McpTool {
  name: string
  description: string
  inputSchema: object
  call(args: Record<string, unknown>): Promise<string>
}

export async function connectMcpServer(
  name: string,
  serverConfig: McpServerConfig,
): Promise<{ tools: McpTool[]; disconnect: () => Promise<void> }> {
  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args,
  })
  const client = new Client({ name: 'audrey', version: '0.1.0' }, { capabilities: {} })
  await client.connect(transport)

  const { tools } = await client.listTools()
  const mcpTools: McpTool[] = tools.map(t => ({
    name: `${name}__${t.name}`,
    description: t.description ?? '',
    inputSchema: t.inputSchema,
    async call(args) {
      const result = await client.callTool({ name: t.name, arguments: args })
      const text = (result.content as any[])
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text as string)
        .join('\n')
      return text
    },
  }))

  return { tools: mcpTools, disconnect: () => client.close() }
}
