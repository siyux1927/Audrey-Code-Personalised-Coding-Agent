import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import os from 'os'

import { loadConfig, saveConfig, DEFAULT_CONFIG } from '../src/config.js'

let TEST_DIR: string

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(os.tmpdir(), 'audrey-test-'))
  mkdirSync(join(TEST_DIR, '.audrey'), { recursive: true })
  vi.stubEnv('HOME', TEST_DIR)
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('loadConfig', () => {
  it('returns defaults when no config file exists', async () => {
    const cfg = await loadConfig()
    expect(cfg.dailyBudgetCNY).toBe(10)
    expect(cfg.sessionMaxTokens).toBe(60000)
    expect(cfg.tagline).toBe('实习摸鱼，努力学习')
  })

  it('merges saved values over defaults', async () => {
    await saveConfig({ ...DEFAULT_CONFIG, tagline: '测试标语' })
    const cfg = await loadConfig()
    expect(cfg.tagline).toBe('测试标语')
    expect(cfg.dailyBudgetCNY).toBe(10)
  })
})
