import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

const testEnv = config({ path: '.env.test' }).parsed ?? {}

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/globalSetup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    env: testEnv,
    fileParallelism: false,
  },
})
