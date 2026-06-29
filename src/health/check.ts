import type { AudreyConfig } from '../config.js'
import type { McpServerStatus } from '../tools/mcp/manager.js'

export interface HealthReport {
  providers: { name: string; ok: boolean; error?: string }[]
  mcpServers: McpServerStatus[]
  diskMB: number
  diskWarning: boolean
}

export async function pingProvider(
  name: string,
  apiKey: string,
  baseUrl: string,
): Promise<{ name: string; ok: boolean; error?: string }> {
  if (!apiKey) return { name, ok: false, error: 'API key not set' }
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    })
    return { name, ok: res.status < 500 }
  } catch (err: any) {
    return { name, ok: false, error: err.message }
  }
}

export async function runHealthCheck(
  config: AudreyConfig,
  mcpStatuses: McpServerStatus[],
): Promise<HealthReport> {
  const providers = await Promise.all([
    pingProvider('deepseek', process.env.DEEPSEEK_API_KEY ?? '', 'https://api.deepseek.com/v1'),
    pingProvider('glm', process.env.GLM_API_KEY ?? '', 'https://open.bigmodel.cn/api/paas/v4'),
    pingProvider('minimax', process.env.MINIMAX_API_KEY ?? '', 'https://api.minimax.chat/v1'),
  ])

  const { statfs } = await import('fs/promises')
  const fsStat = await statfs(process.env.HOME ?? '/')
  const diskMB = Math.round((fsStat.bavail * fsStat.bsize) / 1024 / 1024)

  return {
    providers,
    mcpServers: mcpStatuses,
    diskMB,
    diskWarning: diskMB < config.storageWarnMB,
  }
}
