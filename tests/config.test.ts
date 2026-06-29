import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import os from 'os'

const TEST_DIR = join(os.tmpdir(), 'audrey-test-' + Date.now())

// Override home for tests
process.env.HOME = TEST_DIR

import { loadConfig, saveConfig, DEFAULT_CONFIG } from '../src/config.js'

beforeEach(() => mkdirSync(join(TEST_DIR, '.audrey'), { recursive: true }))
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }))

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
    expect(cfg.dailyBudgetCNY).toBe(10) // default preserved
  })
})
