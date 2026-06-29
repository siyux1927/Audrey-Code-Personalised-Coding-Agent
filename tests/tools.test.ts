import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import os from 'os'
import { DEFAULT_CONFIG } from '../src/config.js'
import { readTool, writeTool, bashTool, globTool } from '../src/tools/index.js'

const TMP = join(os.tmpdir(), 'audrey-tools-' + Date.now())
beforeEach(() => mkdirSync(TMP, { recursive: true }))
afterEach(() => rmSync(TMP, { recursive: true, force: true }))

describe('readTool', () => {
  it('reads file contents', async () => {
    const f = join(TMP, 'hello.txt')
    writeFileSync(f, 'hello world')
    expect(await readTool.execute({ path: f }, DEFAULT_CONFIG)).toBe('hello world')
  })

  it('throws for missing file', async () => {
    await expect(readTool.execute({ path: '/nonexistent' }, DEFAULT_CONFIG)).rejects.toThrow()
  })
})

describe('writeTool', () => {
  it('rejects path traversal', async () => {
    const cfg = { ...DEFAULT_CONFIG, allowedWriteDirs: [TMP] }
    await expect(
      writeTool.execute({ path: '../../etc/passwd', content: 'x' }, cfg),
    ).rejects.toThrow('not allowed')
  })

  it('writes within allowed dir', async () => {
    const cfg = { ...DEFAULT_CONFIG, allowedWriteDirs: [TMP] }
    const f = join(TMP, 'out.txt')
    await writeTool.execute({ path: f, content: 'hello' }, cfg)
    expect(readFileSync(f, 'utf8')).toBe('hello')
  })

  it('creates parent directories if needed', async () => {
    const cfg = { ...DEFAULT_CONFIG, allowedWriteDirs: [TMP] }
    const f = join(TMP, 'nested', 'deep', 'file.txt')
    await writeTool.execute({ path: f, content: 'deep content' }, cfg)
    expect(readFileSync(f, 'utf8')).toBe('deep content')
  })

  it('snapshots existing file before overwriting', async () => {
    const cfg = { ...DEFAULT_CONFIG, allowedWriteDirs: [TMP] }
    const f = join(TMP, 'existing.txt')
    writeFileSync(f, 'original content')
    await writeTool.execute({ path: f, content: 'new content' }, cfg)
    // File is now overwritten
    expect(readFileSync(f, 'utf8')).toBe('new content')
    // A snapshot should exist in ~/.audrey/snapshots
    const snapDir = join(os.homedir(), '.audrey', 'snapshots')
    const { readdirSync } = await import('fs')
    const snaps = readdirSync(snapDir).filter(s => s.includes('existing.txt'))
    expect(snaps.length).toBeGreaterThan(0)
  })
})

describe('bashTool', () => {
  it('runs a command and returns stdout', async () => {
    const result = await bashTool.execute({ command: 'echo hello' }, DEFAULT_CONFIG)
    expect(result.trim()).toBe('hello')
  })

  it('times out slow commands', async () => {
    const cfg = { ...DEFAULT_CONFIG, bashTimeoutMs: 100 }
    await expect(bashTool.execute({ command: 'sleep 5' }, cfg)).rejects.toThrow('timed out')
  })

  it('does not leak API keys to subprocess', async () => {
    process.env.DEEPSEEK_API_KEY = 'secret-key'
    const result = await bashTool.execute(
      { command: 'echo ${DEEPSEEK_API_KEY:-EMPTY}' },
      DEFAULT_CONFIG,
    )
    expect(result.trim()).toBe('EMPTY')
    delete process.env.DEEPSEEK_API_KEY
  })

  it('does not leak GLM_API_KEY to subprocess', async () => {
    process.env.GLM_API_KEY = 'glm-secret'
    const result = await bashTool.execute(
      { command: 'echo ${GLM_API_KEY:-EMPTY}' },
      DEFAULT_CONFIG,
    )
    expect(result.trim()).toBe('EMPTY')
    delete process.env.GLM_API_KEY
  })

  it('does not leak MINIMAX_API_KEY to subprocess', async () => {
    process.env.MINIMAX_API_KEY = 'minimax-secret'
    const result = await bashTool.execute(
      { command: 'echo ${MINIMAX_API_KEY:-EMPTY}' },
      DEFAULT_CONFIG,
    )
    expect(result.trim()).toBe('EMPTY')
    delete process.env.MINIMAX_API_KEY
  })

  it('rejects non-zero exit codes', async () => {
    await expect(bashTool.execute({ command: 'exit 1' }, DEFAULT_CONFIG)).rejects.toThrow()
  })
})

describe('globTool', () => {
  it('finds files matching a pattern', async () => {
    writeFileSync(join(TMP, 'a.ts'), '')
    writeFileSync(join(TMP, 'b.ts'), '')
    writeFileSync(join(TMP, 'c.txt'), '')
    const result = await globTool.execute({ pattern: '*.ts', cwd: TMP }, DEFAULT_CONFIG)
    expect(result).toContain('a.ts')
    expect(result).toContain('b.ts')
    expect(result).not.toContain('c.txt')
  })

  it('returns (no matches) when nothing found', async () => {
    const result = await globTool.execute({ pattern: '*.xyz', cwd: TMP }, DEFAULT_CONFIG)
    expect(result).toBe('(no matches)')
  })
})

describe('ALL_TOOLS', () => {
  it('exports all four tools', async () => {
    const { ALL_TOOLS } = await import('../src/tools/index.js')
    expect(ALL_TOOLS).toHaveLength(4)
    const names = ALL_TOOLS.map(t => t.name)
    expect(names).toContain('read_file')
    expect(names).toContain('write_file')
    expect(names).toContain('bash')
    expect(names).toContain('glob')
  })
})
