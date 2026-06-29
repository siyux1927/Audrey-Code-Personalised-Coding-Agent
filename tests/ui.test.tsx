import { describe, it, expect, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup } from 'ink-testing-library'
import { FlowerArt } from '../src/ui/FlowerArt.js'
import { MessageList } from '../src/ui/MessageList.js'
import type { Message } from '../src/types.js'

afterEach(() => cleanup())

describe('FlowerArt', () => {
  it('renders version and tagline', () => {
    const { lastFrame } = render(
      <FlowerArt version="v0.1.0" tagline="实习摸鱼，努力学习" />,
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Audrey Code')
    expect(frame).toContain('v0.1.0')
    expect(frame).toContain('实习摸鱼，努力学习')
  })

  it('renders custom tagline', () => {
    const { lastFrame } = render(
      <FlowerArt version="v0.2.0" tagline="搞大事中" />,
    )
    expect(lastFrame()).toContain('搞大事中')
  })
})

describe('MessageList', () => {
  const messages: Message[] = [
    { role: 'user', content: '你好 Audrey' },
    { role: 'assistant', content: '你好！有什么可以帮你的？' },
    { role: 'tool', toolName: 'read_file', content: 'file content here' },
  ]

  it('renders user message with > prefix', () => {
    const { lastFrame } = render(<MessageList messages={messages} />)
    expect(lastFrame()).toContain('你好 Audrey')
  })

  it('renders assistant message', () => {
    const { lastFrame } = render(<MessageList messages={messages} />)
    expect(lastFrame()).toContain('你好！有什么可以帮你的？')
  })

  it('renders tool message with tool name', () => {
    const { lastFrame } = render(<MessageList messages={messages} />)
    expect(lastFrame()).toContain('read_file')
  })

  it('renders empty list without error', () => {
    const { lastFrame } = render(<MessageList messages={[]} />)
    expect(lastFrame()).toBeDefined()
  })
})
