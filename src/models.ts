export interface ModelDef {
  id: string
  displayName: string
  description: string
  inputCNY: number
  outputCNY: number
  provider: 'glm' | 'deepseek'
  internalTier: 'lite' | 'standard' | 'reason'
}

export const MODELS: ModelDef[] = [
  // ── GLM-4 Flash series (free) ───────────────────────────────────────
  {
    id: 'glm-4-flash',
    displayName: 'GLM-4-Flash',
    description: '免费 · 快速 · 日常问答 · 内置联网',
    inputCNY: 0, outputCNY: 0,
    provider: 'glm', internalTier: 'lite',
  },
  {
    id: 'glm-4-flash-250414',
    displayName: 'GLM-4-Flash (新)',
    description: '免费 · 2025升级版 · 更强指令跟随 · 内置联网',
    inputCNY: 0, outputCNY: 0,
    provider: 'glm', internalTier: 'lite',
  },
  // ── GLM-4 Air series ───────────────────────────────────────────────
  {
    id: 'glm-4-air',
    displayName: 'GLM-4-Air',
    description: '均衡 · 轻量编程 · 内置联网',
    inputCNY: 1, outputCNY: 1,
    provider: 'glm', internalTier: 'lite',
  },
  {
    id: 'glm-4-airx',
    displayName: 'GLM-4-AirX',
    description: '高速 Air · 低延迟场景 · 内置联网',
    inputCNY: 10, outputCNY: 10,
    provider: 'glm', internalTier: 'lite',
  },
  // ── GLM-4 Long (128k context) ──────────────────────────────────────
  {
    id: 'glm-4-long',
    displayName: 'GLM-4-Long',
    description: '128k 长上下文 · 大文件/长对话 · 内置联网',
    inputCNY: 1, outputCNY: 1,
    provider: 'glm', internalTier: 'standard',
  },
  // ── GLM-4 (flagship) ──────────────────────────────────────────────
  {
    id: 'glm-4',
    displayName: 'GLM-4',
    description: '旗舰 · 最强综合能力 · 内置联网',
    inputCNY: 100, outputCNY: 100,
    provider: 'glm', internalTier: 'standard',
  },
  // ── GLM-Z1 reasoning series ────────────────────────────────────────
  {
    id: 'glm-z1-flash',
    displayName: 'GLM-Z1-Flash',
    description: '免费推理 · 思维链 · 数学/逻辑 · 内置联网',
    inputCNY: 0, outputCNY: 0,
    provider: 'glm', internalTier: 'reason',
  },
  {
    id: 'glm-z1-air',
    displayName: 'GLM-Z1-Air',
    description: '推理均衡 · 复杂任务 · 内置联网',
    inputCNY: 2, outputCNY: 2,
    provider: 'glm', internalTier: 'reason',
  },
  {
    id: 'glm-z1-airx',
    displayName: 'GLM-Z1-AirX',
    description: '高速推理 · 低延迟思维链 · 内置联网',
    inputCNY: 10, outputCNY: 10,
    provider: 'glm', internalTier: 'reason',
  },
  // ── DeepSeek ───────────────────────────────────────────────────────
  {
    id: 'deepseek-chat',
    displayName: 'DeepSeek-V3',
    description: '强力编程 · 综合任务推荐',
    inputCNY: 1, outputCNY: 2,
    provider: 'deepseek', internalTier: 'standard',
  },
  {
    id: 'deepseek-reasoner',
    displayName: 'DeepSeek-R1',
    description: '深度推理 · 复杂逻辑/数学',
    inputCNY: 4, outputCNY: 16,
    provider: 'deepseek', internalTier: 'reason',
  },
]

export const DEFAULT_MODEL_ID = 'glm-4-flash'

export function getModelDef(id: string): ModelDef {
  return MODELS.find(m => m.id === id) ?? MODELS[0]!
}

export function formatPrice(def: ModelDef): string {
  if (def.inputCNY === 0 && def.outputCNY === 0) return '¥0（免费）'
  if (def.inputCNY === def.outputCNY) return `¥${def.inputCNY}/M tokens`
  return `¥${def.inputCNY}/M输入  ¥${def.outputCNY}/M输出`
}
