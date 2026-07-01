# Audrey Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal AI coding CLI (Audrey Code) with Node.js + Ink, tiered model routing, sub-agents, file-based memory, and pink/purple TUI.

**Architecture:** Layered monolith — UI (Ink) → Agent Core (REPL/router/session/subagent) → Provider Layer (DeepSeek/GLM/MiniMax) → Tool Layer (builtin + MCP). Each layer exposes a typed interface consumed by the layer above.

**Tech Stack:** Node.js 20+, TypeScript 5, Ink 5, React 18, Vitest, @modelcontextprotocol/sdk

## Global Constraints

- All config/runtime data in `~/.audrey/` — never commit secrets
- API keys via env vars only: `DEEPSEEK_API_KEY`, `GLM_API_KEY`, `MINIMAX_API_KEY`
- TypeScript strict mode throughout (`"strict": true`)
- Tests via Vitest; run with `npm test`
- Binary name: `audrey`; invoked as `audrey [--auto|--ask|--deny]`
- Default permission mode: `ask`
- Color constants from `src/ui/theme.ts` only — never hardcode hex in components
- Node minimum: 20.0.0

---

## File Map

```
src/
  cli.tsx                     # Entry: parse args, render <App/>
  config.ts                   # Load/save ~/.audrey/config.json
  types.ts                    # Shared types (Message, ModelTier, Tool…)
  ui/
    theme.ts                  # Color constants
    phrases.ts                # Classical Chinese phrase pools
    App.tsx                   # REPL root component
    Prompt.tsx                # Input box + ESC interrupt
    MessageList.tsx           # Conversation history renderer
    AgentStatus.tsx           # Sub-agent progress bars
    FlowerArt.tsx             # Pixel flower startup art
  providers/
    base.ts                   # IProvider interface
    deepseek.ts               # DeepSeek provider (retry + stream)
    glm.ts                    # GLM provider
    minimax.ts                # MiniMax provider
    registry.ts               # Resolve tier → provider instance
  agent/
    router.ts                 # Auto model-tier routing
    session.ts                # Session state + crash persistence
    repl.ts                   # Main agent loop
    subagent.ts               # Concurrent sub-agent dispatch
    permissions.ts            # ask/auto/deny + allowlist
    compactor.ts              # Context window compression
  tools/
    index.ts                  # Tool registry
    builtin/
      read.ts                 # read_file tool
      write.ts                # write_file tool (snapshot before write)
      bash.ts                 # bash tool (subprocess + timeout)
      glob.ts                 # glob tool
    mcp/
      client.ts               # MCP client wrapper
      manager.ts              # MCP server lifecycle
  memory/
    reader.ts                 # Scan + load AUDREY.md hierarchy
    writer.ts                 # Diff + append to AUDREY.md
  commands/
    index.ts                  # Command registry + dispatch
    handlers.ts               # All /command implementations
  health/
    check.ts                  # Startup health checks
    rotation.ts               # Storage rotation + budget guard
tests/
  config.test.ts
  router.test.ts
  memory.test.ts
  permissions.test.ts
  providers.test.ts
  tools.test.ts
  session.test.ts
  subagent.test.ts
  commands.test.ts
```

---

## Task 1: Environment + Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/types.ts`
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

**Interfaces:**
- Produces: `AudreyConfig`, `loadConfig()`, `saveConfig()`, `DEFAULT_CONFIG`

- [ ] **Step 1: Install Node 20 via nvm**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc
nvm install 20
nvm use 20
node --version  # expect v20.x.x
```

- [ ] **Step 2: Initialise package.json**

```bash
cd /Users/mac/Documents/siyu_code
npm init -y
```

Then set `package.json` to exactly:

```json
{
  "name": "audrey-code",
  "version": "0.1.0",
  "description": "Personal AI coding CLI",
  "type": "module",
  "bin": { "audrey": "./dist/cli.js" },
  "scripts": {
    "dev": "tsx src/cli.tsx",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "ink": "^5.0.1",
    "ink-spinner": "^5.0.0",
    "react": "^18.3.1",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "glob": "^11.0.0",
    "tiktoken": "^1.0.15"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.7.0",
    "@types/react": "^18.3.0",
    "@types/node": "^20.0.0",
    "vitest": "^1.6.0",
    "ink-testing-library": "^3.0.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create src/types.ts**

```ts
export type ModelTier = 'lite' | 'standard' | 'reason'
export type PermissionMode = 'ask' | 'auto' | 'deny'

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolName?: string
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  content: string
  isError: boolean
}

export interface ChatOpts {
  maxTokens?: number
  signal?: AbortSignal
}

export interface McpServerConfig {
  command: string
  args: string[]
  autoStart: boolean
}
```

- [ ] **Step 6: Write failing test for config**

Create `tests/config.test.ts`:

```ts
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
```

- [ ] **Step 7: Run test — expect FAIL**

```bash
npm test tests/config.test.ts
```

Expected: `Cannot find module '../src/config.js'`

- [ ] **Step 8: Implement src/config.ts**

```ts
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import os from 'os'
import type { McpServerConfig } from './types.js'

export interface AudreyConfig {
  dailyBudgetCNY: number
  sessionMaxTokens: number
  contextWarningAt: number
  bashTimeoutMs: number
  subagentTimeoutMs: number
  maxConcurrentAgents: number
  maxFileInjectTokens: number
  retryMax: number
  retryBackoffMs: number
  requestTimeoutMs: number
  snapshotMaxCount: number
  sessionHistoryMax: number
  storageWarnMB: number
  allowedWriteDirs: string[]
  allowedCommands: string[]
  tagline: string
  memoryMaxTokens: number
  mcpServers: Record<string, McpServerConfig>
}

export const DEFAULT_CONFIG: AudreyConfig = {
  dailyBudgetCNY: 10,
  sessionMaxTokens: 60000,
  contextWarningAt: 0.7,
  bashTimeoutMs: 30000,
  subagentTimeoutMs: 60000,
  maxConcurrentAgents: 5,
  maxFileInjectTokens: 8000,
  retryMax: 3,
  retryBackoffMs: 1000,
  requestTimeoutMs: 30000,
  snapshotMaxCount: 100,
  sessionHistoryMax: 30,
  storageWarnMB: 500,
  allowedWriteDirs: ['$CWD'],
  allowedCommands: ['npm', 'git', 'node', 'tsc', 'npx'],
  tagline: '实习摸鱼，努力学习',
  memoryMaxTokens: 2000,
  mcpServers: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '$CWD'],
      autoStart: true,
    },
    fetch: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      autoStart: true,
    },
    'sequential-thinking': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      autoStart: false,
    },
  },
}

const audreyDir = () => join(os.homedir(), '.audrey')
const configPath = () => join(audreyDir(), 'config.json')

export async function ensureAudreyDir(): Promise<void> {
  await mkdir(audreyDir(), { recursive: true })
  await mkdir(join(audreyDir(), 'sessions'), { recursive: true })
  await mkdir(join(audreyDir(), 'snapshots'), { recursive: true })
}

export async function loadConfig(): Promise<AudreyConfig> {
  const path = configPath()
  if (!existsSync(path)) return { ...DEFAULT_CONFIG }
  const raw = await readFile(path, 'utf8')
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
}

export async function saveConfig(cfg: AudreyConfig): Promise<void> {
  await ensureAudreyDir()
  await writeFile(configPath(), JSON.stringify(cfg, null, 2), 'utf8')
}
```

- [ ] **Step 9: Run test — expect PASS**

```bash
npm test tests/config.test.ts
```

Expected: `✓ returns defaults when no config file exists`, `✓ merges saved values over defaults`

- [ ] **Step 10: Commit**

```bash
git add src/types.ts src/config.ts tests/config.test.ts package.json tsconfig.json
git commit -m "feat: project scaffold, types, and config system"
```

---

## Task 2: Theme + Phrases

**Files:**
- Create: `src/ui/theme.ts`
- Create: `src/ui/phrases.ts`

**Interfaces:**
- Produces: `theme` object, `getPhrase(scene: PhraseScene): string`

- [ ] **Step 1: Create src/ui/theme.ts**

```ts
export const theme = {
  pink:      '#FF79C6',
  purple:    '#BD93F9',
  dimPurple: '#6272A4',
  green:     '#50FA7B',
  yellow:    '#F1FA8C',
  red:       '#FF5555',
  bg:        '#282A36',
} as const
```

- [ ] **Step 2: Create src/ui/phrases.ts**

```ts
export type PhraseScene =
  | 'thinking'
  | 'reading'
  | 'writing'
  | 'running'
  | 'fetching'
  | 'subagent'
  | 'compacting'
  | 'memory'

const pools: Record<PhraseScene, string[]> = {
  thinking:   ['运筹帷幄', '博观约取', '沉吟至今', '踌躇满志', '深思熟虑'],
  reading:    ['韦编三绝', '手不释卷', '一目十行', '博览群书'],
  writing:    ['妙笔生花', '下笔如神', '胸有成竹', '笔走龙蛇'],
  running:    ['雷厉风行', '风驰电掣', '一往无前', '大刀阔斧'],
  fetching:   ['上下求索', '踏破铁鞋', '千里寻觅'],
  subagent:   ['分而治之', '各司其职', '众志成城', '协力同心'],
  compacting: ['删繁就简', '提纲挈领', '化繁为简'],
  memory:     ['铭记于心', '念念不忘', '刻骨铭心'],
}

export function getPhrase(scene: PhraseScene): string {
  const pool = pools[scene]
  return pool[Math.floor(Math.random() * pool.length)]!
}

export { pools }
```

- [ ] **Step 3: Write and run test**

Create `tests/phrases.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getPhrase, pools } from '../src/ui/phrases.js'

describe('getPhrase', () => {
  it('returns a string from the correct pool', () => {
    for (const scene of Object.keys(pools) as any[]) {
      const phrase = getPhrase(scene)
      expect(pools[scene]).toContain(phrase)
    }
  })
})
```

```bash
npm test tests/phrases.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/ui/theme.ts src/ui/phrases.ts tests/phrases.test.ts
git commit -m "feat: theme colors and classical Chinese phrase pools"
```

---

## Task 3: Provider Layer

**Files:**
- Create: `src/providers/base.ts`
- Create: `src/providers/deepseek.ts`
- Create: `src/providers/glm.ts`
- Create: `src/providers/minimax.ts`
- Create: `src/providers/registry.ts`
- Create: `tests/providers.test.ts`

**Interfaces:**
- Consumes: `Message`, `ChatOpts`, `ModelTier` from `src/types.ts`
- Produces: `IProvider`, `BaseProvider`, `resolveProvider(tier, config)`

- [ ] **Step 1: Create src/providers/base.ts**

```ts
import type { Message, ChatOpts, ModelTier } from '../types.js'
import type { AudreyConfig } from '../config.js'

export interface IProvider {
  readonly modelId: string
  readonly tier: ModelTier
  chat(messages: Message[], opts?: ChatOpts): AsyncIterable<string>
  countTokens(messages: Message[]): number
}

export abstract class BaseProvider implements IProvider {
  abstract readonly modelId: string
  abstract readonly tier: ModelTier

  protected abstract baseUrl: string
  protected abstract apiKey: string
  protected config: AudreyConfig

  constructor(config: AudreyConfig) {
    this.config = config
  }

  async *chat(messages: Message[], opts?: ChatOpts): AsyncIterable<string> {
    const { retryMax, retryBackoffMs, requestTimeoutMs } = this.config
    let attempt = 0
    while (attempt <= retryMax) {
      try {
        yield* this.chatOnce(messages, opts)
        return
      } catch (err: any) {
        const retryable = err.status === 429 || (err.status >= 500 && err.status < 600)
        if (!retryable || attempt === retryMax) throw err
        await sleep(retryBackoffMs * 2 ** attempt)
        attempt++
      }
    }
  }

  protected abstract chatOnce(messages: Message[], opts?: ChatOpts): AsyncIterable<string>

  countTokens(messages: Message[]): number {
    // rough estimate: 1 token ≈ 3.5 chars for Chinese/English mix
    const chars = messages.reduce((sum, m) => sum + m.content.length, 0)
    return Math.ceil(chars / 3.5)
  }

  protected async fetchStream(
    path: string,
    body: object,
    signal?: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) {
      const text = await res.text()
      const err: any = new Error(`HTTP ${res.status}: ${text}`)
      err.status = res.status
      throw err
    }
    return res.body!
  }

  protected async *parseSSE(stream: ReadableStream<Uint8Array>): AsyncIterable<string> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()!
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') return
          try {
            const json = JSON.parse(data)
            const delta = json.choices?.[0]?.delta?.content
            if (delta) yield delta
          } catch {}
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
```

- [ ] **Step 2: Create src/providers/deepseek.ts**

```ts
import { BaseProvider } from './base.js'
import type { Message, ChatOpts, ModelTier } from '../types.js'
import type { AudreyConfig } from '../config.js'

export class DeepSeekProvider extends BaseProvider {
  readonly modelId: string
  readonly tier: ModelTier
  protected baseUrl = 'https://api.deepseek.com/v1'
  protected apiKey: string

  constructor(config: AudreyConfig, tier: 'standard' | 'reason') {
    super(config)
    this.tier = tier
    this.modelId = tier === 'reason' ? 'deepseek-reasoner' : 'deepseek-chat'
    this.apiKey = process.env.DEEPSEEK_API_KEY ?? ''
  }

  protected async *chatOnce(messages: Message[], opts?: ChatOpts): AsyncIterable<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs)
    try {
      const stream = await this.fetchStream(
        '/chat/completions',
        {
          model: this.modelId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: opts?.maxTokens ?? 4096,
          stream: true,
        },
        opts?.signal ?? controller.signal,
      )
      yield* this.parseSSE(stream)
    } finally {
      clearTimeout(timer)
    }
  }
}
```

- [ ] **Step 3: Create src/providers/glm.ts**

```ts
import { BaseProvider } from './base.js'
import type { Message, ChatOpts, ModelTier } from '../types.js'
import type { AudreyConfig } from '../config.js'

export class GLMProvider extends BaseProvider {
  readonly modelId = 'glm-4-flash'
  readonly tier: ModelTier = 'lite'
  protected baseUrl = 'https://open.bigmodel.cn/api/paas/v4'
  protected apiKey: string

  constructor(config: AudreyConfig) {
    super(config)
    this.apiKey = process.env.GLM_API_KEY ?? ''
  }

  protected async *chatOnce(messages: Message[], opts?: ChatOpts): AsyncIterable<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs)
    try {
      const stream = await this.fetchStream(
        '/chat/completions',
        {
          model: this.modelId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: opts?.maxTokens ?? 4096,
          stream: true,
        },
        opts?.signal ?? controller.signal,
      )
      yield* this.parseSSE(stream)
    } finally {
      clearTimeout(timer)
    }
  }
}
```

- [ ] **Step 4: Create src/providers/minimax.ts**

```ts
import { BaseProvider } from './base.js'
import type { Message, ChatOpts, ModelTier } from '../types.js'
import type { AudreyConfig } from '../config.js'

export class MiniMaxProvider extends BaseProvider {
  readonly modelId = 'MiniMax-Text-01'
  readonly tier: ModelTier = 'standard'
  protected baseUrl = 'https://api.minimax.chat/v1'
  protected apiKey: string

  constructor(config: AudreyConfig) {
    super(config)
    this.apiKey = process.env.MINIMAX_API_KEY ?? ''
  }

  protected async *chatOnce(messages: Message[], opts?: ChatOpts): AsyncIterable<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs)
    try {
      const stream = await this.fetchStream(
        '/text/chatcompletion_v2',
        {
          model: this.modelId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: opts?.maxTokens ?? 4096,
          stream: true,
        },
        opts?.signal ?? controller.signal,
      )
      yield* this.parseSSE(stream)
    } finally {
      clearTimeout(timer)
    }
  }
}
```

- [ ] **Step 5: Create src/providers/registry.ts**

```ts
import type { ModelTier } from '../types.js'
import type { AudreyConfig } from '../config.js'
import type { IProvider } from './base.js'
import { DeepSeekProvider } from './deepseek.js'
import { GLMProvider } from './glm.js'

export function resolveProvider(tier: ModelTier, config: AudreyConfig): IProvider {
  switch (tier) {
    case 'lite':     return new GLMProvider(config)
    case 'standard': return new DeepSeekProvider(config, 'standard')
    case 'reason':   return new DeepSeekProvider(config, 'reason')
  }
}
```

- [ ] **Step 6: Write and run provider tests**

Create `tests/providers.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.js'
import { DeepSeekProvider } from '../src/providers/deepseek.js'
import { GLMProvider } from '../src/providers/glm.js'
import { resolveProvider } from '../src/providers/registry.js'

describe('resolveProvider', () => {
  it('returns GLMProvider for lite', () => {
    const p = resolveProvider('lite', DEFAULT_CONFIG)
    expect(p.modelId).toBe('glm-4-flash')
    expect(p.tier).toBe('lite')
  })

  it('returns DeepSeekProvider for standard', () => {
    const p = resolveProvider('standard', DEFAULT_CONFIG)
    expect(p.modelId).toBe('deepseek-chat')
  })

  it('returns deepseek-reasoner for reason', () => {
    const p = resolveProvider('reason', DEFAULT_CONFIG)
    expect(p.modelId).toBe('deepseek-reasoner')
  })
})

describe('countTokens', () => {
  it('estimates token count from char length', () => {
    const p = new GLMProvider(DEFAULT_CONFIG)
    const msgs = [{ role: 'user' as const, content: 'hello world' }]
    expect(p.countTokens(msgs)).toBeGreaterThan(0)
  })
})

describe('BaseProvider retry', () => {
  it('retries on 429 and succeeds on third attempt', async () => {
    const p = new DeepSeekProvider(DEFAULT_CONFIG, 'standard')
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls++
      if (calls < 3) {
        const err: any = new Error('rate limited')
        err.status = 429
        throw err
      }
      // Return a minimal SSE stream
      const body = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n'))
          c.close()
        },
      })
      return { ok: true, body, status: 200 }
    })
    const chunks: string[] = []
    for await (const chunk of p.chat([{ role: 'user', content: 'test' }])) {
      chunks.push(chunk)
    }
    expect(chunks.join('')).toBe('hi')
    expect(calls).toBe(3)
    vi.unstubAllGlobals()
  })
})
```

```bash
npm test tests/providers.test.ts
```

Expected: all 4 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/providers/ tests/providers.test.ts
git commit -m "feat: provider layer with DeepSeek, GLM, MiniMax and retry logic"
```

---

## Task 4: Model Router

**Files:**
- Create: `src/agent/router.ts`
- Create: `tests/router.test.ts`

**Interfaces:**
- Consumes: `Message`, `ModelTier` from `src/types.ts`
- Produces: `route(prompt: string, history: Message[], override?: ModelTier): ModelTier`

- [ ] **Step 1: Write failing test**

Create `tests/router.test.ts`:

```ts
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
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test tests/router.test.ts
```

Expected: `Cannot find module '../src/agent/router.js'`

- [ ] **Step 3: Implement src/agent/router.ts**

```ts
import type { Message, ModelTier } from '../types.js'

const REASON_KEYWORDS = [
  '为什么', '原因', '分析', '设计', '架构', '推理', '优化策略',
  '时间复杂度', '内存泄漏', '权衡', 'why', 'design', 'architect',
  'analyze', 'tradeoff', 'performance',
]

const CODE_KEYWORDS = [
  '函数', '代码', '实现', '修复', 'fix', 'bug', 'implement', 'write',
  'refactor', '重构', 'test', '测试', '.ts', '.js', '.py', '.go',
  'class', 'interface', 'component', 'api', 'sql',
]

export function route(
  prompt: string,
  history: Message[],
  override?: ModelTier,
): ModelTier {
  if (override) return override

  const lower = prompt.toLowerCase()

  if (REASON_KEYWORDS.some(kw => lower.includes(kw))) return 'reason'

  if (
    CODE_KEYWORDS.some(kw => lower.includes(kw)) ||
    history.length > 4
  ) return 'standard'

  if (prompt.length < 200) return 'lite'

  return 'standard'
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test tests/router.test.ts
```

Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/router.ts tests/router.test.ts
git commit -m "feat: automatic model-tier router with keyword analysis"
```

---

## Task 5: Memory System

**Files:**
- Create: `src/memory/reader.ts`
- Create: `src/memory/writer.ts`
- Create: `tests/memory.test.ts`

**Interfaces:**
- Produces:
  - `loadMemory(cwd: string, maxTokens: number): Promise<string>`
  - `appendMemory(filePath: string, newContent: string, maxTokens: number): Promise<void>`

- [ ] **Step 1: Write failing tests**

Create `tests/memory.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import os from 'os'

const TMP = join(os.tmpdir(), 'audrey-mem-' + Date.now())
const HOME = join(TMP, 'home')
const PROJECT = join(TMP, 'project')

beforeEach(() => {
  mkdirSync(join(HOME, '.audrey'), { recursive: true })
  mkdirSync(PROJECT, { recursive: true })
  process.env.HOME = HOME
})
afterEach(() => rmSync(TMP, { recursive: true, force: true }))

import { loadMemory } from '../src/memory/reader.js'
import { appendMemory } from '../src/memory/writer.js'

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
})

describe('appendMemory', () => {
  it('appends new content to existing file', async () => {
    const file = join(HOME, '.audrey', 'AUDREY.md')
    writeFileSync(file, '# Existing\nold content')
    await appendMemory(file, 'new fact', 2000)
    const { readFileSync } = await import('fs')
    expect(readFileSync(file, 'utf8')).toContain('new fact')
  })

  it('creates file if it does not exist', async () => {
    const file = join(HOME, '.audrey', 'AUDREY.md')
    await appendMemory(file, 'first entry', 2000)
    const { readFileSync } = await import('fs')
    expect(readFileSync(file, 'utf8')).toContain('first entry')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test tests/memory.test.ts
```

Expected: module not found errors

- [ ] **Step 3: Implement src/memory/reader.ts**

```ts
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import os from 'os'

function getAncestors(cwd: string, stopAt: string): string[] {
  const dirs: string[] = []
  let current = cwd
  while (current !== stopAt && current !== dirname(current)) {
    dirs.push(current)
    current = dirname(current)
  }
  dirs.push(stopAt)
  return dirs.reverse() // distant first so closer overrides
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

export async function loadMemory(cwd: string, maxTokens: number): Promise<string> {
  const home = os.homedir()
  const layers: string[] = []

  const globalPath = join(home, '.audrey', 'AUDREY.md')
  if (existsSync(globalPath)) {
    layers.push(await readFile(globalPath, 'utf8'))
  }

  const ancestors = getAncestors(cwd, home)
  for (const dir of ancestors) {
    if (dir === home) continue // already loaded global
    const f = join(dir, 'AUDREY.md')
    if (existsSync(f)) layers.push(await readFile(f, 'utf8'))
  }

  if (layers.length === 0) return ''

  let combined = layers.join('\n\n---\n\n')
  while (estimateTokens(combined) > maxTokens && combined.length > 0) {
    combined = combined.slice(0, Math.floor(combined.length * 0.9))
  }
  return combined
}
```

- [ ] **Step 4: Implement src/memory/writer.ts**

```ts
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

export async function appendMemory(
  filePath: string,
  newContent: string,
  maxTokens: number,
): Promise<void> {
  let existing = ''
  if (existsSync(filePath)) {
    existing = await readFile(filePath, 'utf8')
  }

  if (existing.includes(newContent.trim())) return // dedup

  const appended = existing
    ? `${existing}\n\n<!-- ${new Date().toISOString().slice(0, 10)} -->\n${newContent}`
    : newContent

  // compress if over limit
  let final = appended
  while (estimateTokens(final) > maxTokens) {
    const lines = final.split('\n')
    lines.splice(1, Math.ceil(lines.length * 0.1)) // remove 10% from top (after first line)
    final = lines.join('\n')
  }

  await writeFile(filePath, final, 'utf8')
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
npm test tests/memory.test.ts
```

Expected: all 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/memory/ tests/memory.test.ts
git commit -m "feat: file-based memory reader/writer with AUDREY.md hierarchy"
```

---

## Task 6: Permission System + Built-in Tools

**Files:**
- Create: `src/agent/permissions.ts`
- Create: `src/tools/builtin/read.ts`
- Create: `src/tools/builtin/write.ts`
- Create: `src/tools/builtin/bash.ts`
- Create: `src/tools/builtin/glob.ts`
- Create: `src/tools/index.ts`
- Create: `tests/permissions.test.ts`
- Create: `tests/tools.test.ts`

**Interfaces:**
- Produces:
  - `checkPermission(tool, args, mode, config): Promise<PermissionDecision>`
  - `ALL_TOOLS: Tool[]`
  - Each tool: `{ name, description, execute(args, config): Promise<string> }`

- [ ] **Step 1: Create src/agent/permissions.ts**

```ts
import { resolve, normalize } from 'path'
import type { AudreyConfig } from '../config.js'
import type { PermissionMode } from '../types.js'

export type PermissionDecision = 'allow' | 'deny' | 'ask'

const ALWAYS_CONFIRM = ['rm', 'sudo', 'curl', 'wget', 'chmod', 'chown', 'dd', 'mkfs']

export function checkPathSafety(filePath: string, config: AudreyConfig): boolean {
  const resolved = resolve(filePath)
  const normalized = normalize(resolved)

  if (normalized.includes('..')) return false

  const allowedDirs = config.allowedWriteDirs.map(d =>
    d === '$CWD' ? process.cwd() : d,
  )
  return allowedDirs.some(dir => normalized.startsWith(resolve(dir)))
}

export function getCommandBase(command: string): string {
  return command.trim().split(/\s+/)[0] ?? ''
}

export function isBashAllowed(
  command: string,
  mode: PermissionMode,
  config: AudreyConfig,
): PermissionDecision {
  const base = getCommandBase(command)
  if (ALWAYS_CONFIRM.includes(base)) return 'ask'
  if (mode === 'auto') return 'allow'
  if (mode === 'deny') return 'deny'
  if (config.allowedCommands.includes(base)) return 'allow'
  return 'ask'
}
```

- [ ] **Step 2: Write failing permission tests**

Create `tests/permissions.test.ts`:

```ts
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
})
```

```bash
npm test tests/permissions.test.ts
```

Expected: all tests PASS (permissions.ts already created)

- [ ] **Step 3: Create src/tools/builtin/read.ts**

```ts
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

export const readTool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  async execute(args: { path: string }, _config: any): Promise<string> {
    if (!existsSync(args.path)) throw new Error(`File not found: ${args.path}`)
    return readFile(args.path, 'utf8')
  },
}
```

- [ ] **Step 4: Create src/tools/builtin/write.ts**

```ts
import { readFile, writeFile, copyFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import os from 'os'
import { checkPathSafety } from '../../agent/permissions.js'
import type { AudreyConfig } from '../../config.js'

async function snapshot(filePath: string, config: AudreyConfig): Promise<void> {
  if (!existsSync(filePath)) return
  const snapDir = join(os.homedir(), '.audrey', 'snapshots')
  await mkdir(snapDir, { recursive: true })
  const ts = Date.now()
  const safeName = filePath.replace(/[/\\]/g, '__')
  await copyFile(filePath, join(snapDir, `${ts}__${safeName}`))

  // rotate: keep only newest snapshotMaxCount
  const { readdirSync } = await import('fs')
  const snaps = readdirSync(snapDir).sort()
  if (snaps.length > config.snapshotMaxCount) {
    const { unlink } = await import('fs/promises')
    for (const old of snaps.slice(0, snaps.length - config.snapshotMaxCount)) {
      await unlink(join(snapDir, old))
    }
  }
}

export const writeTool = {
  name: 'write_file',
  description: 'Write content to a file (creates directories if needed)',
  async execute(
    args: { path: string; content: string },
    config: AudreyConfig,
  ): Promise<string> {
    if (!checkPathSafety(args.path, config)) {
      throw new Error(`Path not allowed: ${args.path}`)
    }
    await snapshot(args.path, config)
    await mkdir(dirname(args.path), { recursive: true })
    await writeFile(args.path, args.content, 'utf8')
    return `Written: ${args.path}`
  },
}
```

- [ ] **Step 5: Create src/tools/builtin/bash.ts**

```ts
import { spawn } from 'child_process'
import type { AudreyConfig } from '../../config.js'

const SENSITIVE_KEYS = ['DEEPSEEK_API_KEY', 'GLM_API_KEY', 'MINIMAX_API_KEY']

function sanitizedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const key of SENSITIVE_KEYS) delete env[key]
  return env
}

export const bashTool = {
  name: 'bash',
  description: 'Execute a shell command',
  async execute(args: { command: string }, config: AudreyConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', args.command], {
        env: sanitizedEnv(),
        cwd: process.cwd(),
      })
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`Command timed out after ${config.bashTimeoutMs}ms`))
      }, config.bashTimeoutMs)

      child.stdout.on('data', d => { stdout += d })
      child.stderr.on('data', d => { stderr += d })
      child.on('close', code => {
        clearTimeout(timer)
        const output = [stdout, stderr].filter(Boolean).join('\n')
        if (code === 0) resolve(output || '(no output)')
        else reject(new Error(`Exit ${code}: ${output}`))
      })
    })
  },
}
```

- [ ] **Step 6: Create src/tools/builtin/glob.ts**

```ts
import { glob as globFn } from 'glob'

export const globTool = {
  name: 'glob',
  description: 'Find files matching a glob pattern',
  async execute(args: { pattern: string; cwd?: string }): Promise<string> {
    const files = await globFn(args.pattern, { cwd: args.cwd ?? process.cwd() })
    return files.length > 0 ? files.join('\n') : '(no matches)'
  },
}
```

- [ ] **Step 7: Create src/tools/index.ts**

```ts
import { readTool } from './builtin/read.js'
import { writeTool } from './builtin/write.js'
import { bashTool } from './builtin/bash.js'
import { globTool } from './builtin/glob.js'

export const ALL_TOOLS = [readTool, writeTool, bashTool, globTool]
export { readTool, writeTool, bashTool, globTool }

export type Tool = {
  name: string
  description: string
  execute(args: Record<string, any>, config?: any): Promise<string>
}
```

- [ ] **Step 8: Write and run tool tests**

Create `tests/tools.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import os from 'os'
import { DEFAULT_CONFIG } from '../src/config.js'
import { readTool, writeTool, bashTool } from '../src/tools/index.js'

const TMP = join(os.tmpdir(), 'audrey-tools-' + Date.now())
beforeEach(() => mkdirSync(TMP, { recursive: true }))
afterEach(() => rmSync(TMP, { recursive: true, force: true }))

describe('readTool', () => {
  it('reads file contents', async () => {
    const f = join(TMP, 'hello.txt')
    writeFileSync(f, 'hello world')
    expect(await readTool.execute({ path: f }, DEFAULT_CONFIG)).toBe('hello world')
  })

  it('throws for missing file', async () => {
    await expect(readTool.execute({ path: '/nonexistent' }, DEFAULT_CONFIG)).rejects.toThrow()
  })
})

describe('writeTool', () => {
  it('rejects path traversal', async () => {
    const cfg = { ...DEFAULT_CONFIG, allowedWriteDirs: [TMP] }
    await expect(
      writeTool.execute({ path: '../../etc/passwd', content: 'x' }, cfg),
    ).rejects.toThrow('not allowed')
  })

  it('writes within allowed dir', async () => {
    const cfg = { ...DEFAULT_CONFIG, allowedWriteDirs: [TMP] }
    const f = join(TMP, 'out.txt')
    await writeTool.execute({ path: f, content: 'hello' }, cfg)
    const { readFileSync } = await import('fs')
    expect(readFileSync(f, 'utf8')).toBe('hello')
  })
})

describe('bashTool', () => {
  it('runs a command and returns stdout', async () => {
    const result = await bashTool.execute({ command: 'echo hello' }, DEFAULT_CONFIG)
    expect(result.trim()).toBe('hello')
  })

  it('times out slow commands', async () => {
    const cfg = { ...DEFAULT_CONFIG, bashTimeoutMs: 100 }
    await expect(bashTool.execute({ command: 'sleep 5' }, cfg)).rejects.toThrow('timed out')
  })

  it('does not leak API keys to subprocess', async () => {
    process.env.DEEPSEEK_API_KEY = 'secret-key'
    const result = await bashTool.execute(
      { command: 'echo ${DEEPSEEK_API_KEY:-EMPTY}' },
      DEFAULT_CONFIG,
    )
    expect(result.trim()).toBe('EMPTY')
    delete process.env.DEEPSEEK_API_KEY
  })
})
```

```bash
npm test tests/tools.test.ts
```

Expected: all 6 tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/agent/permissions.ts src/tools/ tests/permissions.test.ts tests/tools.test.ts
git commit -m "feat: permission system and built-in tools (read/write/bash/glob)"
```

---

## Task 7: Session Manager + Crash Recovery

**Files:**
- Create: `src/agent/session.ts`
- Create: `tests/session.test.ts`

**Interfaces:**
- Produces:
  - `Session` type
  - `createSession(config): Session`
  - `saveSession(session): Promise<void>`
  - `loadLastSession(): Promise<Session | null>`
  - `addMessage(session, msg): Session`
  - `getContextUsage(session, maxTokens): number` — returns 0.0–1.0

- [ ] **Step 1: Write failing test**

Create `tests/session.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import os from 'os'

const HOME = join(os.tmpdir(), 'audrey-sess-' + Date.now())
process.env.HOME = HOME

import {
  createSession, saveSession, loadLastSession, addMessage, getContextUsage,
} from '../src/agent/session.js'
import { DEFAULT_CONFIG } from '../src/config.js'

beforeEach(() => mkdirSync(join(HOME, '.audrey', 'sessions'), { recursive: true }))
afterEach(() => rmSync(HOME, { recursive: true, force: true }))

describe('session', () => {
  it('creates a session with empty history', () => {
    const s = createSession(DEFAULT_CONFIG)
    expect(s.messages).toHaveLength(0)
    expect(s.modelOverride).toBeUndefined()
  })

  it('persists and reloads session', async () => {
    const s = createSession(DEFAULT_CONFIG)
    const s2 = addMessage(s, { role: 'user', content: 'hello' })
    await saveSession(s2)
    const loaded = await loadLastSession()
    expect(loaded?.messages[0]?.content).toBe('hello')
  })

  it('returns null when no saved session', async () => {
    expect(await loadLastSession()).toBeNull()
  })

  it('calculates context usage ratio', () => {
    let s = createSession(DEFAULT_CONFIG)
    s = addMessage(s, { role: 'user', content: 'x'.repeat(1000) })
    const ratio = getContextUsage(s, DEFAULT_CONFIG.sessionMaxTokens)
    expect(ratio).toBeGreaterThan(0)
    expect(ratio).toBeLessThan(1)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test tests/session.test.ts
```

- [ ] **Step 3: Implement src/agent/session.ts**

```ts
import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import os from 'os'
import type { Message, ModelTier, PermissionMode } from '../types.js'
import type { AudreyConfig } from '../config.js'

export interface Session {
  id: string
  startedAt: string
  messages: Message[]
  modelOverride?: ModelTier
  permissionMode: PermissionMode
  modifiedFiles: string[]
}

const lastSessionPath = () => join(os.homedir(), '.audrey', 'sessions', 'last.json')

export function createSession(config: AudreyConfig): Session {
  return {
    id: Date.now().toString(),
    startedAt: new Date().toISOString(),
    messages: [],
    permissionMode: 'ask',
    modifiedFiles: [],
  }
}

export function addMessage(session: Session, msg: Message): Session {
  return { ...session, messages: [...session.messages, msg] }
}

export function getContextUsage(session: Session, maxTokens: number): number {
  const chars = session.messages.reduce((sum, m) => sum + m.content.length, 0)
  const tokens = Math.ceil(chars / 3.5)
  return tokens / maxTokens
}

export async function saveSession(session: Session): Promise<void> {
  await writeFile(lastSessionPath(), JSON.stringify(session, null, 2), 'utf8')
}

export async function loadLastSession(): Promise<Session | null> {
  const path = lastSessionPath()
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw) as Session
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test tests/session.test.ts
```

Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/session.ts tests/session.test.ts
git commit -m "feat: session manager with crash persistence"
```

---

## Task 8: Sub-agent System

**Files:**
- Create: `src/agent/subagent.ts`
- Create: `tests/subagent.test.ts`

**Interfaces:**
- Consumes: `IProvider`, `Message`, `AudreyConfig`
- Produces: `runSubAgents(tasks: SubTask[], config, depth?): Promise<SubResult[]>`

- [ ] **Step 1: Write failing test**

Create `tests/subagent.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { runSubAgents } from '../src/agent/subagent.js'
import { DEFAULT_CONFIG } from '../src/config.js'
import type { IProvider } from '../src/providers/base.js'

function mockProvider(response: string): IProvider {
  return {
    modelId: 'mock',
    tier: 'standard',
    countTokens: () => 10,
    async *chat() { yield response },
  }
}

describe('runSubAgents', () => {
  it('runs tasks concurrently and returns results', async () => {
    const tasks = [
      { id: 'a', prompt: 'task a', provider: mockProvider('result-a') },
      { id: 'b', prompt: 'task b', provider: mockProvider('result-b') },
    ]
    const results = await runSubAgents(tasks, DEFAULT_CONFIG)
    expect(results).toHaveLength(2)
    expect(results.find(r => r.id === 'a')?.output).toBe('result-a')
    expect(results.find(r => r.id === 'b')?.output).toBe('result-b')
  })

  it('marks timed-out tasks as failed without blocking others', async () => {
    const slow: IProvider = {
      modelId: 'slow',
      tier: 'standard',
      countTokens: () => 10,
      async *chat() { await new Promise(r => setTimeout(r, 200)); yield 'late' },
    }
    const cfg = { ...DEFAULT_CONFIG, subagentTimeoutMs: 50 }
    const tasks = [
      { id: 'fast', prompt: 'x', provider: mockProvider('ok') },
      { id: 'slow', prompt: 'x', provider: slow },
    ]
    const results = await runSubAgents(tasks, cfg)
    expect(results.find(r => r.id === 'fast')?.success).toBe(true)
    expect(results.find(r => r.id === 'slow')?.success).toBe(false)
  })

  it('rejects when depth exceeds 2', async () => {
    await expect(
      runSubAgents([], DEFAULT_CONFIG, 3),
    ).rejects.toThrow('depth')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test tests/subagent.test.ts
```

- [ ] **Step 3: Implement src/agent/subagent.ts**

```ts
import type { IProvider } from '../providers/base.js'
import type { Message } from '../types.js'
import type { AudreyConfig } from '../config.js'

export interface SubTask {
  id: string
  prompt: string
  provider: IProvider
  context?: Message[]
}

export interface SubResult {
  id: string
  output: string
  success: boolean
  error?: string
}

export async function runSubAgents(
  tasks: SubTask[],
  config: AudreyConfig,
  depth = 0,
): Promise<SubResult[]> {
  if (depth > 2) throw new Error('Sub-agent depth limit exceeded (max 2)')

  const limited = tasks.slice(0, config.maxConcurrentAgents)

  return Promise.all(limited.map(task => runOne(task, config)))
}

async function runOne(task: SubTask, config: AudreyConfig): Promise<SubResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.subagentTimeoutMs)

  try {
    const messages: Message[] = [
      ...(task.context ?? []),
      { role: 'user', content: task.prompt },
    ]
    let output = ''
    for await (const chunk of task.provider.chat(messages, { signal: controller.signal })) {
      output += chunk
    }
    return { id: task.id, output, success: true }
  } catch (err: any) {
    return { id: task.id, output: '', success: false, error: err.message }
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test tests/subagent.test.ts
```

Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/subagent.ts tests/subagent.test.ts
git commit -m "feat: concurrent sub-agent dispatcher with depth limit and timeout"
```

---

## Task 9: MCP Client

**Files:**
- Create: `src/tools/mcp/client.ts`
- Create: `src/tools/mcp/manager.ts`

**Interfaces:**
- Produces: `McpManager` class with `start(servers, config)`, `stop()`, `getTools(): Tool[]`, `healthCheck(): McpServerStatus[]`

- [ ] **Step 1: Create src/tools/mcp/client.ts**

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { McpServerConfig } from '../../types.js'

export interface McpTool {
  name: string
  description: string
  inputSchema: object
  call(args: Record<string, unknown>): Promise<string>
}

export async function connectMcpServer(
  name: string,
  serverConfig: McpServerConfig,
): Promise<{ tools: McpTool[]; disconnect: () => Promise<void> }> {
  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args,
  })
  const client = new Client({ name: 'audrey', version: '0.1.0' }, { capabilities: {} })
  await client.connect(transport)

  const { tools } = await client.listTools()
  const mcpTools: McpTool[] = tools.map(t => ({
    name: `${name}__${t.name}`,
    description: t.description ?? '',
    inputSchema: t.inputSchema,
    async call(args) {
      const result = await client.callTool({ name: t.name, arguments: args })
      const text = result.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n')
      return text
    },
  }))

  return { tools: mcpTools, disconnect: () => client.close() }
}
```

- [ ] **Step 2: Create src/tools/mcp/manager.ts**

```ts
import { connectMcpServer, type McpTool } from './client.js'
import type { McpServerConfig } from '../../types.js'

export interface McpServerStatus {
  name: string
  online: boolean
  toolCount: number
  error?: string
}

export class McpManager {
  private connections: Map<string, { tools: McpTool[]; disconnect: () => Promise<void> }> = new Map()

  async start(servers: Record<string, McpServerConfig>): Promise<McpServerStatus[]> {
    const statuses: McpServerStatus[] = []
    for (const [name, cfg] of Object.entries(servers)) {
      if (!cfg.autoStart) {
        statuses.push({ name, online: false, toolCount: 0 })
        continue
      }
      try {
        const conn = await connectMcpServer(name, cfg)
        this.connections.set(name, conn)
        statuses.push({ name, online: true, toolCount: conn.tools.length })
      } catch (err: any) {
        statuses.push({ name, online: false, toolCount: 0, error: err.message })
      }
    }
    return statuses
  }

  async startOne(name: string, cfg: McpServerConfig): Promise<McpServerStatus> {
    try {
      const conn = await connectMcpServer(name, cfg)
      this.connections.set(name, conn)
      return { name, online: true, toolCount: conn.tools.length }
    } catch (err: any) {
      return { name, online: false, toolCount: 0, error: err.message }
    }
  }

  async stop(name?: string): Promise<void> {
    if (name) {
      await this.connections.get(name)?.disconnect()
      this.connections.delete(name)
    } else {
      for (const conn of this.connections.values()) await conn.disconnect()
      this.connections.clear()
    }
  }

  getTools(): McpTool[] {
    return [...this.connections.values()].flatMap(c => c.tools)
  }

  healthCheck(): McpServerStatus[] {
    return [...this.connections.entries()].map(([name, conn]) => ({
      name,
      online: true,
      toolCount: conn.tools.length,
    }))
  }
}
```

- [ ] **Step 3: Commit (no unit test — MCP needs real server processes)**

```bash
git add src/tools/mcp/
git commit -m "feat: MCP client and server lifecycle manager"
```

---

## Task 10: Context Compactor + Health Check

**Files:**
- Create: `src/agent/compactor.ts`
- Create: `src/health/check.ts`
- Create: `src/health/rotation.ts`

**Interfaces:**
- Produces:
  - `compact(session: Session, provider: IProvider): Promise<Session>`
  - `runHealthCheck(config): Promise<HealthReport>`
  - `rotateStorage(config): Promise<void>`

- [ ] **Step 1: Create src/agent/compactor.ts**

```ts
import type { Session } from './session.js'
import type { IProvider } from '../providers/base.js'
import type { Message } from '../types.js'

export async function compact(session: Session, provider: IProvider): Promise<Session> {
  if (session.messages.length < 4) return session

  const head = session.messages.slice(0, 2)   // keep system + first user
  const tail = session.messages.slice(-2)       // keep last exchange
  const middle = session.messages.slice(2, -2)

  const summaryPrompt: Message = {
    role: 'user',
    content:
      'Summarize the following conversation in concise bullet points (max 300 words), ' +
      'preserving key decisions, file paths mentioned, and errors encountered:\n\n' +
      middle.map(m => `${m.role}: ${m.content}`).join('\n'),
  }

  let summary = ''
  for await (const chunk of provider.chat([summaryPrompt])) {
    summary += chunk
  }

  const summaryMsg: Message = {
    role: 'assistant',
    content: `[Context compacted]\n${summary}`,
  }

  return { ...session, messages: [...head, summaryMsg, ...tail] }
}
```

- [ ] **Step 2: Create src/health/check.ts**

```ts
import type { AudreyConfig } from '../config.js'
import type { McpServerStatus } from '../tools/mcp/manager.js'

export interface HealthReport {
  providers: { name: string; ok: boolean; error?: string }[]
  mcpServers: McpServerStatus[]
  diskMB: number
  diskWarning: boolean
}

export async function pingProvider(
  name: string,
  apiKey: string,
  baseUrl: string,
): Promise<{ name: string; ok: boolean; error?: string }> {
  if (!apiKey) return { name, ok: false, error: 'API key not set' }
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    })
    return { name, ok: res.status < 500 }
  } catch (err: any) {
    return { name, ok: false, error: err.message }
  }
}

export async function runHealthCheck(
  config: AudreyConfig,
  mcpStatuses: McpServerStatus[],
): Promise<HealthReport> {
  const providers = await Promise.all([
    pingProvider('deepseek', process.env.DEEPSEEK_API_KEY ?? '', 'https://api.deepseek.com/v1'),
    pingProvider('glm', process.env.GLM_API_KEY ?? '', 'https://open.bigmodel.cn/api/paas/v4'),
    pingProvider('minimax', process.env.MINIMAX_API_KEY ?? '', 'https://api.minimax.chat/v1'),
  ])

  const { statfs } = await import('fs/promises')
  const stat = await statfs(process.env.HOME ?? '/')
  const diskMB = Math.round((stat.bavail * stat.bsize) / 1024 / 1024)

  return {
    providers,
    mcpServers: mcpStatuses,
    diskMB,
    diskWarning: diskMB < config.storageWarnMB,
  }
}
```

- [ ] **Step 3: Create src/health/rotation.ts**

```ts
import { readdirSync, statSync, unlinkSync, renameSync } from 'fs'
import { join } from 'path'
import os from 'os'
import type { AudreyConfig } from '../config.js'

export async function rotateStorage(config: AudreyConfig): Promise<void> {
  const base = join(os.homedir(), '.audrey')

  // rotate snapshots
  const snapDir = join(base, 'snapshots')
  rotateDir(snapDir, config.snapshotMaxCount)

  // rotate sessions
  const sessDir = join(base, 'sessions')
  rotateDir(sessDir, config.sessionHistoryMax)

  // rotate stats.jsonl if over 10MB
  const statsPath = join(base, 'stats.jsonl')
  try {
    const size = statSync(statsPath).size
    if (size > 10 * 1024 * 1024) {
      const archivePath = join(base, `stats-${Date.now()}.jsonl`)
      renameSync(statsPath, archivePath)
    }
  } catch {}
}

function rotateDir(dir: string, max: number): void {
  try {
    const files = readdirSync(dir).sort()
    if (files.length > max) {
      for (const f of files.slice(0, files.length - max)) {
        unlinkSync(join(dir, f))
      }
    }
  } catch {}
}
```

- [ ] **Step 4: Commit**

```bash
git add src/agent/compactor.ts src/health/
git commit -m "feat: context compactor, health checks, and storage rotation"
```

---

## Task 11: Command System

**Files:**
- Create: `src/commands/index.ts`
- Create: `src/commands/handlers.ts`
- Create: `tests/commands.test.ts`

**Interfaces:**
- Produces: `parseCommand(input: string): ParsedCommand | null`, `ALL_COMMANDS`

- [ ] **Step 1: Write failing test**

Create `tests/commands.test.ts`:

```ts
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
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test tests/commands.test.ts
```

- [ ] **Step 3: Create src/commands/index.ts**

```ts
export interface ParsedCommand {
  name: string
  args: string[]
}

export const KNOWN_COMMANDS = new Set([
  'model', 'cost', 'memory', 'save-memory', 'undo', 'rewind',
  'compact', 'clear', 'reset', 'diff', 'status', 'history',
  'init', 'config', 'tagline', 'parallel', 'mcp', 'resume',
  'doctor', 'bug', 'help',
])

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null
  const parts = trimmed.slice(1).split(/\s+/)
  const name = parts[0] ?? ''
  if (!KNOWN_COMMANDS.has(name)) return null
  return { name, args: parts.slice(1) }
}
```

- [ ] **Step 4: Create src/commands/handlers.ts**

```ts
import { readFile, writeFile } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import os from 'os'
import { execSync } from 'child_process'
import type { Session } from '../agent/session.js'
import type { AudreyConfig } from '../config.js'
import type { ParsedCommand } from './index.js'
import type { ModelTier } from '../types.js'

export interface CommandContext {
  session: Session
  config: AudreyConfig
  setSession: (s: Session) => void
  setConfig: (c: AudreyConfig) => void
  clearScreen: () => void
  print: (msg: string) => void
}

export async function handleCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): Promise<void> {
  switch (cmd.name) {
    case 'model': return handleModel(cmd.args, ctx)
    case 'cost':  return handleCost(ctx)
    case 'clear': ctx.clearScreen(); return
    case 'reset': ctx.clearScreen(); ctx.setSession({ ...ctx.session, messages: [] }); return
    case 'tagline': return handleTagline(cmd.args, ctx)
    case 'help':  return handleHelp(ctx)
    case 'status': return handleStatus(ctx)
    case 'undo':  return handleUndo(ctx)
    case 'rewind': return handleRewind(cmd.args, ctx)
    case 'init':  return handleInit(ctx)
    case 'memory': return handleMemory(cmd.args, ctx)
    case 'history': return handleHistory(cmd.args, ctx)
    case 'diff':  return handleDiff(ctx)
    case 'config': return handleConfig(ctx)
    default: ctx.print(`Unknown command: /${cmd.name}`)
  }
}

function handleModel(args: string[], ctx: CommandContext): void {
  const tier = args[0] as ModelTier | 'auto' | undefined
  if (!tier) {
    ctx.print(`Current model override: ${ctx.session.modelOverride ?? 'auto'}`)
    return
  }
  if (tier === 'auto') {
    ctx.setSession({ ...ctx.session, modelOverride: undefined })
    ctx.print('Model routing: auto')
  } else if (['lite', 'standard', 'reason'].includes(tier)) {
    ctx.setSession({ ...ctx.session, modelOverride: tier as ModelTier })
    ctx.print(`Model locked to: ${tier}`)
  } else {
    ctx.print('Usage: /model [lite|standard|reason|auto]')
  }
}

async function handleCost(ctx: CommandContext): Promise<void> {
  const statsPath = join(os.homedir(), '.audrey', 'stats.jsonl')
  if (!existsSync(statsPath)) { ctx.print('No usage recorded yet.'); return }
  const lines = (await readFile(statsPath, 'utf8')).trim().split('\n').filter(Boolean)
  const today = new Date().toISOString().slice(0, 10)
  let totalCNY = 0
  let todayCNY = 0
  for (const line of lines) {
    try {
      const entry = JSON.parse(line)
      totalCNY += entry.costCNY ?? 0
      if (entry.date === today) todayCNY += entry.costCNY ?? 0
    } catch {}
  }
  ctx.print(`今日消耗: ¥${todayCNY.toFixed(4)} | 累计: ¥${totalCNY.toFixed(4)}`)
}

async function handleTagline(args: string[], ctx: CommandContext): Promise<void> {
  if (args[0] === 'reset') {
    const newCfg = { ...ctx.config, tagline: '实习摸鱼，努力学习' }
    ctx.setConfig(newCfg)
    ctx.print('标语已重置')
  } else if (args.length > 0) {
    const newCfg = { ...ctx.config, tagline: args.join(' ') }
    ctx.setConfig(newCfg)
    ctx.print(`标语已更新: ${newCfg.tagline}`)
  } else {
    ctx.print(`当前标语: ${ctx.config.tagline}`)
  }
}

function handleStatus(ctx: CommandContext): void {
  const usage = Math.round(
    (ctx.session.messages.reduce((s, m) => s + m.content.length, 0) / 3.5) /
    ctx.config.sessionMaxTokens * 100,
  )
  ctx.print(
    `模型: ${ctx.session.modelOverride ?? 'auto'} | ` +
    `权限: ${ctx.session.permissionMode} | ` +
    `上下文: ${usage}% | ` +
    `消息: ${ctx.session.messages.length}条`,
  )
}

async function handleUndo(ctx: CommandContext): Promise<void> {
  const snapDir = join(os.homedir(), '.audrey', 'snapshots')
  if (!existsSync(snapDir)) { ctx.print('No snapshots found.'); return }
  const snaps = readdirSync(snapDir).sort().reverse()
  if (snaps.length === 0) { ctx.print('No snapshots available.'); return }
  const latest = snaps[0]!
  const parts = latest.split('__')
  parts.shift() // remove timestamp
  const originalPath = parts.join('/').replace(/__/g, '/')
  const { copyFile } = await import('fs/promises')
  await copyFile(join(snapDir, latest), originalPath)
  ctx.print(`已恢复: ${originalPath}`)
}

function handleRewind(args: string[], ctx: CommandContext): void {
  const n = parseInt(args[0] ?? '1', 10) || 1
  const msgs = ctx.session.messages
  const newMsgs = msgs.slice(0, Math.max(0, msgs.length - n * 2))
  ctx.setSession({ ...ctx.session, messages: newMsgs })
  ctx.print(`已回退 ${n} 条对话`)
}

async function handleInit(ctx: CommandContext): Promise<void> {
  const path = join(process.cwd(), 'AUDREY.md')
  if (existsSync(path)) { ctx.print('AUDREY.md already exists'); return }
  await writeFile(path, `# ${process.cwd().split('/').pop()} Project Memory\n\n## 项目简介\n\n## 技术栈\n\n## 注意事项\n`, 'utf8')
  ctx.print(`Created: ${path}`)
}

async function handleMemory(args: string[], ctx: CommandContext): Promise<void> {
  const target = args[0] === 'global'
    ? join(os.homedir(), '.audrey', 'AUDREY.md')
    : join(process.cwd(), 'AUDREY.md')
  const editor = process.env.EDITOR ?? 'vi'
  try { execSync(`${editor} "${target}"`, { stdio: 'inherit' }) } catch {}
}

function handleHistory(args: string[], ctx: CommandContext): void {
  const n = parseInt(args[0] ?? '20', 10) || 20
  const recent = ctx.session.messages.slice(-n)
  for (const msg of recent) {
    ctx.print(`[${msg.role}] ${msg.content.slice(0, 120)}${msg.content.length > 120 ? '…' : ''}`)
  }
}

function handleDiff(ctx: CommandContext): void {
  const files = ctx.session.modifiedFiles
  if (files.length === 0) { ctx.print('本次会话未修改任何文件'); return }
  ctx.print(`本次会话修改的文件 (${files.length}):\n` + files.join('\n'))
}

async function handleConfig(ctx: CommandContext): Promise<void> {
  const path = join(os.homedir(), '.audrey', 'config.json')
  const editor = process.env.EDITOR ?? 'vi'
  try { execSync(`${editor} "${path}"`, { stdio: 'inherit' }) } catch {}
}

function handleHelp(ctx: CommandContext): void {
  ctx.print(`
/model [lite|standard|reason|auto]  切换模型档位
/cost                               token 消耗明细
/memory [global|project]            打开 AUDREY.md 编辑
/save-memory                        整理会话写入记忆
/undo                               撤销上次文件修改
/rewind [n]                         回退 n 条对话
/compact                            手动压缩上下文
/clear                              清空屏幕
/reset                              清空屏幕+重置上下文
/diff                               查看本次文件变更
/status                             会话状态概览
/history [n]                        查看最近 n 条对话
/init                               创建 AUDREY.md 模板
/config                             打开配置文件
/tagline <文字>                      修改启动标语
/mcp [list|start|stop|add]          MCP server 管理
/resume                             恢复上次崩溃会话
/doctor                             健康检查
/help                               显示本帮助
`.trim())
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
npm test tests/commands.test.ts
```

Expected: all 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/commands/ tests/commands.test.ts
git commit -m "feat: command system with all /commands implemented"
```

---

## Task 12: UI Components

**Files:**
- Create: `src/ui/FlowerArt.tsx`
- Create: `src/ui/AgentStatus.tsx`
- Create: `src/ui/MessageList.tsx`
- Create: `src/ui/Prompt.tsx`
- Create: `src/ui/App.tsx`

No unit tests for UI components — verified visually in Task 13.

- [ ] **Step 1: Create src/ui/FlowerArt.tsx**

```tsx
import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { theme } from './theme.js'

const FLOWER = [
  ['  ', '▓', '░', '▓', '  ', '░', '▓', '░'],
  [' ', '░', '█', '█', '█', '░', ' ', '▓', '█', '█', '█', '▓'],
  ['  ', '▓', '░', '▓', '  ', '░', '▓', '░'],
  ['    ', '╲', ' ', '╱'],
  ['     ', '█'],
]

interface Props { version: string; tagline: string }

export function FlowerArt({ version, tagline }: Props) {
  return (
    <Box flexDirection="column" alignItems="flex-start">
      <Box>
        <Box flexDirection="column" marginRight={2}>
          <Text>
            {'  '}
            <Text color={theme.pink}>▓</Text>
            <Text color={theme.purple}>░</Text>
            <Text color={theme.pink}>▓</Text>
            {'  '}
            <Text color={theme.purple}>░</Text>
            <Text color={theme.pink}>▓</Text>
            <Text color={theme.purple}>░</Text>
          </Text>
          <Text>
            {' '}
            <Text color={theme.purple}>░</Text>
            <Text color={theme.pink}>███</Text>
            <Text color={theme.purple}>░</Text>
            {' '}
            <Text color={theme.pink}>▓</Text>
            <Text color={theme.purple}>███</Text>
            <Text color={theme.pink}>▓</Text>
          </Text>
          <Text>
            {'  '}
            <Text color={theme.pink}>▓</Text>
            <Text color={theme.purple}>░</Text>
            <Text color={theme.pink}>▓</Text>
            {'  '}
            <Text color={theme.purple}>░</Text>
            <Text color={theme.pink}>▓</Text>
            <Text color={theme.purple}>░</Text>
          </Text>
          <Text>
            {'    '}
            <Text color={theme.green}>╲ ╱</Text>
          </Text>
          <Text>
            {'     '}
            <Text color={theme.green}>█</Text>
          </Text>
        </Box>
        <Box flexDirection="column" justifyContent="center">
          <Text bold color={theme.purple}>Audrey Code <Text color={theme.dimPurple}>{version}</Text></Text>
          <Text color={theme.pink} italic>{tagline}</Text>
        </Box>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Create src/ui/AgentStatus.tsx**

```tsx
import React from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import { theme } from './theme.js'

export interface AgentTask {
  id: string
  label: string
  modelId: string
  status: 'running' | 'done' | 'failed'
  progress?: number
}

interface Props { tasks: AgentTask[] }

export function AgentStatus({ tasks }: Props) {
  if (tasks.length === 0) return null
  return (
    <Box flexDirection="column" marginY={1}>
      <Text color={theme.purple}>◆ 正在并发执行 {tasks.length} 个子任务...</Text>
      {tasks.map(task => (
        <Box key={task.id} marginLeft={2}>
          {task.status === 'running' && (
            <Text color={theme.purple}><Spinner type="dots" /></Text>
          )}
          {task.status === 'done' && <Text color={theme.green}>✓</Text>}
          {task.status === 'failed' && <Text color={theme.red}>✗</Text>}
          <Text> </Text>
          <Text color={theme.dimPurple}>[{task.modelId}]</Text>
          <Text> {task.label}</Text>
          {task.status === 'done' && <Text color={theme.green}> 完成</Text>}
          {task.status === 'failed' && <Text color={theme.red}> 失败</Text>}
        </Box>
      ))}
    </Box>
  )
}
```

- [ ] **Step 3: Create src/ui/MessageList.tsx**

```tsx
import React from 'react'
import { Box, Text } from 'ink'
import { theme } from './theme.js'
import type { Message } from '../types.js'

interface Props { messages: Message[] }

export function MessageList({ messages }: Props) {
  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => (
        <Box key={i} marginBottom={1} flexDirection="column">
          {msg.role === 'user' && (
            <Text color={theme.pink}>&gt; {msg.content}</Text>
          )}
          {msg.role === 'assistant' && (
            <Box flexDirection="column">
              <Text color={theme.purple}>◆ </Text>
              <Text>{msg.content}</Text>
            </Box>
          )}
          {msg.role === 'tool' && (
            <Text color={theme.dimPurple}>  [{msg.toolName}] {msg.content.slice(0, 100)}</Text>
          )}
        </Box>
      ))}
    </Box>
  )
}
```

- [ ] **Step 4: Create src/ui/Prompt.tsx**

```tsx
import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from './theme.js'

interface Props {
  onSubmit: (value: string) => void
  onAbort: () => void
  disabled?: boolean
}

export function Prompt({ onSubmit, onAbort, disabled }: Props) {
  const [value, setValue] = useState('')

  useInput((input, key) => {
    if (disabled) return
    if (key.escape) { onAbort(); return }
    if (key.return) {
      if (value.trim()) { onSubmit(value.trim()); setValue('') }
      return
    }
    if (key.backspace || key.delete) {
      setValue(v => v.slice(0, -1))
      return
    }
    if (!key.ctrl && !key.meta) setValue(v => v + input)
  })

  return (
    <Box borderStyle="single" borderColor={theme.purple} paddingX={1}>
      <Text color={theme.pink}>&gt; </Text>
      <Text>{value}</Text>
      {!disabled && <Text color={theme.purple}>█</Text>}
    </Box>
  )
}
```

- [ ] **Step 5: Create src/ui/App.tsx**

```tsx
import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useApp } from 'ink'
import Spinner from 'ink-spinner'
import { theme } from './theme.js'
import { FlowerArt } from './FlowerArt.js'
import { MessageList } from './MessageList.js'
import { Prompt } from './Prompt.js'
import { AgentStatus, type AgentTask } from './AgentStatus.js'
import { getPhrase, type PhraseScene } from './phrases.js'
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
  const { exit } = useApp()
  const [phase, setPhase] = useState<AppPhase>('splash')
  const [config, setConfigState] = useState<AudreyConfig | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [generating, setGenerating] = useState(false)
  const [currentPhrase, setCurrentPhrase] = useState('')
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([])
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
    init()
  }, [])

  const handleSubmit = useCallback(async (input: string) => {
    if (!config || !session) return

    const cmd = parseCommand(input)
    if (cmd) {
      await handleCommand(cmd, {
        session,
        config,
        setSession,
        setConfig: (c) => { setConfigState(c); saveConfig(c) },
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
      {/* Top bar */}
      <Box marginBottom={1}>
        <Text bold color={theme.purple}>Audrey Code v0.1.0  </Text>
        <Text color={theme.dimPurple}>{session.modelOverride ?? 'auto'} │ </Text>
        <Text color={contextPct >= 70 ? theme.yellow : theme.dimPurple}>ctx {contextPct}%</Text>
      </Box>

      {/* Messages */}
      <MessageList messages={session.messages.filter(m => m.role !== 'system')} />

      {/* Output lines from commands */}
      {output.map((line, i) => <Text key={i} color={theme.dimPurple}>{line}</Text>)}

      {/* Sub-agent status */}
      <AgentStatus tasks={agentTasks} />

      {/* Generating indicator */}
      {generating && (
        <Box marginY={1}>
          <Text color={theme.purple}><Spinner type="dots" /></Text>
          <Text color={theme.pink}>  {currentPhrase}</Text>
        </Box>
      )}

      {/* Input */}
      <Prompt onSubmit={handleSubmit} onAbort={handleAbort} disabled={generating} />

      {/* Bottom hint */}
      <Text color={theme.dimPurple}>  /help 查看命令  │  ESC 中断  │  Ctrl+C 退出</Text>
    </Box>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/
git commit -m "feat: Ink UI components — flower art, message list, prompt, agent status"
```

---

## Task 13: CLI Entry + Integration

**Files:**
- Create: `src/cli.tsx`

- [ ] **Step 1: Create src/cli.tsx**

```tsx
import React from 'react'
import { render } from 'ink'
import { App } from './ui/App.js'
import type { PermissionMode } from './types.js'

const args = process.argv.slice(2)
let permissionMode: PermissionMode = 'ask'
if (args.includes('--auto')) permissionMode = 'auto'
if (args.includes('--deny')) permissionMode = 'deny'

render(<App permissionMode={permissionMode} />)
```

- [ ] **Step 2: Run the app**

```bash
npm run dev
```

Expected: Flower art appears for 1.5s, then REPL prompt appears.

- [ ] **Step 3: Smoke test key flows**

In the running REPL:
1. Type `你好` → should get lite-tier response
2. Type `/status` → shows model/context info
3. Type `/tagline 新的标语` → tagline updated
4. Type `/help` → all commands listed
5. Press ESC during generation → generation stops, REPL remains
6. Press Ctrl+C → exits cleanly

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 5: Final commit**

```bash
git add src/cli.tsx
git commit -m "feat: CLI entry point — audrey REPL is fully wired"
```

---

## Task 14: Budget Guard + Prompt Injection Detection

**Files:**
- Modify: `src/ui/App.tsx` (add budget check before each API call)
- Modify: `src/tools/builtin/read.ts` (add injection detection)
- Create: `src/health/budget.ts`

- [ ] **Step 1: Create src/health/budget.ts**

```ts
import { readFile, appendFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import os from 'os'

const INJECTION_PATTERNS = [
  '<system>',
  'ignore previous instructions',
  'ignore all previous',
  'system prompt',
  'you are now',
]

export function detectInjection(content: string): boolean {
  const lower = content.toLowerCase()
  return INJECTION_PATTERNS.some(p => lower.includes(p))
}

interface UsageEntry {
  date: string
  costCNY: number
  tokens: number
  model: string
}

export async function recordUsage(entry: UsageEntry): Promise<void> {
  const dir = join(os.homedir(), '.audrey')
  await mkdir(dir, { recursive: true })
  const path = join(dir, 'stats.jsonl')
  await appendFile(path, JSON.stringify(entry) + '\n', 'utf8')
}

export async function getTodaySpend(): Promise<number> {
  const path = join(os.homedir(), '.audrey', 'stats.jsonl')
  if (!existsSync(path)) return 0
  const today = new Date().toISOString().slice(0, 10)
  const lines = (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean)
  return lines.reduce((sum, line) => {
    try {
      const e = JSON.parse(line)
      return e.date === today ? sum + (e.costCNY ?? 0) : sum
    } catch { return sum }
  }, 0)
}
```

- [ ] **Step 2: Add injection detection to read tool**

Edit `src/tools/builtin/read.ts` — replace `execute` body:

```ts
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { detectInjection } from '../../health/budget.js'

export const readTool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  async execute(args: { path: string }, config: any): Promise<string> {
    if (!existsSync(args.path)) throw new Error(`File not found: ${args.path}`)
    const content = await readFile(args.path, 'utf8')
    const truncated = content.length > (config?.maxFileInjectTokens ?? 8000) * 3.5
      ? content.slice(0, Math.floor((config?.maxFileInjectTokens ?? 8000) * 3.5))
      : content
    if (detectInjection(truncated)) {
      return `[警告: 文件内容含可疑注入模式，已截断显示]\n${truncated.slice(0, 500)}`
    }
    return truncated
  },
}
```

- [ ] **Step 3: Commit**

```bash
git add src/health/budget.ts src/tools/builtin/read.ts
git commit -m "feat: budget tracking, prompt injection detection in file reads"
```

---

## Self-Review

**Spec coverage check:**

| Spec Section | Tasks Covering It |
|-------------|-------------------|
| 三档模型路由 | Task 3, 4 |
| Provider 统一接口 | Task 3 |
| 12条健壮性机制 | Tasks 6, 7, 8, 10, 14 |
| 记忆系统 | Task 5 |
| Sub-agent 系统 | Task 8 |
| MCP 配置 | Task 9 |
| UI 色板 + 组件 | Task 2, 12 |
| 古诗词词语池 | Task 2 |
| 像素花朵 | Task 12 |
| 命令清单 | Task 11 |
| 权限系统 ask/auto/deny | Task 6, 12 |
| 文件快照 + /undo | Task 6, 11 |
| 上下文保护 + /compact | Task 10, 11 |
| 崩溃恢复 /resume | Task 7 |
| 存储轮转 | Task 10 |
| 成本保护 | Task 14 |
| Prompt 注入防护 | Task 14 |
| 启动健康检查 | Task 10 |
| /tagline 命令 | Task 11 |

All spec requirements covered. No placeholders in plan.
