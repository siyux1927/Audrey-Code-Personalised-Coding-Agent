import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 10000,  // CLI spawn tests need more than the default 5s
  },
})
