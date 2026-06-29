import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import os from 'os'

import { loadMemory } from '../src/memory/reader.js'
import { appendMemory } from '../src/memory/writer.js'

let TMP: string
let HOME: string
let PROJECT: string

beforeEach(() => {
  TMP = mkdtempSync(join(os.tmpdir(), 'audrey-mem-'))
  HOME = join(TMP, 'home')
  PROJECT = join(TMP, 'project')
  mkdirSync(join(HOME, '.audrey'), { recursive: true })
  mkdirSync(PROJECT, { recursive: true })
  vi.stubEnv('HOME', HOME)
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(TMP, { recursive: true, force: true })
})

describe('loadMemory', () => {
  it('loads global AUDREY.md when no project file', async () => {
    writeFileSync(join(HOME, '.audrey', 'AUDREY.md'), '# Global\nrule1')
    const result = await loadMemory(PROJECT, 2000)
    expect(result).toContain('rule1')
  })

  it('appends project AUDREY.md after global', async () => {
    writeFileSync(join(HOME, '.audrey', 'AUDREY.md'), '# Global\nglobal-rule')
    writeFileSync(join(PROJECT, 'AUDREY.md'), '# Project\nproject-rule')
    const result = await loadMemory(PROJECT, 2000)
    expect(result).toContain('global-rule')
    expect(result).toContain('project-rule')
  })

  it('returns empty string when no AUDREY.md files found', async () => {
    const result = await loadMemory(PROJECT, 2000)
    expect(result).toBe('')
  })

  it('truncates combined content when it exceeds maxTokens', async () => {
    // 100 chars / 3.5 ≈ 29 tokens; limit to 5 tokens so truncation triggers
    const bigContent = 'x'.repeat(100)
    writeFileSync(join(HOME, '.audrey', 'AUDREY.md'), bigContent)
    const result = await loadMemory(PROJECT, 5)
    expect(estimateTokens(result)).toBeLessThanOrEqual(5)
  })
})

describe('appendMemory', () => {
  it('appends new content to existing file', async () => {
    const file = join(HOME, '.audrey', 'AUDREY.md')
    writeFileSync(file, '# Existing\nold content')
    await appendMemory(file, 'new fact', 2000)
    const { readFileSync } = await import('fs')
    const contents = readFileSync(file, 'utf8')
    expect(contents).toContain('old content')
    expect(contents).toContain('new fact')
  })

  it('creates file if it does not exist', async () => {
    const file = join(HOME, '.audrey', 'AUDREY.md')
    await appendMemory(file, 'first entry', 2000)
    const { readFileSync } = await import('fs')
    expect(readFileSync(file, 'utf8')).toContain('first entry')
  })

  it('skips duplicate content', async () => {
    const file = join(HOME, '.audrey', 'AUDREY.md')
    writeFileSync(file, '# Existing\nsome fact')
    await appendMemory(file, 'some fact', 2000)
    const { readFileSync } = await import('fs')
    const contents = readFileSync(file, 'utf8')
    // 'some fact' should appear only once
    expect(contents.split('some fact').length - 1).toBe(1)
  })

  it('compresses file content when over maxTokens after append', async () => {
    const file = join(HOME, '.audrey', 'AUDREY.md')
    // existing content of ~50 chars ≈ 15 tokens
    const existing = 'line\n'.repeat(10)
    writeFileSync(file, existing)
    // limit so compression triggers
    await appendMemory(file, 'extra line', 5)
    const { readFileSync } = await import('fs')
    const final = readFileSync(file, 'utf8')
    expect(estimateTokens(final)).toBeLessThanOrEqual(5)
  })
})

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}
