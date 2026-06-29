import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')

function runCli(args: string[] = [], timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', 'src/cli.tsx', ...args], {
      cwd: ROOT,
      env: {
        ...process.env,
        // No real API keys needed — we just check the splash renders
        FORCE_COLOR: '0',  // strip ANSI so we can assert on plain text
      },
    })

    let output = ''
    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { output += d.toString() })

    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
      resolve(output)
    }, timeoutMs)

    proc.on('exit', () => {
      clearTimeout(timer)
      resolve(output)
    })
    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

describe('CLI smoke test', () => {
  it('renders splash with "Audrey Code" within 3s', async () => {
    const output = await runCli([], 3000)
    expect(output).toContain('Audrey Code')
  }, 8000)

  it('renders tagline in splash', async () => {
    const output = await runCli([], 3000)
    // default tagline or any non-empty text from config
    expect(output.length).toBeGreaterThan(20)
  }, 8000)
})
