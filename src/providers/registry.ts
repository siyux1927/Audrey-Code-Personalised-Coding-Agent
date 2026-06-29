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
