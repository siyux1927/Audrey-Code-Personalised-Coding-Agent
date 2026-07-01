import type { Message } from '../types.js'

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

const SEARCH_KEYWORDS = [
  '搜索', '查找', '找一下', '最新', '新闻', '现在', '最近', '今年',
  'search', 'latest', 'news', 'current', 'today',
]

// Returns a model ID string (e.g. 'glm-4-flash', 'deepseek-chat', 'deepseek-reasoner')
export function route(
  prompt: string,
  history: Message[],
  override?: string,
): string {
  if (override) return override

  const lower = prompt.toLowerCase()

  if (REASON_KEYWORDS.some(kw => lower.includes(kw))) return 'deepseek-reasoner'

  // Searches and general questions → GLM (has built-in web_search)
  if (SEARCH_KEYWORDS.some(kw => lower.includes(kw))) return 'glm-4-flash'

  if (CODE_KEYWORDS.some(kw => lower.includes(kw))) return 'deepseek-chat'

  // Long conversation with coding context → DeepSeek; otherwise stay on GLM
  if (history.length > 4 && history.some(m => CODE_KEYWORDS.some(kw => m.content.toLowerCase().includes(kw)))) {
    return 'deepseek-chat'
  }

  if (prompt.length < 200) return 'glm-4-flash'

  return 'deepseek-chat'
}
