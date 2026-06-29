import { describe, it, expect } from 'vitest'
import { checkPathSafety, isBashAllowed, getCommandBase } from '../src/agent/permissions.js'
import { DEFAULT_CONFIG } from '../src/config.js'

describe('checkPathSafety', () => {
  it('allows paths within CWD', () => {
    expect(checkPathSafety('src/foo.ts', DEFAULT_CONFIG)).toBe(true)
  })

  it('rejects path traversal', () => {
    expect(checkPathSafety('../../etc/passwd', DEFAULT_CONFIG)).toBe(false)
  })

  it('rejects sibling directories sharing an allowed-dir name prefix', () => {
    const cfg = { ...DEFAULT_CONFIG, allowedWriteDirs: [process.cwd()] }
    // A dir whose name starts with cwd's name but is a sibling, not a child
    const sibling = process.cwd() + '-evil/secret.ts'
    expect(checkPathSafety(sibling, cfg)).toBe(false)
  })
})

describe('getCommandBase', () => {
  it('extracts the base command from a command string', () => {
    expect(getCommandBase('npm install')).toBe('npm')
    expect(getCommandBase('git status')).toBe('git')
    expect(getCommandBase('  rm -rf /')).toBe('rm')
  })

  it('returns the command itself if no spaces', () => {
    expect(getCommandBase('echo')).toBe('echo')
  })
})

describe('isBashAllowed', () => {
  it('always asks for dangerous commands', () => {
    expect(isBashAllowed('rm -rf /', 'auto', DEFAULT_CONFIG)).toBe('ask')
    expect(isBashAllowed('sudo npm install', 'auto', DEFAULT_CONFIG)).toBe('ask')
  })

  it('allows whitelisted commands in ask mode', () => {
    expect(isBashAllowed('npm install', 'ask', DEFAULT_CONFIG)).toBe('allow')
    expect(isBashAllowed('git status', 'ask', DEFAULT_CONFIG)).toBe('allow')
  })

  it('asks for unknown commands in ask mode', () => {
    expect(isBashAllowed('python3 script.py', 'ask', DEFAULT_CONFIG)).toBe('ask')
  })

  it('denies all in deny mode (except always-confirm which still ask)', () => {
    expect(isBashAllowed('python3 script.py', 'deny', DEFAULT_CONFIG)).toBe('deny')
  })

  it('allows all non-dangerous commands in auto mode', () => {
    expect(isBashAllowed('python3 script.py', 'auto', DEFAULT_CONFIG)).toBe('allow')
  })
})
