import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useApp } from 'ink'
import Spinner from 'ink-spinner'
import { theme } from './theme.js'
import { FlowerArt } from './FlowerArt.js'
import { MessageList } from './MessageList.js'
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
import type { PermissionMode } from '../types.js'

interface Props { permissionMode: PermissionMode }

type AppPhase = 'splash' | 'repl'

export function App({ permissionMode }: Props) {
  useApp()
  const [phase, setPhase] = useState<AppPhase>('splash')
  const [config, setConfigState] = useState<AudreyConfig | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [generating, setGenerating] = useState(false)
  const [currentPhrase, setCurrentPhrase] = useState('')
  const [agentTasks] = useState<AgentTask[]>([])
  const [output, setOutput] = useState<string[]>([])

  useEffect(() => {
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
      setTimeout(() => setPhase('repl'), 1500)
    }
    void init()
  }, [])

  const handleSubmit = useCallback(async (input: string) => {
    if (!config || !session) return

    const cmd = parseCommand(input)
    if (cmd) {
      await handleCommand(cmd, {
        session,
        config,
        setSession,
        setConfig: (c) => { setConfigState(c); void saveConfig(c) },
        clearScreen: () => setOutput([]),
        print: (msg) => setOutput(o => [...o, msg]),
      })
      return
    }

    const newSession = addMessage(session, { role: 'user', content: input })
    setSession(newSession)
    setGenerating(true)
    setCurrentPhrase(getPhrase('thinking'))

    const tier = route(input, newSession.messages, newSession.modelOverride)
    const provider = resolveProvider(tier, config)

    try {
      let response = ''
      for await (const chunk of provider.chat(newSession.messages)) {
        response += chunk
      }
      const finalSession = addMessage(newSession, { role: 'assistant', content: response })
      setSession(finalSession)
      await saveSession(finalSession)
    } catch (err: any) {
      setOutput(o => [...o, `[错误] ${err.message}`])
    } finally {
      setGenerating(false)
    }
  }, [config, session])

  const handleAbort = useCallback(() => setGenerating(false), [])

  if (phase === 'splash' || !config || !session) {
    return (
      <Box flexDirection="column" padding={1}>
        <FlowerArt version="v0.1.0" tagline={config?.tagline ?? '实习摸鱼，努力学习'} />
      </Box>
    )
  }

  const contextPct = Math.round(getContextUsage(session, config.sessionMaxTokens) * 100)

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.purple}>Audrey Code v0.1.0  </Text>
        <Text color={theme.dimPurple}>{session.modelOverride ?? 'auto'} │ </Text>
        <Text color={contextPct >= 70 ? theme.yellow : theme.dimPurple}>ctx {contextPct}%</Text>
      </Box>

      <MessageList messages={session.messages.filter(m => m.role !== 'system')} />

      {output.map((line, i) => <Text key={i} color={theme.dimPurple}>{line}</Text>)}

      <AgentStatus tasks={agentTasks} />

      {generating && (
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
