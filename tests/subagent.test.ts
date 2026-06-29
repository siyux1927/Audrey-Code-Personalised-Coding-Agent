import { describe, it, expect } from 'vitest'
import { runSubAgents } from '../src/agent/subagent.js'
import { DEFAULT_CONFIG } from '../src/config.js'
import type { IProvider } from '../src/providers/base.js'

function mockProvider(response: string): IProvider {
  return {
    modelId: 'mock',
    tier: 'standard',
    countTokens: () => 10,
    async *chat() { yield response },
  }
}

describe('runSubAgents', () => {
  it('runs tasks concurrently and returns results', async () => {
    const tasks = [
      { id: 'a', prompt: 'task a', provider: mockProvider('result-a') },
      { id: 'b', prompt: 'task b', provider: mockProvider('result-b') },
    ]
    const results = await runSubAgents(tasks, DEFAULT_CONFIG)
    expect(results).toHaveLength(2)
    expect(results.find(r => r.id === 'a')?.output).toBe('result-a')
    expect(results.find(r => r.id === 'b')?.output).toBe('result-b')
  })

  it('marks timed-out tasks as failed without blocking others', async () => {
    const slow: IProvider = {
      modelId: 'slow',
      tier: 'standard',
      countTokens: () => 10,
      async *chat() { await new Promise(r => setTimeout(r, 200)); yield 'late' },
    }
    const cfg = { ...DEFAULT_CONFIG, subagentTimeoutMs: 50 }
    const tasks = [
      { id: 'fast', prompt: 'x', provider: mockProvider('ok') },
      { id: 'slow', prompt: 'x', provider: slow },
    ]
    const results = await runSubAgents(tasks, cfg)
    expect(results.find(r => r.id === 'fast')?.success).toBe(true)
    expect(results.find(r => r.id === 'slow')?.success).toBe(false)
  })

  it('rejects when depth exceeds 2', async () => {
    await expect(
      runSubAgents([], DEFAULT_CONFIG, 3),
    ).rejects.toThrow('depth')
  })
})
