import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { Hex } from 'viem'
import { formatEther, formatGwei } from 'viem'
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
            sender: progress.sender,
            recipient: progress.recipient,
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
          sender: final?.receipt.from,
          recipient: final?.receipt.to ?? undefined,
          gasCost: confirmed.length > 1
            ? formatEther(confirmed.reduce((total, step) => total + step.gasUsed * step.gasPrice, 0n))
            : final?.gasCost,
          gasUsed: confirmed.reduce((total, step) => total + step.gasUsed, 0n).toString(),
          gasPrice: final ? formatGwei(final.gasPrice) : undefined,
        })
        if (final) {
          const totalGasWei = confirmed.reduce((total, step) => total + step.gasUsed * step.gasPrice, 0n)
          const logLabel = title.toLowerCase().includes('fund')
            ? 'Credora loan funding confirmed'
            : title.toLowerCase().includes('request')
              ? 'Credora loan request confirmed'
              : 'Credora transaction confirmed'
          console.info(`[${logLabel}]`, {
            network: networkLabel,
            sender: final.receipt.from,
            recipient: final.receipt.to,
            transactionHash: final.hash,
            gasUsed: confirmed.reduce((total, step) => total + step.gasUsed, 0n).toString(),
            gasPriceGwei: final ? formatGwei(final.gasPrice) : undefined,
            gasFeeEth: formatEther(totalGasWei),
            confirmedTransactions: confirmed.length,
          })
        }
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

const DEMO_CONTRACT = '0xDemo000000000000000000000000000000000000'

function demoHash(): string {
  const suffix = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(64, '0').slice(0, 64)
  return `0x${suffix}`
}

/** Mirrors the wallet lifecycle in Demo Mode without claiming that a chain transaction occurred. */
export function useDemoTransaction() {
  const { walletAddress, setTransactionStatus } = useAuth()
  const queryClient = useQueryClient()
  const [isRunning, setIsRunning] = useState(false)

  const run = useCallback(
    async <T>(title: string, action: () => Promise<T>): Promise<T | null> => {
      setIsRunning(true)
      const hash = demoHash()
      const gasUsed = '142000'
      const gasPrice = '1.500'
      const gasCost = '0.000213'
      try {
        setTransactionStatus({
          state: 'prepared',
          title,
          description: 'Demo simulation prepared. No wallet approval is required.',
          simulated: true,
          hash,
          sender: walletAddress,
          recipient: DEMO_CONTRACT,
          gasUsed,
          gasPrice,
          gasCost,
        })
        await new Promise((resolve) => setTimeout(resolve, 250))
        setTransactionStatus({
          state: 'submitted',
          title,
          description: 'Demo transaction submitted to the simulated network.',
          simulated: true,
          hash,
          sender: walletAddress,
          recipient: DEMO_CONTRACT,
          gasUsed,
          gasPrice,
          gasCost,
        })
        await new Promise((resolve) => setTimeout(resolve, 350))
        const result = await action()
        setTransactionStatus({
          state: 'confirmed',
          title,
          description: 'Simulated confirmation complete. No blockchain transaction was sent.',
          simulated: true,
          hash,
          sender: walletAddress,
          recipient: DEMO_CONTRACT,
          gasUsed,
          gasPrice,
          gasCost,
        })
        console.info('[Credora demo transaction] Simulated confirmation', {
          sender: walletAddress,
          recipient: DEMO_CONTRACT,
          transactionHash: hash,
          gasUsed,
          gasPriceGwei: gasPrice,
          simulatedGasFeeEth: gasCost,
        })
        return result
      } catch (error) {
        setTransactionStatus({
          state: 'failed',
          title,
          description: 'The simulated transaction failed.',
          simulated: true,
          hash,
          error: error instanceof Error ? error.message : 'The demo action failed.',
        })
        return null
      } finally {
        setIsRunning(false)
        await queryClient.invalidateQueries()
      }
    },
    [queryClient, setTransactionStatus, walletAddress],
  )

  return { run, isRunning }
}
