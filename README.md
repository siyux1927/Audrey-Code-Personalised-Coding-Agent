# Audrey Code

<p align="center"><img src="assets/readme-header.png" width="70%"></p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.1-blue" alt="version">
  <img src="https://img.shields.io/badge/node-%3E%3D20-green" alt="node">
  <img src="https://img.shields.io/badge/license-MIT-lightgrey" alt="license">
</p>

轻量 AI 编程 CLI。终端内流式对话 + 工具调用 + 多模型路由。

---

## 功能

| 类别 | 功能 |
|------|------|
| **对话** | 流式输出、Markdown 渲染、代码块语法高亮 |
| **工具** | 读写文件、执行 Shell、Glob 搜索、Grep、HTTP Fetch、Web 搜索 |
| **模型路由** | 按 prompt 类型自动选模型；`/model` 交互式切换（含实时价格）|
| **记忆** | 三层加载：`~/.audrey/` → 父目录 → 项目目录 |
| **权限** | `ask / auto / deny` 三模式，逐工具拦截，TUI 内联确认 |
| **会话** | 自动保存 JSON、`/resume` 恢复崩溃会话、`/rewind` 回退轮次 |
| **扩展** | MCP 服务支持，外部工具自动注册 |
| **其他** | `/cost` token 用量、`/doctor` 连通检查、`/undo` 文件快照回滚 |

<p align="center"><img src="assets/readme-models.png" width="70%"></p>

---

## 技术栈

- **Ink 5 + React 18** — 终端 TUI 组件树
- **TypeScript strict + ESM** — 全量类型检查
- **GLM-4-Flash / GLM-4-Air** — 智谱 AI（Flash 免费）
- **DeepSeek-V3 / R1** — 编程与深度推理
- **OpenAI 兼容 SSE** — 统一流式接口
- **tiktoken** — 精确 token 计数
- **MCP SDK** — 外部工具扩展协议
- **Vitest** — 单元测试

---

## 快速开始

```bash
git clone <repo-url>
cd siyu_code
npm install
cp .env.example .env   # 填入 API Key
npm run build
npm link
audrey
```

进入后：`/init` 生成项目记忆文件，`/help` 查看全部命令。

---

## 环境变量

```bash
GLM_API_KEY=        # 智谱 AI — https://open.bigmodel.cn
DEEPSEEK_API_KEY=   # DeepSeek — https://platform.deepseek.com
```

---

## 项目结构

```
src/
├── agent/       # 对话循环、路由、权限、压缩、子代理
├── providers/   # GLM / DeepSeek / 抽象基类
├── tools/       # 内置工具（bash/read/write/glob/grep/fetch/search）
├── mcp/         # MCP 客户端与注册中心
├── memory/      # 三层记忆读写
├── health/      # token 预算、连通检查、密钥轮换
├── commands/    # slash 命令处理
├── ui/          # Ink 组件（App / Prompt / MessageList / ...）
├── config.ts    # 配置加载与默认值
├── models.ts    # 模型定义与定价
└── cli.tsx      # 入口
tests/           # Vitest 单元测试
docs/dev/        # 开发计划与设计文档
```

---

## 版本历史

见 [CHANGELOG.md](CHANGELOG.md)。
