import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { Hex } from 'viem'
import { useAuth } from '../contexts/AuthContext'
import { networkLabel } from './config'
import { describeTransactionError } from './errors'
import { type ConfirmedStep, type ContractStep, executeSteps } from './transactions'

/**
 * Runs contract steps and mirrors every lifecycle phase into the global transaction
 * status. Resolves with the confirmed steps, or null when anything failed; callers must
 * only show success after a non-null result.
 */
export function useContractTransaction() {
  const { setTransactionStatus } = useAuth()
  const queryClient = useQueryClient()
  const [isRunning, setIsRunning] = useState(false)

  const run = useCallback(
    async (title: string, contractSteps: ContractStep[]): Promise<ConfirmedStep[] | null> => {
      setIsRunning(true)
      let lastHash: Hex | undefined
      let lastPhase: 'prepared' | 'submitted' | 'pending' | undefined
      try {
        const confirmed = await executeSteps(contractSteps, (progress) => {
          lastHash = progress.hash ?? lastHash
          if (progress.phase === 'step-confirmed') {
            lastPhase = undefined
            return
          }
          lastPhase = progress.phase
          setTransactionStatus({
            state: progress.phase,
            title,
            description: progress.label,
            hash: progress.hash,
            stepIndex: progress.stepIndex,
            stepCount: progress.stepCount,
          })
        })
        const final = confirmed.at(-1)
        setTransactionStatus({
          state: 'confirmed',
          title,
          description:
            confirmed.length === 1
              ? `Confirmed on ${networkLabel}.`
              : `${confirmed.length} transactions confirmed on ${networkLabel}.`,
          hash: final?.hash,
          hashes: confirmed.map((step) => step.hash),
        })
        return confirmed
      } catch (error) {
        const failure = describeTransactionError(error)
        setTransactionStatus({
          state: 'failed',
          title,
          error: failure.message,
          failureKind: failure.kind,
          failedStep: lastPhase === undefined ? 0 : lastPhase === 'prepared' ? 1 : 2,
          hash: failure.hash ?? (failure.kind === 'rejected' ? undefined : lastHash),
        })
        return null
      } finally {
        setIsRunning(false)
        await queryClient.invalidateQueries()
      }
    },
    [queryClient, setTransactionStatus],
  )

  return { run, isRunning }
}
