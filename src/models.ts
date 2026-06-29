export interface ModelDef {
  id: string           // API model ID
  displayName: string  // 显示名称
  description: string  // 用途说明
  inputCNY: number     // 每百万 token 输入价格（CNY）
  outputCNY: number    // 每百万 token 输出价格（CNY）
  provider: 'glm' | 'deepseek' | 'minimax'
  internalTier: 'lite' | 'standard' | 'reason'  // 供内部路由用
}

export const MODELS: ModelDef[] = [
  {
    id: 'glm-4-flash',
    displayName: 'GLM-4-Flash',
    description: '完全免费 · 快速 · 日常问答',
    inputCNY: 0,
    outputCNY: 0,
    provider: 'glm',
    internalTier: 'lite',
  },
  {
    id: 'glm-4-air',
    displayName: 'GLM-4-Air',
    description: '均衡性能 · 适合轻量编程',
    inputCNY: 1,
    outputCNY: 1,
    provider: 'glm',
    internalTier: 'lite',
  },
  {
    id: 'deepseek-chat',
    displayName: 'DeepSeek-V3',
    description: '强力编程 · 综合任务推荐',
    inputCNY: 1,
    outputCNY: 2,
    provider: 'deepseek',
    internalTier: 'standard',
  },
  {
    id: 'deepseek-reasoner',
    displayName: 'DeepSeek-R1',
    description: '深度推理 · 复杂逻辑/数学',
    inputCNY: 4,
    outputCNY: 16,
    provider: 'deepseek',
    internalTier: 'reason',
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
