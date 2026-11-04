import { afterEach, beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  const storage = new Map<string, string>([['credora-network', 'demo']])
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
})
afterEach(() => vi.unstubAllGlobals())

it('keeps the established demo store usable when the proxy cannot reach the backend', async () => {
  const { api } = await import('./client')
  api.setNetworkMode('demo')
  expect((await api.getPoolStatistics()).total_deposited).toBeGreaterThan(0)
})
it('never substitutes demo balances or loan records in on-chain mode', async () => {
  const { api } = await import('./client')
  api.setNetworkMode('onchain')
  await expect(api.getPoolStatistics()).rejects.toThrow('HTTP 503')
  await expect(api.getLoans()).rejects.toThrow('HTTP 503')
})
it('does not hide backend validation errors behind demo success', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Invalid request' }), { status: 422 })))
  const { api } = await import('./client')
  await expect(api.getPoolStatistics()).rejects.toThrow('Invalid request')
})
