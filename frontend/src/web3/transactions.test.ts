import { WaitForTransactionReceiptTimeoutError } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContractStep, StepProgress } from './transactions'

// Exercise the engine against the deterministic local deployment addresses.
vi.stubEnv('VITE_CHAIN_ID', '31337')

const wallet = vi.hoisted(() => ({
  getConnection: vi.fn(),
  getPublicClient: vi.fn(),
  simulateContract: vi.fn(),
  writeContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}))

vi.mock('wagmi/actions', () => ({
  getConnection: wallet.getConnection,
  getPublicClient: wallet.getPublicClient,
  simulateContract: wallet.simulateContract,
  writeContract: wallet.writeContract,
  readContract: vi.fn(),
}))

const { executeSteps } = await import('./transactions')
const { contracts } = await import('./contracts')

const ACCOUNT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const HASH = `0x${'11'.repeat(32)}` as const
const REPLACEMENT_HASH = `0x${'22'.repeat(32)}` as const
const pool = contracts.lendingPool

function depositStep(overrides: Partial<ContractStep> = {}): ContractStep {
  return { label: 'Deposit', ...pool, functionName: 'deposit', args: [1n, ACCOUNT], ...overrides }
}

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    status: 'success',
    to: pool.address.toLowerCase(),
    transactionHash: HASH,
    logs: [],
    gasUsed: 21_000n,
    effectiveGasPrice: 1_000_000_000n,
    ...overrides,
  }
}

async function run(steps: ContractStep[]) {
  const progress: StepProgress[] = []
  const result = await executeSteps(steps, (update) => progress.push(update))
  return { result, progress }
}

beforeEach(() => {
  vi.clearAllMocks()
  wallet.getConnection.mockReturnValue({ isConnected: true, address: ACCOUNT, chainId: 31337 })
  wallet.getPublicClient.mockReturnValue({ waitForTransactionReceipt: wallet.waitForTransactionReceipt })
  wallet.simulateContract.mockResolvedValue({ request: { functionName: 'deposit' } })
  wallet.writeContract.mockResolvedValue(HASH)
  wallet.waitForTransactionReceipt.mockResolvedValue(receipt())
})

describe('executeSteps', () => {
  it('walks prepared -> submitted -> pending and confirms only on a successful receipt', async () => {
    const { result, progress } = await run([depositStep()])

    expect(progress.map((update) => update.phase)).toEqual(['prepared', 'submitted', 'pending', 'step-confirmed'])
    expect(progress[1].hash).toBe(HASH)
    expect(result).toHaveLength(1)
    expect(result[0].hash).toBe(HASH)
    expect(result[0].gasCost).toBe('0.000021')
    expect(result[0].gasUsed).toBe(21_000n)
    expect(result[0].gasPrice).toBe(1_000_000_000n)
    expect(wallet.waitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ hash: HASH, confirmations: 1, timeout: 180_000 }),
    )
  })

  it('simulates against the target chain before prompting the wallet', async () => {
    await run([depositStep()])
    expect(wallet.simulateContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ account: ACCOUNT, chainId: 31337, functionName: 'deposit' }),
    )
    expect(wallet.simulateContract.mock.invocationCallOrder[0]).toBeLessThan(wallet.writeContract.mock.invocationCallOrder[0])
  })

  it('blocks a wrong-chain wallet before any simulation or prompt', async () => {
    wallet.getConnection.mockReturnValue({ isConnected: true, address: ACCOUNT, chainId: 11155111 })
    await expect(run([depositStep()])).rejects.toMatchObject({ kind: 'wrong_chain' })
    expect(wallet.simulateContract).not.toHaveBeenCalled()
    expect(wallet.writeContract).not.toHaveBeenCalled()
  })

  it('requires a connected wallet', async () => {
    wallet.getConnection.mockReturnValue({ isConnected: false })
    await expect(run([depositStep()])).rejects.toMatchObject({ kind: 'error' })
  })

  it('never prompts the wallet when simulation reverts', async () => {
    wallet.simulateContract.mockRejectedValue(new Error('execution reverted'))
    await expect(run([depositStep()])).rejects.toThrow('execution reverted')
    expect(wallet.writeContract).not.toHaveBeenCalled()
  })

  it('propagates a wallet rejection without waiting for a receipt', async () => {
    const rejection = Object.assign(new Error('User rejected'), { code: 4001 })
    wallet.writeContract.mockRejectedValue(rejection)
    await expect(run([depositStep()])).rejects.toBe(rejection)
    expect(wallet.waitForTransactionReceipt).not.toHaveBeenCalled()
  })

  it('reports a reverted receipt as failed with its hash', async () => {
    wallet.waitForTransactionReceipt.mockResolvedValue(receipt({ status: 'reverted' }))
    await expect(run([depositStep()])).rejects.toMatchObject({ kind: 'reverted', hash: HASH })
  })

  it('reports a timeout with the submitted hash', async () => {
    wallet.waitForTransactionReceipt.mockRejectedValue(new WaitForTransactionReceiptTimeoutError({ hash: HASH }))
    await expect(run([depositStep()])).rejects.toMatchObject({ kind: 'timeout', hash: HASH })
  })

  it('treats a cancelled or replaced transaction as failed even if the replacement succeeded', async () => {
    for (const reason of ['cancelled', 'replaced'] as const) {
      wallet.waitForTransactionReceipt.mockImplementationOnce(async ({ onReplaced }) => {
        onReplaced({ reason, transaction: { hash: REPLACEMENT_HASH } })
        return receipt({ transactionHash: REPLACEMENT_HASH })
      })
      await expect(run([depositStep()])).rejects.toMatchObject({ kind: 'replaced', hash: REPLACEMENT_HASH })
    }
  })

  it('follows a repriced (sped-up) transaction to its replacement receipt', async () => {
    wallet.waitForTransactionReceipt.mockImplementationOnce(async ({ onReplaced }) => {
      onReplaced({ reason: 'repriced', transaction: { hash: REPLACEMENT_HASH } })
      return receipt({ transactionHash: REPLACEMENT_HASH })
    })
    const { result, progress } = await run([depositStep()])
    expect(result[0].hash).toBe(REPLACEMENT_HASH)
    expect(progress.some((update) => update.phase === 'pending' && update.hash === REPLACEMENT_HASH)).toBe(true)
  })

  it('rejects a receipt for an unexpected contract', async () => {
    wallet.waitForTransactionReceipt.mockResolvedValue(receipt({ to: contracts.mockUsdc.address }))
    await expect(run([depositStep()])).rejects.toMatchObject({ kind: 'error' })
  })

  it('skips unnecessary steps and counts only the remaining ones', async () => {
    const approve = depositStep({ label: 'Approve', skip: async () => true })
    const { result, progress } = await run([approve, depositStep()])
    expect(result.map((step) => step.label)).toEqual(['Deposit'])
    expect(progress.every((update) => update.stepCount === 1)).toBe(true)
    expect(wallet.writeContract).toHaveBeenCalledTimes(1)
  })

  it('stops a multi-step flow at the first failure', async () => {
    wallet.waitForTransactionReceipt.mockResolvedValueOnce(receipt()).mockResolvedValueOnce(receipt({ status: 'reverted' }))
    await expect(run([depositStep({ label: 'Approve' }), depositStep(), depositStep({ label: 'Never' })])).rejects.toMatchObject({
      kind: 'reverted',
    })
    expect(wallet.writeContract).toHaveBeenCalledTimes(2)
  })
})
