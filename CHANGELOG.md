# Changelog

## v0.1.1 — 2026-07

- 真实 token 计数（tiktoken cl100k_base，误差 <5%）
- 网络工具：`fetch` 拉取 URL 内容，`search` DuckDuckGo 搜索
- 权限系统落地：`ask / auto / deny` 三模式逐工具拦截，TUI 内联确认
- MCP 扩展：支持外部 MCP 服务进程，工具自动注册进工具链
- `PermissionPrompt` 组件，工具调用前显示参数预览
- `grep` 内置工具，正则搜索文件内容

## v0.1.0 — 2026-06

- 流式输出，逐 token 渲染
- 工具调用循环：read / write / bash / glob，自动多轮直到完成
- 智能模型路由，按 prompt 类型选模型
- `/model` 交互式选择器（名称 + 用途 + 实时价格）
- Markdown 渲染 + 代码块语法高亮
- 历史指令 ↑↓ 浏览，最多 50 条
- 三层记忆：`~/.audrey/AUDREY.md` → 父目录 → 项目目录
- `/btw` `/compact` `/resume` `/save-memory` `/rewind` `/undo` `/diff` `/cost` `/doctor` `/status` `/init`
- 三种权限模式（类型已定义，v0.1.1 落地执行）
- Prompt injection 检测
- 会话自动保存为 JSON，支持跨进程恢复
- Splash 像素花动画
