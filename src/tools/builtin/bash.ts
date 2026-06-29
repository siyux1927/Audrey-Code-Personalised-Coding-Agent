import { spawn } from 'child_process'
import type { AudreyConfig } from '../../config.js'

const SENSITIVE_KEYS = ['DEEPSEEK_API_KEY', 'GLM_API_KEY', 'MINIMAX_API_KEY']

function sanitizedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of SENSITIVE_KEYS) delete env[key]
  return env
}

export const bashTool = {
  name: 'bash',
  description: 'Execute a shell command',
  async execute(args: { command: string }, config: AudreyConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', args.command], {
        env: sanitizedEnv(),
        cwd: process.cwd(),
      })
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`Command timed out after ${config.bashTimeoutMs}ms`))
      }, config.bashTimeoutMs)

      child.stdout.on('data', (d: Buffer) => { stdout += d })
      child.stderr.on('data', (d: Buffer) => { stderr += d })
      child.on('close', (code: number | null) => {
        clearTimeout(timer)
        const output = [stdout, stderr].filter(Boolean).join('\n')
        if (code === 0) resolve(output || '(no output)')
        else reject(new Error(`Exit ${code}: ${output}`))
      })
    })
  },
}
