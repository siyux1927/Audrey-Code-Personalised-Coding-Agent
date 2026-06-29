import { describe, it, expect } from 'vitest'
import { route } from '../src/agent/router.js'

describe('route', () => {
  it('returns glm-4-flash for short non-code prompts', () => {
    expect(route('你好', [])).toBe('glm-4-flash')
  })

  it('returns deepseek-chat for code-related prompts', () => {
    expect(route('帮我写一个函数解析 JSON', [])).toBe('deepseek-chat')
    expect(route('fix the bug in auth.ts', [])).toBe('deepseek-chat')
  })

  it('returns deepseek-reasoner for architecture/reasoning keywords', () => {
    expect(route('为什么这段代码会有内存泄漏', [])).toBe('deepseek-reasoner')
    expect(route('设计一个缓存架构', [])).toBe('deepseek-reasoner')
    expect(route('分析这个算法的时间复杂度', [])).toBe('deepseek-reasoner')
  })

  it('returns deepseek-chat when history is long even for short prompt', () => {
    const history = Array(5).fill({ role: 'user' as const, content: 'x' })
    expect(route('好', history)).toBe('deepseek-chat')
  })

  it('respects manual override (model ID)', () => {
    expect(route('为什么', [], 'glm-4-flash')).toBe('glm-4-flash')
    expect(route('你好', [], 'deepseek-reasoner')).toBe('deepseek-reasoner')
    expect(route('你好', [], 'glm-4-air')).toBe('glm-4-air')
  })
})
