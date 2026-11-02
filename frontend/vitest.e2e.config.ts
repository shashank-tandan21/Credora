import { defineConfig } from 'vitest/config'

// End-to-end checks of the wallet transaction engine against a running local Hardhat node
// with a fresh `npm run deploy:local` (see contracts/README.md). Not part of `npm test`.
export default defineConfig({
  test: {
    include: ['src/**/*.e2e.ts'],
    environment: 'node',
    testTimeout: 120_000,
    fileParallelism: false,
    env: { VITE_CHAIN_ID: '31337' },
  },
})
