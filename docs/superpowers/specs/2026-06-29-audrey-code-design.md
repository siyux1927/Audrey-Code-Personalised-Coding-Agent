# Audrey Code — 设计文档

**日期：** 2026-06-29  
**状态：** 已确认，待实施  
**技术栈：** Node.js + Ink (TypeScript)  
**定位：** 个人 AI 编码 CLI，对齐 Claude Code 功能，粉紫色系，中文古诗词风格

---

## 1. 目标与约束

- **个人工具**：配置存 `~/.audrey/`，API Key 用环境变量，个转开源零成本
- **省钱优先**：三档模型路由，token 成本可观测可控
- **功能对齐 Claude Code**：权限系统、记忆、sub-agent、MCP、会话恢复
- **性格差异**：执行词语用古诗词/成语，像素花朵启动画，个人标语可改

---

## 2. 项目结构

```
audrey-code/
├── src/
│   ├── cli.tsx                  # 入口，Ink 渲染根组件
│   ├── ui/
│   │   ├── theme.ts             # 粉紫色板常量
│   │   ├── App.tsx              # REPL 主界面
│   │   ├── Prompt.tsx           # 输入框
│   │   ├── MessageList.tsx      # 对话历史渲染
│   │   ├── AgentStatus.tsx      # sub-agent 并发状态条
│   │   ├── FlowerArt.tsx        # 像素花朵启动画
│   │   └── phrases.ts           # 古诗词执行词语池
│   ├── agent/
│   │   ├── repl.ts              # REPL 主循环
│   │   ├── router.ts            # 自动模型路由
│   │   ├── session.ts           # 会话上下文管理
│   │   └── subagent.ts          # 并发 sub-agent 调度
│   ├── providers/
│   │   ├── base.ts              # IProvider 统一接口
│   │   ├── deepseek.ts
│   │   ├── glm.ts
│   │   └── minimax.ts
│   ├── tools/
│   │   ├── builtin/             # read / write / bash / glob
│   │   └── mcp/                 # MCP 客户端封装
│   └── memory/
│       ├── reader.ts            # 会话开始加载 AUDREY.md
│       └── writer.ts            # 会话结束写入记忆
├── package.json
└── tsconfig.json
```

**运行时目录（`~/.audrey/`）：**
```
~/.audrey/
├── AUDREY.md                    # 全局记忆
├── config.json                  # 所有配置与阈值
├── stats.jsonl                  # token 消耗记录
├── sessions/                    # 会话历史，保留最近 30 个
└── snapshots/                   # 文件修改快照，保留最近 100 个
```

**环境变量：**
```bash
DEEPSEEK_API_KEY=sk-xxx
GLM_API_KEY=xxx.yyy
MINIMAX_API_KEY=xxx
AUDREY_DEFAULT_MODEL=deepseek-chat   # 可选覆盖默认路由
```

---

## 3. 模型路由

### 三档模型

| 档位 | 模型 | 触发条件 | 估算成本 |
|------|------|---------|---------|
| **Lite** | `glm-4-flash` | prompt < 200字，无代码/文件意图，纯问答 | 免费额度 |
| **Standard** | `deepseek-chat` | 默认档，有代码/文件操作，中等复杂度 | ~¥0.001/千token |
| **Reason** | `deepseek-reasoner` | 含推理/设计/架构关键词，任务超过3步 | ~¥0.004/千token |

### 路由逻辑（`router.ts`）

```ts
function route(prompt: string, history: Message[]): ModelTier {
  if (hasReasoningKeywords(prompt)) return 'reason'
  if (hasCodeOrFileIntent(prompt) || history.length > 4) return 'standard'
  if (prompt.length < 200) return 'lite'
  return 'standard'
}
```

- 默认自动路由
- `/model lite|standard|reason|auto` 手动覆盖，会话内持续生效
- `auto` 恢复自动路由

### Provider 统一接口（`providers/base.ts`）

```ts
interface IProvider {
  chat(messages: Message[], opts: ChatOpts): AsyncIterable<string>
  countTokens(messages: Message[]): number
  modelId: string
  tier: ModelTier
}
```

---

## 4. 健壮性系统（12 条）

### 默认阈值（`~/.audrey/config.json`）

```json
{
  "dailyBudgetCNY": 10,
  "sessionMaxTokens": 60000,
  "contextWarningAt": 0.7,
  "bashTimeoutMs": 30000,
  "subagentTimeoutMs": 60000,
  "maxConcurrentAgents": 5,
  "maxFileInjectTokens": 8000,
  "retryMax": 3,
  "retryBackoffMs": 1000,
  "requestTimeoutMs": 30000,
  "snapshotMaxCount": 100,
  "sessionHistoryMax": 30,
  "storageWarnMB": 500,
  "allowedWriteDirs": ["$CWD"],
  "allowedCommands": ["npm", "git", "node", "tsc"],
  "tagline": "实习摸鱼，努力学习",
  "memoryMaxTokens": 2000
}
```

### 12 条健壮性机制

1. **权限系统**：工具调用前弹确认（y/n/a），`allowedCommands` 白名单自动放行，危险命令（rm/curl/sudo）永远确认
2. **文件快照 & /undo**：写文件前保存原始内容到 `snapshots/`，`/undo` 一键恢复
3. **上下文窗口保护**：实时显示 context 占用百分比，超过 70% 警告，`/compact` 手动压缩，超上限自动压缩
4. **流式中断恢复**：ESC 中断生成不崩溃，网络断开缓存已收 token，提示 `/resume`
5. **Bash 子进程隔离**：子进程 30s 超时强杀，敏感环境变量不继承（白名单传递）
6. **错误不崩溃**：工具失败把错误注入上下文，provider 全部失败提示不退出 REPL
7. **成本保护**：`dailyBudgetCNY` 超限弹确认，每次调用记录到 `stats.jsonl`
8. **启动健康检查**：验证 API Key 格式，对每个 provider 发 1 token ping，MCP server 启动失败标记 `[离线]`
9. **Prompt 注入防护**：文件注入截断超过 `maxFileInjectTokens` 的内容，检测 `<system>` / `ignore previous instructions` pattern 并警告
10. **会话崩溃恢复**：每次 assistant 回复后写 `sessions/last.json`，重启后提示 `/resume`
11. **存储自动轮转**：`sessions/` 保留 30 个，`snapshots/` 保留 100 个，`stats.jsonl` 超 10MB 归档，`~/.audrey/` 超 500MB 提示清理
12. **路径安全**：写文件只允许 `allowedWriteDirs` 内，拒绝 path traversal（`../../` 类路径）

---

## 5. 记忆系统

### 文件结构

```
~/.audrey/AUDREY.md              # 全局记忆（始终加载）
<项目目录>/AUDREY.md             # 项目记忆（自动发现）
```

### 加载逻辑

启动时从 `cwd` 向上扫描所有 `AUDREY.md`，从远到近叠加注入 system prompt，总上限 `memoryMaxTokens: 2000`。

```ts
async function loadMemory(cwd: string): Promise<string> {
  const layers = []
  layers.push(read('~/.audrey/AUDREY.md'))
  for (const dir of getAncestors(cwd, homeDir)) {
    const f = path.join(dir, 'AUDREY.md')
    if (exists(f)) layers.push(read(f))
  }
  return truncateToTokenLimit(layers.join('\n\n---\n\n'), 2000)
}
```

### 写入机制

- `/memory [global|project]` 打开对应 AUDREY.md 编辑
- Agent 检测到值得记录时提示 `[建议更新 AUDREY.md，/save-memory 确认]`
- `/save-memory` 后 agent 自动整理 → diff → 只追加真正新内容
- 文件超过 1500 token 时自动压缩（agent 摘要旧内容）

---

## 6. Sub-agent 系统

### 执行模型

```
主 REPL agent 检测可拆分任务
        ↓
subagent.ts 拆分为 N 个独立子任务
        ↓
Promise.all([agent1, agent2, ...])   ← 各自独立调用 provider
        ↓
结果汇总 → 主 agent 整合 → 输出
```

### 约束

- 有界递归：depth ≤ 2（主 → sub → sub-sub），超过拒绝
- 并发上限：`maxConcurrentAgents: 5`
- 单 agent 超时：`subagentTimeoutMs: 60000`，超时标记失败不阻塞其他
- 权限继承：子 agent 继承主会话权限模式，不能升级

### 权限模式

| 模式 | 说明 | 启动参数 |
|------|------|---------|
| `ask`（默认）| 每次工具调用弹确认 | 无参数 |
| `auto` | 全部自动执行 | `audrey --auto` |
| `deny` | 拒绝所有工具，纯对话 | `audrey --deny` |

### UI 状态条

```
◆ Audrey  正在并发执行 3 个子任务...

  ⠼ agent-1  [deepseek-chat]  分析 src/auth.ts    ████████░░ 80%
  ✓ agent-2  [glm-4-flash]   检查依赖版本         完成
  ⠹ agent-3  [deepseek-chat]  生成测试用例         ████░░░░░░ 40%
```

---

## 7. MCP 配置

### 内置 Server（`~/.audrey/config.json`）

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "$CWD"],
      "autoStart": true
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"],
      "autoStart": true
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "autoStart": false
    }
  }
}
```

- `autoStart: true` 随 REPL 启动
- 启动失败标记 `[离线]`，不影响主流程
- `/mcp list|start|stop|add` 管理

---

## 8. UI 设计

### 色板（`src/ui/theme.ts`）

```ts
export const theme = {
  pink:      '#FF79C6',   // 主色：用户输入、高亮、词语
  purple:    '#BD93F9',   // 副色：assistant 输出、标题、spinner
  dimPurple: '#6272A4',   // 弱色：时间戳、token 计数
  green:     '#50FA7B',   // 成功、工具完成、茎
  yellow:    '#F1FA8C',   // 警告、权限确认
  red:       '#FF5555',   // 错误、危险操作
  bg:        '#282A36',   // 背景（Dracula 系）
}
```

### REPL 主界面

```
╭─ Audrey Code  v0.1.0 ─────────── deepseek-chat │ ¥0.023 │ ctx 12% ─╮
│                                                                       │
│  ◆ 实习摸鱼，努力学习                                                   │
│                                                                       │
│  > 帮我重构 src/auth.ts 的错误处理                                      │
│                                                                       │
│  ⠼  韦编三绝                                                           │
│    [工具] read_file("src/auth.ts")  ✓                                 │
│                                                                       │
│  ◆ 建议将 try/catch 集中到...                                           │
│                                                                       │
╰───────────────────────────────────────────────────────────────────────╯
  ⌨  输入消息  │  /help 查看命令  │  ESC 中断  │  Ctrl+C 退出
```

顶栏：当前模型 + 本次会话成本（粉色）+ context 占用百分比

### 像素花朵启动画（`src/ui/FlowerArt.tsx`）

```
  ▓░▓  ░▓░
 ░███░ ▓███▓     Audrey Code v0.1.0
  ▓░▓  ░▓░       实习摸鱼，努力学习
    ╲ ╱
     █
```

- `▓` → pink `#FF79C6`，`░` → purple `#BD93F9`，`█`（茎）→ green `#50FA7B`
- 渲染 1.5 秒后淡出，进入 REPL 主界面
- 组件独立于 `FlowerArt.tsx`

### 动态执行词语（`src/ui/phrases.ts`）

| 场景 | 词语池 |
|------|------|
| 思考中 | 运筹帷幄 · 博观约取 · 沉吟至今 · 踌躇满志 · 深思熟虑 |
| 读取文件 | 韦编三绝 · 手不释卷 · 一目十行 · 博览群书 |
| 写入文件 | 妙笔生花 · 下笔如神 · 胸有成竹 · 笔走龙蛇 |
| 执行命令 | 雷厉风行 · 风驰电掣 · 一往无前 · 大刀阔斧 |
| 网络请求 | 上下求索 · 踏破铁鞋 · 千里寻觅 |
| Sub-agent | 分而治之 · 各司其职 · 众志成城 · 协力同心 |
| 压缩上下文 | 删繁就简 · 提纲挈领 · 化繁为简 |
| 写入记忆 | 铭记于心 · 念念不忘 · 刻骨铭心 |

UI 渲染：`⠼  韦编三绝`（紫色 spinner + 粉色词语），每 80ms 切换 spinner 帧

---

## 9. 命令清单

| 命令 | 功能 |
|------|------|
| `/model [lite\|standard\|reason\|auto]` | 切换或查看路由模式 |
| `/cost` | 今日 / 本月 token 消耗明细 |
| `/memory [global\|project]` | 打开对应 AUDREY.md 编辑 |
| `/save-memory` | 整理本次会话写入记忆 |
| `/undo` | 撤销上一次文件修改 |
| `/rewind [n]` | 回退 n 条对话（默认 1） |
| `/compact` | 手动压缩上下文 |
| `/clear` | 清空屏幕（保留上下文） |
| `/reset` | 清空屏幕 + 重置会话上下文 |
| `/diff` | 查看本次会话所有文件变更 |
| `/status` | 模型 / 权限模式 / MCP / 记忆 / context 状态 |
| `/history [n]` | 查看最近 n 条对话（默认 20） |
| `/init` | 在当前目录创建 AUDREY.md 模板 |
| `/config` | 打开 `~/.audrey/config.json` 编辑 |
| `/tagline <文字>` | 修改启动标语（`/tagline reset` 恢复默认） |
| `/parallel "任务1" "任务2"` | 手动并发 sub-agent |
| `/mcp [list\|start\|stop\|add]` | MCP server 管理 |
| `/resume` | 恢复上次崩溃会话 |
| `/doctor` | 健康检查（API Key / MCP / 磁盘） |
| `/bug` | 打开 GitHub issue 页 |
| `/help` | 命令列表 |

---

## 10. 数据流总览

```
用户输入
    ↓
router.ts → 选定模型档位
    ↓
memory/reader.ts → 注入 AUDREY.md 上下文
    ↓
agent/repl.ts → 构建 messages，调用 provider
    ↓
provider 流式输出 → Ink UI 实时渲染（古诗词 spinner）
    ↓
工具调用 → 权限检查 → 执行 → 结果注入上下文
    ↓
会话结束 → 提示 /save-memory → stats.jsonl 记录成本
```

---

## 11. 待决事项

- 像素花朵最终像素稿（实现时在终端实测调整）
- 是否支持多 provider 并联（相同 prompt 发多个 provider 取最快结果）→ v2 再议
- `/phrases add` 命令扩充词库 → v1 先硬编码，v2 支持自定义
