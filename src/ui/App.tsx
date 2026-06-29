import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { theme } from './theme.js'
import { FlowerArt } from './FlowerArt.js'
import { MessageList } from './MessageList.js'
import { Markdown } from './Markdown.js'
import { Prompt } from './Prompt.js'
import { AgentStatus, type AgentTask } from './AgentStatus.js'
import { getPhrase } from './phrases.js'
import { loadConfig, saveConfig, ensureAudreyDir, type AudreyConfig } from '../config.js'
import { createSession, addMessage, saveSession, getContextUsage, type Session } from '../agent/session.js'
import { loadMemory } from '../memory/reader.js'
import { route } from '../agent/router.js'
import { resolveProvider } from '../providers/registry.js'
import { parseCommand } from '../commands/index.js'
import { handleCommand } from '../commands/handlers.js'
import { agentLoop } from '../agent/loop.js'
import { getTodaySpend, recordUsage } from '../health/budget.js'
import type { PermissionMode } from '../types.js'

interface Props { permissionMode: PermissionMode }

type AppPhase = 'splash' | 'repl'

// Sentinel toolName values (never sent to AI)
const CMD_OUTPUT = '__output__'
const BTW_NOTE   = '__btw__'

// Remove messages that would cause a 400 from the API:
//  - CMD_OUTPUT / BTW_NOTE display-only messages
//  - tool messages whose tool_call_id doesn't match any preceding assistant tool_calls
function sanitizeForApi(messages: import('../types.js').Message[]): import('../types.js').Message[] {
  // Collect all valid tool_call ids from assistant messages
  const validIds = new Set<string>()
  for (const m of messages) {
    if (m.role === 'assistant' && m.toolCalls) {
      for (const tc of m.toolCalls) validIds.add(tc.id)
    }
  }
  return messages.filter(m => {
    if (m.toolName === CMD_OUTPUT || m.toolName === BTW_NOTE) return false
    if (m.role === 'tool') return !!(m.toolCallId && validIds.has(m.toolCallId))
    return true
  })
}

export function App({ permissionMode }: Props) {
  useApp()
  const [phase, setPhase] = useState<AppPhase>('splash')
  const [splashReady, setSplashReady] = useState(false)  // init done + min time elapsed
  const [config, setConfigState] = useState<AudreyConfig | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [generating, setGenerating] = useState(false)
  const [currentPhrase, setCurrentPhrase] = useState('')
  const [agentTasks] = useState<AgentTask[]>([])
  const [streamContent, setStreamContent] = useState('')

  useEffect(() => {
    const minDelay = new Promise<void>(r => setTimeout(r, 1200))
    async function init() {
      await ensureAudreyDir()
      const cfg = await loadConfig()
      const sess = createSession(cfg)
      const memory = await loadMemory(process.cwd(), cfg.memoryMaxTokens)
      const sessWithMemory = memory
        ? addMessage(sess, { role: 'system', content: memory })
        : sess
      setConfigState(cfg)
      setSession({ ...sessWithMemory, permissionMode })
      await minDelay    // ensure splash shows at least 1.2s
      setSplashReady(true)
    }
    void init()
  }, [])

  // Dismiss splash on any keypress (after init finishes)
  useInput((_input, key) => {
    if (phase === 'splash' && splashReady && !key.ctrl) setPhase('repl')
  }, { isActive: phase === 'splash' })

  const handleSubmit = useCallback(async (input: string) => {
    if (!config || !session) return

    // ── Command handling ──────────────────────────────────────────────────────
    const cmd = parseCommand(input)
    if (cmd) {
      await handleCommand(cmd, {
        session,
        config,
        setSession,
        setConfig: (c) => { setConfigState(c); void saveConfig(c) },
        clearScreen: () => setSession(s => s
          ? { ...s, messages: s.messages.filter(m => m.toolName !== CMD_OUTPUT) }
          : s),
        print: (msg) => setSession(s => s
          ? addMessage(s, { role: 'tool', content: msg, toolName: CMD_OUTPUT })
          : s),
      })
      return
    }

    // ── Budget guard ──────────────────────────────────────────────────────────
    const todaySpend = await getTodaySpend()
    if (todaySpend >= config.dailyBudgetCNY) {
      setSession(s => s
        ? addMessage(s, {
            role: 'tool',
            content: `[预算超限] 今日已消耗 ¥${todaySpend.toFixed(4)}，上限 ¥${config.dailyBudgetCNY}。用 /cost 查看明细。`,
            toolName: CMD_OUTPUT,
          })
        : s)
      return
    }

    // ── Extract /btw notes and inject into context ────────────────────────────
    const btwNotes = session.messages
      .filter(m => m.toolName === BTW_NOTE)
      .map(m => m.content)
    const effectiveInput = btwNotes.length > 0
      ? `[注意事项]\n${btwNotes.join('\n')}\n\n${input}`
      : input

    // Build session: remove btw notes, remove cmd output, add user message
    let current: Session = {
      ...session,
      messages: session.messages.filter(m => m.toolName !== BTW_NOTE),
    }
    current = addMessage(current, { role: 'user', content: input }) // display: original
    setSession(current)
    setGenerating(true)
    setCurrentPhrase(getPhrase('thinking'))

    // AI sees augmented input; sanitize before sending
    const aiMessages = [
      ...sanitizeForApi(current.messages.slice(0, -1)),
      { role: 'user' as const, content: effectiveInput },
    ]

    const tier = route(input, aiMessages, current.modelOverride)
    const provider = resolveProvider(tier, config)
    const t0 = Date.now()

    try {
      let streamBuf = ''

      for await (const event of agentLoop(aiMessages, provider, config)) {
        if (event.type === 'token') {
          streamBuf += event.content
          setStreamContent(streamBuf)
          setCurrentPhrase(getPhrase('thinking'))
        } else if (event.type === 'turn_done') {
          // Flush assistant turn to session
          if (streamBuf) {
            current = addMessage(current, {
              role: 'assistant',
              content: streamBuf,
              toolCalls: event.toolCalls.length > 0 ? event.toolCalls : undefined,
            })
            setSession(current)
            streamBuf = ''
            setStreamContent('')
          }
        } else if (event.type === 'tool_start') {
          setCurrentPhrase(getPhrase('running'))
          // Display-only: use CMD_OUTPUT so it's stripped before sending to AI
          current = addMessage(current, {
            role: 'tool',
            content: `⚙ ${event.name}(${JSON.stringify(event.args).slice(0, 100)})`,
            toolName: CMD_OUTPUT,
          })
          setSession(current)
        } else if (event.type === 'tool_result') {
          // Proper tool result: toolCallId must match the assistant's tool_calls entry
          current = addMessage(current, {
            role: 'tool',
            content: event.result.slice(0, 2000),
            toolCallId: event.id,
            toolName: event.name,
          })
          setSession(current)
        } else if (event.type === 'done') {
          await saveSession(current)
          // Record approximate usage (rough estimate: 1 CNY per 500k chars)
          const chars = aiMessages.reduce((s, m) => s + m.content.length, 0)
          await recordUsage({
            date: new Date().toISOString().slice(0, 10),
            costCNY: chars / 500000,
            tokens: Math.ceil(chars / 3.5),
            model: provider.modelId,
          })
        }
      }
    } catch (err: any) {
      setStreamContent('')
      current = addMessage(current, {
        role: 'tool',
        content: `[错误] ${(err as Error).message}`,
        toolName: CMD_OUTPUT,
      })
      setSession(current)
    } finally {
      setStreamContent('')
      setGenerating(false)
    }
  }, [config, session])

  const handleAbort = useCallback(() => {
    setGenerating(false)
    setStreamContent('')
  }, [])

  if (phase === 'splash') {
    return (
      <Box flexDirection="column" padding={1}>
        <FlowerArt version="v0.1.0" tagline={config?.tagline ?? '实习摸鱼，努力学习'} />
        <Box marginTop={1}>
          {splashReady
            ? <Text color={theme.dimPurple}>  按任意键开始...</Text>
            : <Text color={theme.dimPurple}>  正在初始化...</Text>}
        </Box>
      </Box>
    )
  }

  if (!config || !session) return null

  const contextPct = Math.round(getContextUsage(session, config.sessionMaxTokens) * 100)

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.purple}>Audrey Code v0.1.0  </Text>
        <Text color={theme.dimPurple}>{session.modelOverride ?? 'auto'} │ </Text>
        <Text color={contextPct >= 70 ? theme.yellow : theme.dimPurple}>ctx {contextPct}%</Text>
      </Box>

      <MessageList messages={session.messages.filter(m => m.role !== 'system')} />

      {/* Streaming in-progress assistant response */}
      {streamContent !== '' && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.purple}>◆</Text>
          <Box marginLeft={2} flexDirection="column">
            <Markdown>{streamContent}</Markdown>
          </Box>
        </Box>
      )}

      <AgentStatus tasks={agentTasks} />

      {generating && streamContent === '' && (
        <Box marginY={1}>
          <Text color={theme.purple}><Spinner type="dots" /></Text>
          <Text color={theme.pink}>  {currentPhrase}</Text>
        </Box>
      )}

      <Prompt onSubmit={handleSubmit} onAbort={handleAbort} disabled={generating} />

      <Text color={theme.dimPurple}>  /help 查看命令  │  ESC 中断  │  Ctrl+C 退出</Text>
    </Box>
  )
}
