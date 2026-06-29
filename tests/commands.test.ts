import { describe, it, expect } from 'vitest'
import { parseCommand } from '../src/commands/index.js'

describe('parseCommand', () => {
  it('parses /model command with arg', () => {
    const cmd = parseCommand('/model lite')
    expect(cmd?.name).toBe('model')
    expect(cmd?.args).toEqual(['lite'])
  })

  it('parses /clear with no args', () => {
    const cmd = parseCommand('/clear')
    expect(cmd?.name).toBe('clear')
    expect(cmd?.args).toEqual([])
  })

  it('parses /tagline with multi-word arg', () => {
    const cmd = parseCommand('/tagline 实习摸鱼 努力学习')
    expect(cmd?.name).toBe('tagline')
    expect(cmd?.args).toEqual(['实习摸鱼', '努力学习'])
  })

  it('returns null for non-command input', () => {
    expect(parseCommand('hello world')).toBeNull()
    expect(parseCommand('')).toBeNull()
  })

  it('returns null for unknown command', () => {
    expect(parseCommand('/unknown')).toBeNull()
  })
})
