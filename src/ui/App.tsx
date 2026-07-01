import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import { theme } from './theme.js'
import { FlowerArt } from './FlowerArt.js'
import { MessageList } from './MessageList.js'
import { Markdown } from './Markdown.js'
import { Prompt } from './Prompt.js'
import { ModelSelector } from './ModelSelector.js'
import { PermissionPrompt } from './PermissionPrompt.js'
import { AgentStatus, type AgentTask } from './AgentStatus.js'
import { getPhrase } from './phrases.js'
import { loadConfig, saveConfig, ensureAudreyDir, type AudreyConfig } from '../config.js'
import { createSession, addMessage, saveSession, getContextUsage, type Session } from '../agent/session.js'
import { loadMemory } from '../memory/reader.js'
import { route } from '../agent/router.js'
import { resolveProvider, resolveProviderByModelId } from '../providers/registry.js'
import { parseCommand } from '../commands/index.js'
import { handleCommand } from '../commands/handlers.js'
import { agentLoop } from '../agent/loop.js'
import { mcpRegistry } from '../mcp/registry.js'
import { getTodaySpend, recordUsage } from '../health/budget.js'
import { getModelDef, MODELS } from '../models.js'
import type { PermissionMode } from '../types.js'
import type { ModelDef } from '../models.js'

interface Props { permissionMode: PermissionMode }

type AppPhase = 'splash' | 'repl'

const CMD_OUTPUT = '__output__'
const BTW_NOTE   = '__btw__'

function sanitizeForApi(messages: import('../types.js').Message[]): import('../types.js').Message[] {
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
  const [splashReady, setSplashReady] = useState(false)
  const [config, setConfigState] = useState<AudreyConfig | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [generating, setGenerating] = useState(false)
  const [currentPhrase, setCurrentPhrase] = useState('')
  const [agentTasks] = useState<AgentTask[]>([])
  const [streamContent, setStreamContent] = useState('')
  const [modelSelecting, setModelSelecting] = useState(false)
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 })
  const [permissionRequest, setPermissionRequest] = useState<{
    toolName: string
    args: Record<string, unknown>
    resolve: (allow: boolean) => void
  } | null>(null)

  useEffect(() => {
    const minDelay = new Promise<void>(r => setTimeout(r, 1200))
    async function init() {
      await ensureAudreyDir()
      const cfg = await loadConfig()
      const sess = createSession(cfg)
      const memory = await loadMemory(process.cwd(), cfg.memoryMaxTokens)
      const corePrompt = `You are Audrey Code, a personal AI coding assistant running in the terminal. Current working directory: ${process.cwd()}

# Doing tasks

The user will primarily ask you to perform software engineering tasks: fixing bugs, adding features, refactoring, explaining code. When given an unclear instruction, interpret it in the context of software engineering and the current working directory.

- Prefer editing existing files over creating new ones.
- Only do what the task requires. Don't add features, refactor, or introduce abstractions beyond the request. Three similar lines is better than a premature abstraction.
- Don't add error handling or validation for scenarios that can't happen. Only validate at system boundaries (user input, external APIs).
- Default to writing no comments. Only add one when the WHY is non-obvious: a hidden constraint, a workaround for a specific bug, behavior that would surprise a reader.
- For exploratory questions ("what could we do about X?", "how should we approach this?"), respond in 2-3 sentences with a recommendation and the main tradeoff. Don't implement until the user agrees.

# Web search and current information

You have built-in web search capability. Use it directly when the user asks about current events, news, recent releases, or anything beyond your training cutoff. You have no fetch tool — do not attempt to construct URLs or browse websites manually.

# When to use tools vs answer directly

Ask yourself: does this question require local file access?
- Conceptual / knowledge questions ("what is X", "explain Y") → answer directly from training knowledge.
- Current events, news, recent information → use your built-in web search.
- No file, path, or code mentioned → answer directly.
- Only use tools (read_file, grep, glob, bash, write_file) when the question explicitly involves the current project or local files.

# Using tools

- Think before acting: what information do I need, which file is most likely to contain it, then call the tool.
- Use grep to locate symbols, function names, or keywords first. Read the specific file only after you know the line.
- To understand project structure, read package.json or README — never glob the entire directory.
- glob patterns must include a file extension (e.g. src/**/*.ts). Never use **/* without an extension.
- Don't "defensively" read files that might be useful. Only read what you actually need.
- Stay within the current working directory unless the user explicitly asks otherwise.

# Tone and style

- Responses should be short and concise.
- When referencing code, include file_path:line_number so the user can navigate directly.
- Do not summarize what you just did at the end of a response.
- Do not use emoji unless the user explicitly asks.
- Match response length to the task: a simple question gets a direct answer, not headers and sections.

# Executing actions with care

Before taking any of the following actions, explain what you're about to do and ask for confirmation:
- Deleting files or directories
- Destructive git operations (reset --hard, force push, amend published commits)
- Running commands that affect state outside the current project
- Overwriting uncommitted changes

When you hit an obstacle, find the root cause. Do not use destructive shortcuts (e.g. --no-verify) to bypass it.`
      const systemContent = memory ? `${corePrompt}\n\n---\n\n${memory}` : corePrompt
      const sessWithMemory = addMessage(sess, { role: 'system', content: systemContent })
      // Start MCP servers (non-fatal: errors are silently ignored)
      void mcpRegistry.startAll(cfg.mcpServers)

      setConfigState(cfg)
      setSession({ ...sessWithMemory, permissionMode })
      await minDelay
      setSplashReady(true)
    }
    void init()
  }, [])

  useInput((_input, key) => {
    if (phase === 'splash' && splashReady && !key.ctrl) setPhase('repl')
  }, { isActive: phase === 'splash' })

  const handleSubmit = useCallback(async (input: string) => {
    if (!config || !session) return

    const cmd = parseCommand(input)
    if (cmd) {
      // Intercept /model with no args for interactive picker
      if (cmd.name === 'model' && cmd.args.length === 0) {
        setModelSelecting(true)
        return
      }

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

    const btwNotes = session.messages
      .filter(m => m.toolName === BTW_NOTE)
      .map(m => m.content)
    const effectiveInput = btwNotes.length > 0
      ? `[注意事项]\n${btwNotes.join('\n')}\n\n${input}`
      : input

    let current: Session = {
      ...session,
      messages: session.messages.filter(m => m.toolName !== BTW_NOTE),
    }
    current = addMessage(current, { role: 'user', content: input })
    setSession(current)
    setGenerating(true)
    setCurrentPhrase(getPhrase('thinking'))

    const aiMessages = [
      ...sanitizeForApi(current.messages.slice(0, -1)),
      { role: 'user' as const, content: effectiveInput },
    ]

    const modelId = route(input, aiMessages, current.modelOverride)
    const provider = resolveProviderByModelId(modelId, config)
    const t0 = Date.now()

    try {
      let streamBuf = ''
      let turnOutputChars = 0

      for await (const event of agentLoop(aiMessages, provider, config, {
        permissionMode: current.permissionMode,
        requestPermission,
      })) {
        if (event.type === 'token') {
          streamBuf += event.content
          turnOutputChars += event.content.length
          setStreamContent(streamBuf)
          setCurrentPhrase(getPhrase('thinking'))
        } else if (event.type === 'turn_done') {
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
          current = addMessage(current, {
            role: 'tool',
            content: `⚙ ${event.name}(${JSON.stringify(event.args).slice(0, 100)})`,
            toolName: CMD_OUTPUT,
          })
          setSession(current)
        } else if (event.type === 'tool_result') {
          current = addMessage(current, {
            role: 'tool',
            content: event.result.slice(0, 2000),
            toolCallId: event.id,
            toolName: event.name,
          })
          setSession(current)
        } else if (event.type === 'done') {
          await saveSession(current)
          const inputChars = aiMessages.reduce((s, m) => s + m.content.length, 0)
          const inputTok = Math.ceil(inputChars / 3.5)
          const outputTok = Math.ceil(turnOutputChars / 3.5)
          setSessionTokens(prev => ({
            input: prev.input + inputTok,
            output: prev.output + outputTok,
          }))
          await recordUsage({
            date: new Date().toISOString().slice(0, 10),
            costCNY: inputChars / 500000,
            tokens: inputTok + outputTok,
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

  const requestPermission = useCallback(
    (toolName: string, args: Record<string, unknown>): Promise<boolean> =>
      new Promise<boolean>(resolve => setPermissionRequest({ toolName, args, resolve })),
    [],
  )

  const handleAbort = useCallback(() => {
    setGenerating(false)
    setStreamContent('')
  }, [])

  const handleModelSelect = useCallback((model: ModelDef) => {
    setSession(s => s ? { ...s, modelOverride: model.id } : s)
    setModelSelecting(false)
  }, [])

  const handleModelCancel = useCallback(() => {
    setModelSelecting(false)
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
  const currentModelDef = getModelDef(session.modelOverride ?? 'glm-4-flash')
  const modelLabel = session.modelOverride ? currentModelDef.displayName : 'auto'
  const fmtTok = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
  const totalTok = sessionTokens.input + sessionTokens.output

  return (
    <Box flexDirection="column" padding={1}>
      {/* Persistent flower + status header */}
      <Box marginBottom={1} flexDirection="row" alignItems="flex-start">
        <Box marginRight={2}>
          <FlowerArt version="v0.1.0" tagline={config.tagline ?? '实习摸鱼，努力学习'} />
        </Box>
        <Box flexDirection="column" justifyContent="flex-end" alignSelf="flex-end">
          <Text color={theme.dimPurple}>{modelLabel} │ ctx {contextPct}%</Text>
          <Text color={theme.dimPurple}>
            {totalTok > 0
              ? `↑${fmtTok(sessionTokens.input)} ↓${fmtTok(sessionTokens.output)} tokens`
              : 'tokens: —'}
          </Text>
        </Box>
      </Box>

      {/* Model selector overlay */}
      {modelSelecting && (
        <ModelSelector
          currentModelId={session.modelOverride}
          onSelect={handleModelSelect}
          onCancel={handleModelCancel}
        />
      )}

      {/* Permission prompt overlay */}
      {permissionRequest && (
        <PermissionPrompt
          toolName={permissionRequest.toolName}
          args={permissionRequest.args}
          onDecide={(allow) => {
            permissionRequest.resolve(allow)
            setPermissionRequest(null)
          }}
        />
      )}

      {!modelSelecting && (
        <>
          <MessageList messages={session.messages.filter(m => m.role !== 'system')} />

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
        </>
      )}
    </Box>
  )
}
