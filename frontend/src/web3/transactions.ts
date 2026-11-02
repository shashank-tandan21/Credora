import type { Abi, Address, Hex, TransactionReceipt } from 'viem'
import { getConnection, getPublicClient, simulateContract, writeContract } from 'wagmi/actions'
import { receiptTimeoutMs, requiredConfirmations, targetChain, wagmiConfig } from './config'
import { contractsConfigured, protocolErrorsAbi } from './contracts'
import { TransactionFlowError } from './errors'

export interface ContractStep {
  label: string
  address: Address
  abi: Abi
  functionName: string
  args: readonly unknown[]
  /** Return true when the step is unnecessary, e.g. an allowance that already suffices. */
  skip?: () => Promise<boolean>
}

export interface StepProgress {
  /** `step-confirmed` marks an intermediate step done; it is never the final success. */
  phase: 'prepared' | 'submitted' | 'pending' | 'step-confirmed'
  label: string
  stepIndex: number
  stepCount: number
  hash?: Hex
}

export interface ConfirmedStep {
  label: string
  hash: Hex
  receipt: TransactionReceipt
}

/**
 * Run contract calls sequentially with an explicit lifecycle per step:
 *   prepared  - simulated successfully against the target chain (no wallet prompt yet)
 *   submitted - the wallet returned a transaction hash
 *   pending   - waiting for `requiredConfirmations` on the target chain
 * A step only counts as confirmed when its receipt has status `success`, was mined on the
 * target chain, and targets the expected contract. Rejections, reverts, timeouts, and
 * cancelled or replaced transactions throw a TransactionFlowError (or a wallet error that
 * describeTransactionError classifies); none of them can resolve as success.
 */
export async function executeSteps(
  steps: ContractStep[],
  onProgress: (progress: StepProgress) => void,
): Promise<ConfirmedStep[]> {
  if (!contractsConfigured) {
    throw new TransactionFlowError('not_configured', 'Contract addresses are not configured for this network.')
  }
  const connection = getConnection(wagmiConfig)
  if (!connection.isConnected || !connection.address) {
    throw new TransactionFlowError('error', 'Connect a wallet first.')
  }
  if (connection.chainId !== targetChain.id) {
    throw new TransactionFlowError(
      'wrong_chain',
      `Switch your wallet to ${targetChain.name} (chain ${targetChain.id}) before sending transactions.`,
    )
  }
  const account = connection.address
  const publicClient = getPublicClient(wagmiConfig, { chainId: targetChain.id })
  if (!publicClient) {
    throw new TransactionFlowError('not_configured', `No RPC client is configured for ${targetChain.name}.`)
  }

  const activeSteps: ContractStep[] = []
  for (const step of steps) {
    if (!(step.skip && (await step.skip()))) activeSteps.push(step)
  }

  const confirmed: ConfirmedStep[] = []
  for (const [stepIndex, step] of activeSteps.entries()) {
    const base = { label: step.label, stepIndex, stepCount: activeSteps.length }
    const { request } = await simulateContract(wagmiConfig, {
      account,
      address: step.address,
      abi: [...step.abi, ...protocolErrorsAbi],
      functionName: step.functionName,
      args: step.args,
      chainId: targetChain.id,
    })
    onProgress({ ...base, phase: 'prepared' })

    const hash = await writeContract(wagmiConfig, request)
    onProgress({ ...base, phase: 'submitted', hash })
    onProgress({ ...base, phase: 'pending', hash })

    let replacement: { reason: 'cancelled' | 'replaced' | 'repriced'; hash: Hex } | undefined
    let receipt: TransactionReceipt
    try {
      receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: requiredConfirmations,
        timeout: receiptTimeoutMs,
        onReplaced: (replaced) => {
          replacement = { reason: replaced.reason, hash: replaced.transaction.hash }
          if (replaced.reason === 'repriced') {
            onProgress({ ...base, phase: 'pending', hash: replaced.transaction.hash })
          }
        },
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'WaitForTransactionReceiptTimeoutError') {
        throw new TransactionFlowError(
          'timeout',
          `No receipt after ${Math.round(receiptTimeoutMs / 1000)}s. It may still confirm; check the transaction hash before retrying.`,
          hash,
        )
      }
      throw error
    }

    if (replacement && replacement.reason !== 'repriced') {
      throw new TransactionFlowError(
        'replaced',
        replacement.reason === 'cancelled'
          ? 'The transaction was cancelled in the wallet.'
          : 'The transaction was replaced by a different transaction.',
        replacement.hash,
      )
    }
    if (receipt.status !== 'success') {
      throw new TransactionFlowError('reverted', 'The transaction reverted on-chain.', receipt.transactionHash)
    }
    if (receipt.to?.toLowerCase() !== step.address.toLowerCase()) {
      throw new TransactionFlowError('error', 'The receipt does not belong to the expected contract.', receipt.transactionHash)
    }
    confirmed.push({ label: step.label, hash: receipt.transactionHash, receipt })
    onProgress({ ...base, phase: 'step-confirmed', hash: receipt.transactionHash })
  }
  return confirmed
}
