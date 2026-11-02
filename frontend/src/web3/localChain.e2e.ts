import { type Address, parseEventLogs } from 'viem'
import { beforeAll, describe, expect, it } from 'vitest'
import { mock } from 'wagmi'
import { connect, disconnect, getBytecode, readContract } from 'wagmi/actions'
import { chainNow, steps } from './actions'
import { wagmiConfig } from './config'
import { contracts } from './contracts'
import { describeTransactionError } from './errors'
import { loanManagerAbi } from './generated/abis'
import { executeSteps, type StepProgress } from './transactions'
import { hashText, uuidToBytes32 } from './units'

// Public, well-known Hardhat development accounts (unlocked on `npx hardhat node`).
const OPERATOR: Address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' // #0, holds all operator roles
const LENDER: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' // #1
const BORROWER: Address = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc' // #5, not seeded
const UNREGISTERED: Address = '0x976EA74026E726554dB657fA54763abd0C3a0aa9' // #6

async function actAs(account: Address) {
  await disconnect(wagmiConfig)
  await connect(wagmiConfig, { connector: mock({ accounts: [account] }) })
}

async function runSteps(contractSteps: Parameters<typeof executeSteps>[0]) {
  const phases: StepProgress['phase'][] = []
  const confirmed = await executeSteps(contractSteps, (progress) => phases.push(progress.phase))
  return { confirmed, phases }
}

describe('wallet transaction engine on a local Hardhat deployment', () => {
  beforeAll(async () => {
    const code = await getBytecode(wagmiConfig, { address: contracts.loanManager.address })
    if (!code || code === '0x') {
      throw new Error('No LoanManager at the local address. Run `npm run node` and `npm run deploy:local` in contracts/.')
    }
  })

  it('lender: approve + deposit confirms both steps and mints pool shares', async () => {
    await actAs(LENDER)
    const before = await readContract(wagmiConfig, { ...contracts.lendingPool, functionName: 'balanceOf', args: [LENDER] })
    const { confirmed, phases } = await runSteps(steps.deposit(LENDER, 250_000_000n))

    expect(confirmed.map((step) => step.receipt.status)).toEqual(confirmed.map(() => 'success'))
    expect(phases.filter((phase) => phase === 'step-confirmed')).toHaveLength(confirmed.length)
    expect(phases.slice(0, 3)).toEqual(['prepared', 'submitted', 'pending'])
    const after = await readContract(wagmiConfig, { ...contracts.lendingPool, functionName: 'balanceOf', args: [LENDER] })
    expect(after).toBeGreaterThan(before)
  })

  it('decodes a contract revert during simulation, before any wallet prompt', async () => {
    await actAs(UNREGISTERED)
    const failure = await runSteps(steps.requestLoan(100_000_000n, 30)).catch(describeTransactionError)
    expect(failure).toMatchObject({ kind: 'reverted' })
    expect('message' in failure && failure.message).toContain('Register your identity')
  })

  it('borrower: register, get attested, borrow, and repay in full with real receipts', async () => {
    await actAs(BORROWER)
    const registered = await readContract(wagmiConfig, {
      ...contracts.identityRegistry,
      functionName: 'isRegistered',
      args: [BORROWER],
    })
    if (!registered) {
      await runSteps(steps.registerIdentity(hashText('e2e-borrower-profile')))
    }
    const balance = await readContract(wagmiConfig, { ...contracts.mockUsdc, functionName: 'balanceOf', args: [BORROWER] })
    if (balance < 10_000_000n) {
      await runSteps(steps.claimFaucet())
    }

    await actAs(OPERATOR)
    const expiresAt = (await chainNow()) + 30n * 86_400n
    await runSteps(steps.attestScore(BORROWER, uuidToBytes32(crypto.randomUUID()), 7100, expiresAt))

    await actAs(BORROWER)
    const request = await runSteps(steps.requestLoan(100_000_000n, 30))
    const receipt = request.confirmed[0].receipt
    const [requested] = parseEventLogs({ abi: loanManagerAbi, eventName: 'LoanRequested', logs: receipt.logs })
    const funded = parseEventLogs({ abi: loanManagerAbi, eventName: 'LoanFunded', logs: receipt.logs })
    expect(funded).toHaveLength(1)
    const loanId = requested.args.loanId

    const outstanding = await readContract(wagmiConfig, { ...contracts.loanManager, functionName: 'outstanding', args: [loanId] })
    expect(outstanding).toBe(100_000_000n + 986_301n) // 100 mUSDC at 12% for 30 days
    await runSteps(steps.repayInFull(BORROWER, loanId, outstanding))

    const loan = await readContract(wagmiConfig, { ...contracts.loanManager, functionName: 'getLoan', args: [loanId] })
    expect(loan.status).toBe(5) // Repaid
    expect(await readContract(wagmiConfig, { ...contracts.loanManager, functionName: 'openLoanOf', args: [BORROWER] })).toBe(0n)
  })
})
