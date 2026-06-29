import { describe, it, expect } from 'vitest'
import { getPhrase, pools } from '../src/ui/phrases.js'

describe('getPhrase', () => {
  it('returns a string from the correct pool', () => {
    for (const scene of Object.keys(pools) as any[]) {
      const phrase = getPhrase(scene)
      expect(pools[scene]).toContain(phrase)
    }
  })
})
