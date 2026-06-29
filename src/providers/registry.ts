import type { ModelTier } from '../types.js'
import type { AudreyConfig } from '../config.js'
import type { IProvider } from './base.js'
import { DeepSeekProvider } from './deepseek.js'
import { GLMProvider } from './glm.js'

export function resolveProvider(tier: ModelTier, config: AudreyConfig): IProvider {
  switch (tier) {
    case 'lite':     return new GLMProvider(config, 'glm-4-flash')
    case 'standard': return new DeepSeekProvider(config, 'standard')
    case 'reason':   return new DeepSeekProvider(config, 'reason')
  }
}

export function resolveProviderByModelId(modelId: string, config: AudreyConfig): IProvider {
  switch (modelId) {
    case 'glm-4-flash':      return new GLMProvider(config, 'glm-4-flash')
    case 'glm-4-air':        return new GLMProvider(config, 'glm-4-air')
    case 'deepseek-chat':    return new DeepSeekProvider(config, 'standard')
    case 'deepseek-reasoner': return new DeepSeekProvider(config, 'reason')
    default:                 return new GLMProvider(config, 'glm-4-flash')
  }
}
