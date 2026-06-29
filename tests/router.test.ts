import { describe, it, expect } from 'vitest'
import { route } from '../src/agent/router.js'

describe('route', () => {
  it('returns lite for short non-code prompts', () => {
    expect(route('你好', [])).toBe('lite')
  })

  it('returns standard for code-related prompts', () => {
    expect(route('帮我写一个函数解析 JSON', [])).toBe('standard')
    expect(route('fix the bug in auth.ts', [])).toBe('standard')
  })

  it('returns reason for architecture/reasoning keywords', () => {
    expect(route('为什么这段代码会有内存泄漏', [])).toBe('reason')
    expect(route('设计一个缓存架构', [])).toBe('reason')
    expect(route('分析这个算法的时间复杂度', [])).toBe('reason')
  })

  it('returns standard when history is long even for short prompt', () => {
    const history = Array(5).fill({ role: 'user' as const, content: 'x' })
    expect(route('好', history)).toBe('standard')
  })

  it('respects manual override', () => {
    expect(route('为什么', [], 'lite')).toBe('lite')
    expect(route('你好', [], 'reason')).toBe('reason')
  })
})
