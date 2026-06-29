import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import os from 'os'

import {
  createSession, saveSession, loadLastSession, addMessage, getContextUsage,
} from '../src/agent/session.js'
import { DEFAULT_CONFIG } from '../src/config.js'

let HOME: string

beforeEach(() => {
  HOME = mkdtempSync(join(os.tmpdir(), 'audrey-sess-'))
  mkdirSync(join(HOME, '.audrey', 'sessions'), { recursive: true })
  vi.stubEnv('HOME', HOME)
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(HOME, { recursive: true, force: true })
})

describe('session', () => {
  it('creates a session with empty history', () => {
    const s = createSession(DEFAULT_CONFIG)
    expect(s.messages).toHaveLength(0)
    expect(s.modelOverride).toBeUndefined()
  })

  it('persists and reloads session', async () => {
    const s = createSession(DEFAULT_CONFIG)
    const s2 = addMessage(s, { role: 'user', content: 'hello' })
    await saveSession(s2)
    const loaded = await loadLastSession()
    expect(loaded?.messages[0]?.content).toBe('hello')
  })

  it('returns null when no saved session', async () => {
    expect(await loadLastSession()).toBeNull()
  })

  it('calculates context usage ratio', () => {
    let s = createSession(DEFAULT_CONFIG)
    s = addMessage(s, { role: 'user', content: 'x'.repeat(1000) })
    const ratio = getContextUsage(s, DEFAULT_CONFIG.sessionMaxTokens)
    expect(ratio).toBeGreaterThan(0)
    expect(ratio).toBeLessThan(1)
  })
})
