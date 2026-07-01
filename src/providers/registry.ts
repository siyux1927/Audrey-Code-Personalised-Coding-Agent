import type { ModelTier } from '../types.js'
import type { AudreyConfig } from '../config.js'
import type { IProvider } from './base.js'
import { DeepSeekProvider } from './deepseek.js'
import { GLMProvider } from './glm.js'

const GLM_MODELS = new Set([
  'glm-4-flash', 'glm-4-flash-250414',
  'glm-4-air', 'glm-4-airx',
  'glm-4-long', 'glm-4',
  'glm-z1-flash', 'glm-z1-air', 'glm-z1-airx',
])

export function resolveProvider(tier: ModelTier, config: AudreyConfig): IProvider {
  switch (tier) {
    case 'lite':     return new GLMProvider(config, 'glm-4-flash')
    case 'standard': return new DeepSeekProvider(config, 'standard')
    case 'reason':   return new DeepSeekProvider(config, 'reason')
  }
}

export function resolveProviderByModelId(modelId: string, config: AudreyConfig): IProvider {
  if (GLM_MODELS.has(modelId)) return new GLMProvider(config, modelId)
  if (modelId === 'deepseek-chat') return new DeepSeekProvider(config, 'standard')
  if (modelId === 'deepseek-reasoner') return new DeepSeekProvider(config, 'reason')
  return new GLMProvider(config, 'glm-4-flash')
}
