import { readFile, writeFile, copyFile } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import os from 'os'
import { execSync } from 'child_process'
import type { Session } from '../agent/session.js'
import { addMessage, loadLastSession } from '../agent/session.js'
import { compact } from '../agent/compactor.js'
import { appendMemory } from '../memory/writer.js'
import { runHealthCheck } from '../health/check.js'
import { resolveProvider } from '../providers/registry.js'
import type { AudreyConfig } from '../config.js'
import type { ParsedCommand } from './index.js'
import { MODELS } from '../models.js'

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
    case 'model':       return handleModel(cmd.args, ctx)
    case 'cost':        return handleCost(ctx)
    case 'clear':       ctx.clearScreen(); return
    case 'reset':       ctx.clearScreen(); ctx.setSession({ ...ctx.session, messages: [] }); return
    case 'tagline':     return handleTagline(cmd.args, ctx)
    case 'help':        return handleHelp(ctx)
    case 'status':      return handleStatus(ctx)
    case 'undo':        return handleUndo(ctx)
    case 'rewind':      return handleRewind(cmd.args, ctx)
    case 'init':        return handleInit(ctx)
    case 'memory':      return handleMemory(cmd.args, ctx)
    case 'history':     return handleHistory(cmd.args, ctx)
    case 'diff':        return handleDiff(ctx)
    case 'config':      return handleConfig(ctx)
    case 'btw':         return handleBtw(cmd.args, ctx)
    case 'resume':      return handleResume(ctx)
    case 'save-memory': return handleSaveMemory(ctx)
    case 'compact':     return handleCompact(ctx)
    case 'doctor':      return handleDoctor(ctx)
    default:            ctx.print(`Unknown command: /${cmd.name}`)
  }
}

function handleModel(args: string[], ctx: CommandContext): void {
  const arg = args[0]
  if (!arg) {
    const current = ctx.session.modelOverride
    const name = MODELS.find(m => m.id === current)?.displayName ?? 'auto'
    ctx.print(`当前模型: ${name}  (输入 /model 打开交互式选择器)`)
    return
  }
  if (arg === 'auto') {
    ctx.setSession({ ...ctx.session, modelOverride: undefined })
    ctx.print('模型路由: 自动')
    return
  }
  const found = MODELS.find(m => m.id === arg)
  if (found) {
    ctx.setSession({ ...ctx.session, modelOverride: found.id })
    ctx.print(`已锁定模型: ${found.displayName}`)
  } else {
    const ids = MODELS.map(m => m.id).join('|')
    ctx.print(`用法: /model [${ids}|auto]`)
  }
}

async function handleCost(ctx: CommandContext): Promise<void> {
  const statsPath = join(process.env.HOME ?? os.homedir(), '.audrey', 'stats.jsonl')
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
  const modelName = MODELS.find(m => m.id === ctx.session.modelOverride)?.displayName ?? 'auto'
  ctx.print(
    `模型: ${modelName} | ` +
    `权限: ${ctx.session.permissionMode} | ` +
    `上下文: ${usage}% | ` +
    `消息: ${ctx.session.messages.length}条`,
  )
}

async function handleUndo(ctx: CommandContext): Promise<void> {
  const snapDir = join(process.env.HOME ?? os.homedir(), '.audrey', 'snapshots')
  if (!existsSync(snapDir)) { ctx.print('No snapshots found.'); return }
  const snaps = readdirSync(snapDir).sort().reverse()
  if (snaps.length === 0) { ctx.print('No snapshots available.'); return }
  const latest = snaps[0]!
  const parts = latest.split('__')
  parts.shift() // remove timestamp prefix
  const originalPath = parts.join('/').replace(/__/g, '/')
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
  await writeFile(
    path,
    `# ${process.cwd().split('/').pop()} Project Memory\n\n## 项目简介\n\n## 技术栈\n\n## 注意事项\n`,
    'utf8',
  )
  ctx.print(`Created: ${path}`)
}

async function handleMemory(args: string[], ctx: CommandContext): Promise<void> {
  const target = args[0] === 'global'
    ? join(process.env.HOME ?? os.homedir(), '.audrey', 'AUDREY.md')
    : join(process.cwd(), 'AUDREY.md')
  const editor = process.env.EDITOR ?? 'vi'
  try { execSync(`${editor} "${target}"`, { stdio: 'inherit' }) } catch {}
}

function handleHistory(args: string[], ctx: CommandContext): void {
  const n = parseInt(args[0] ?? '20', 10) || 20
  for (const msg of ctx.session.messages.slice(-n)) {
    ctx.print(`[${msg.role}] ${msg.content.slice(0, 120)}${msg.content.length > 120 ? '…' : ''}`)
  }
}

function handleDiff(ctx: CommandContext): void {
  const files = ctx.session.modifiedFiles
  if (files.length === 0) { ctx.print('本次会话未修改任何文件'); return }
  ctx.print(`本次会话修改的文件 (${files.length}):\n` + files.join('\n'))
}

async function handleConfig(ctx: CommandContext): Promise<void> {
  const path = join(process.env.HOME ?? os.homedir(), '.audrey', 'config.json')
  const editor = process.env.EDITOR ?? 'vi'
  try { execSync(`${editor} "${path}"`, { stdio: 'inherit' }) } catch {}
}

function handleHelp(ctx: CommandContext): void {
  ctx.print(`
/model [模型ID|auto]                 交互式选择模型（无参数）或直接指定
/cost                               token 消耗明细
/memory [global|project]            打开 AUDREY.md 编辑
/save-memory                        整理会话摘要写入记忆
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
/btw <备注>                          添加一次性上下文备注（下次发送生效）
/resume                             恢复上次崩溃会话
/doctor                             健康检查
/help                               显示本帮助
`.trim())
}

function handleBtw(args: string[], ctx: CommandContext): void {
  if (args.length === 0) {
    const notes = ctx.session.messages.filter(m => m.toolName === '__btw__')
    if (notes.length === 0) {
      ctx.print('没有待发送的备注。用法: /btw <备注内容>')
    } else {
      ctx.print('待发备注（下次对话自动携带）:')
      notes.forEach(n => ctx.print(`  📌 ${n.content}`))
    }
    return
  }
  const note = args.join(' ')
  ctx.setSession(addMessage(ctx.session, { role: 'tool', content: note, toolName: '__btw__' }))
  ctx.print(`📌 备注已记录: ${note}`)
}

async function handleResume(ctx: CommandContext): Promise<void> {
  const last = await loadLastSession()
  if (!last) { ctx.print('没有找到上次的会话记录'); return }
  const msgCount = last.messages.filter(m => m.role !== 'system').length
  ctx.setSession({ ...last, permissionMode: ctx.session.permissionMode })
  ctx.print(`✓ 已恢复上次会话 (${msgCount} 条消息，创建于 ${new Date(last.createdAt).toLocaleString()})`)
}

async function handleSaveMemory(ctx: CommandContext): Promise<void> {
  const msgs = ctx.session.messages.filter(m =>
    m.role !== 'system' && m.toolName !== '__output__' && m.toolName !== '__btw__'
  )
  if (msgs.length === 0) { ctx.print('当前会话没有可保存的内容'); return }

  const summary = msgs
    .slice(-20)
    .map(m => `[${m.role}] ${m.content.slice(0, 200)}`)
    .join('\n')

  const memPath = join(process.cwd(), 'AUDREY.md')
  const header = `\n会话摘要 (${new Date().toLocaleDateString()}):\n`
  await appendMemory(memPath, header + summary, 2000)
  ctx.print(`✓ 已将最近对话摘要写入 ${memPath}`)
}

async function handleCompact(ctx: CommandContext): Promise<void> {
  if (ctx.session.messages.length < 4) { ctx.print('对话太短，无需压缩'); return }
  ctx.print('正在压缩上下文...')
  const provider = resolveProvider('lite', ctx.config)
  const compacted = await compact(ctx.session, provider)
  ctx.setSession(compacted)
  const saved = ctx.session.messages.length - compacted.messages.length
  ctx.print(`✓ 上下文已压缩，减少了 ${saved} 条消息`)
}

async function handleDoctor(ctx: CommandContext): Promise<void> {
  ctx.print('正在检查各项服务...')
  const report = await runHealthCheck(ctx.config, [])
  for (const p of report.providers) {
    const icon = p.ok ? '✓' : '✗'
    ctx.print(`${icon} ${p.name}: ${p.ok ? 'OK' : (p.error ?? '连接失败')}`)
  }
  ctx.print(`磁盘: ${report.diskMB} MB 可用${report.diskWarning ? ' ⚠ 空间不足' : ''}`)
}
