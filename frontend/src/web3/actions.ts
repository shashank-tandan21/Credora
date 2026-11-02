import type { Address, Hex } from 'viem'
import { getBlock, readContract } from 'wagmi/actions'
import { targetChain, wagmiConfig } from './config'
import { contracts } from './contracts'
import type { ContractStep } from './transactions'
import { formatUsdcExact } from './units'

const { mockUsdc, identityRegistry, creditScoreRegistry, lendingPool, loanManager, recoveryManager, disputeManager } =
  contracts

/**
 * Latest block timestamp. Contracts validate expiries and due dates against chain time,
 * which can differ from the browser clock (clock skew, or a time-travelled local node).
 */
export async function chainNow(): Promise<bigint> {
  const block = await getBlock(wagmiConfig, { chainId: targetChain.id })
  return block.timestamp
}

/** Exact-amount approval (never unlimited), skipped when the allowance already covers it. */
function approvePool(owner: Address, amount: bigint): ContractStep {
  return {
    label: `Approve ${formatUsdcExact(amount)} for the LendingPool`,
    ...mockUsdc,
    functionName: 'approve',
    args: [lendingPool.address, amount],
    skip: async () =>
      (await readContract(wagmiConfig, {
        ...mockUsdc,
        functionName: 'allowance',
        args: [owner, lendingPool.address],
      })) >= amount,
  }
}

export const steps = {
  claimFaucet: (): ContractStep[] => [
    { label: 'Claim 1,000 test mUSDC from the faucet', ...mockUsdc, functionName: 'faucet', args: [] },
  ],

  deposit: (owner: Address, amount: bigint): ContractStep[] => [
    approvePool(owner, amount),
    {
      label: `Deposit ${formatUsdcExact(amount)} into the LendingPool`,
      ...lendingPool,
      functionName: 'deposit',
      args: [amount, owner],
    },
  ],

  withdraw: (owner: Address, amount: bigint): ContractStep[] => [
    {
      label: `Withdraw ${formatUsdcExact(amount)} from the LendingPool`,
      ...lendingPool,
      functionName: 'withdraw',
      args: [amount, owner, owner],
    },
  ],

  registerIdentity: (profileHash: Hex): ContractStep[] => [
    { label: 'Register identity', ...identityRegistry, functionName: 'register', args: [profileHash] },
  ],

  requestLoan: (principal: bigint, durationDays: number): ContractStep[] => [
    {
      label: `Request ${formatUsdcExact(principal)} for ${durationDays} days`,
      ...loanManager,
      functionName: 'requestLoan',
      args: [principal, durationDays],
    },
  ],

  repay: (owner: Address, loanId: bigint, amount: bigint): ContractStep[] => [
    approvePool(owner, amount),
    {
      label: `Repay ${formatUsdcExact(amount)} on loan #${loanId}`,
      ...loanManager,
      functionName: 'repay',
      args: [loanId, amount],
    },
  ],

  repayInFull: (owner: Address, loanId: bigint, outstanding: bigint): ContractStep[] => [
    approvePool(owner, outstanding),
    { label: `Repay loan #${loanId} in full`, ...loanManager, functionName: 'repayInFull', args: [loanId] },
  ],

  cancelLoan: (loanId: bigint): ContractStep[] => [
    { label: `Cancel loan request #${loanId}`, ...loanManager, functionName: 'cancelLoan', args: [loanId] },
  ],

  markOverdue: (loanId: bigint): ContractStep[] => [
    { label: `Mark loan #${loanId} overdue`, ...loanManager, functionName: 'markOverdue', args: [loanId] },
  ],

  submitRecovery: (loanId: bigint, proposedOutstanding: bigint, finalDueAt: bigint, reasonHash: Hex): ContractStep[] => [
    {
      label: `Submit restructuring request for loan #${loanId}`,
      ...recoveryManager,
      functionName: 'submitRequest',
      args: [loanId, proposedOutstanding, finalDueAt, reasonHash],
    },
  ],

  openDispute: (assessmentId: Hex, reasonHash: Hex): ContractStep[] => [
    { label: 'Open score dispute', ...disputeManager, functionName: 'openDispute', args: [assessmentId, reasonHash] },
  ],

  attestScore: (
    borrower: Address,
    assessmentId: Hex,
    scoreBps: number,
    expiresAt: bigint,
    modelVersion = 1,
  ): ContractStep[] => [
    {
      label: `Attest score ${(scoreBps / 100).toFixed(2)} for ${borrower.slice(0, 8)}…`,
      ...creditScoreRegistry,
      functionName: 'attest',
      args: [borrower, assessmentId, scoreBps, expiresAt, modelVersion],
    },
  ],

  fundLoan: (loanId: bigint): ContractStep[] => [
    { label: `Fund and disburse loan #${loanId}`, ...loanManager, functionName: 'fundLoan', args: [loanId] },
  ],

  markDefaulted: (loanId: bigint): ContractStep[] => [
    { label: `Mark loan #${loanId} defaulted`, ...loanManager, functionName: 'markDefaulted', args: [loanId] },
  ],

  resolveDispute: (disputeId: bigint, upheld: boolean, resolutionHash: Hex): ContractStep[] => [
    {
      label: `${upheld ? 'Uphold' : 'Reject'} dispute #${disputeId}`,
      ...disputeManager,
      functionName: 'resolveDispute',
      args: [disputeId, upheld, resolutionHash],
    },
  ],

  approveRecovery: (requestId: bigint, amounts: bigint[], dueDates: bigint[], decisionHash: Hex): ContractStep[] => [
    {
      label: `Approve recovery plan #${requestId}`,
      ...recoveryManager,
      functionName: 'approveRequest',
      args: [requestId, amounts, dueDates, decisionHash],
    },
  ],

  rejectRecovery: (requestId: bigint, decisionHash: Hex): ContractStep[] => [
    {
      label: `Reject recovery request #${requestId}`,
      ...recoveryManager,
      functionName: 'rejectRequest',
      args: [requestId, decisionHash],
    },
  ],

  completeMilestone: (requestId: bigint, index: number): ContractStep[] => [
    {
      label: `Complete milestone ${index + 1} of plan #${requestId}`,
      ...recoveryManager,
      functionName: 'completeMilestone',
      args: [requestId, index],
    },
  ],
}
