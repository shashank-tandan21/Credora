import React, { useEffect, useState } from 'react'
import { CheckCircle2, Copy, ExternalLink, Loader2, X, XCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cn, truncateAddress } from '../../utils/cn'
import { explorerTxUrl, networkLabel, requiredConfirmations } from '../../web3/config'
import type { TransactionFailureKind, TransactionPhase } from '../../types'

const PHASES: { id: Exclude<TransactionPhase, 'failed'>; label: string }[] = [
  { id: 'prepared', label: 'Prepared' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
]

const PHASE_HINTS: Record<Exclude<TransactionPhase, 'failed' | 'confirmed'>, string> = {
  prepared: 'Simulation passed. Approve the request in your wallet.',
  submitted: 'Your wallet broadcast the transaction.',
  pending: `Waiting for ${requiredConfirmations} confirmation${requiredConfirmations === 1 ? '' : 's'}. Not final yet.`,
}

const FAILURE_LABELS: Record<TransactionFailureKind, string> = {
  rejected: 'Rejected in wallet',
  reverted: 'Reverted',
  timeout: 'Timed out',
  replaced: 'Replaced or cancelled',
  wrong_chain: 'Wrong network',
  not_configured: 'Not configured',
  error: 'Failed',
}

/** Global wallet-transaction status. Success is only shown for a confirmed receipt. */
export const TransactionToast: React.FC = () => {
  const { activeTx, setTransactionStatus } = useAuth()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (activeTx?.state !== 'confirmed') return
    const timer = setTimeout(() => setTransactionStatus(null), 15_000)
    return () => clearTimeout(timer)
  }, [activeTx, setTransactionStatus])

  if (!activeTx || activeTx.state === 'idle') return null

  const failed = activeTx.state === 'failed'
  const confirmed = activeTx.state === 'confirmed'
  const currentIndex = PHASES.findIndex((phase) => phase.id === activeTx.state)
  const explorer = explorerTxUrl(activeTx.hash)

  const copyHash = async () => {
    if (!activeTx.hash) return
    try {
      await navigator.clipboard.writeText(activeTx.hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl border bg-white p-4 shadow-2xl dark:bg-slate-900',
        failed
          ? 'border-rose-200 dark:border-rose-900/70'
          : confirmed
            ? 'border-emerald-200 dark:border-emerald-900/70'
            : 'border-slate-200 dark:border-slate-800',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0" aria-hidden="true">
          {failed ? (
            <XCircle className="w-5 h-5 text-rose-500" />
          ) : confirmed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{activeTx.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {failed
                ? `${FAILURE_LABELS[activeTx.failureKind ?? 'error']}: ${activeTx.error ?? 'The transaction did not complete.'}`
                : confirmed
                  ? activeTx.description
                  : PHASE_HINTS[activeTx.state as keyof typeof PHASE_HINTS]}
            </p>
            {!failed && !confirmed && activeTx.description && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {activeTx.stepCount && activeTx.stepCount > 1
                  ? `Step ${(activeTx.stepIndex ?? 0) + 1} of ${activeTx.stepCount}: `
                  : ''}
                {activeTx.description}
              </p>
            )}
          </div>

          <ol className="grid grid-cols-4 gap-1" aria-label="Transaction lifecycle">
            {PHASES.map((phase, index) => {
              const failedStep = activeTx.failedStep ?? 0
              const reached = confirmed || (failed ? index < failedStep : currentIndex >= 0 && index <= currentIndex)
              const isFailurePoint = failed && index === failedStep
              return (
                <li
                  key={phase.id}
                  aria-current={index === currentIndex ? 'step' : undefined}
                  className={cn(
                    'rounded-md px-1 py-1 text-center text-[10px] font-semibold',
                    reached && 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
                    confirmed && index === 3 && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
                    !reached && !isFailurePoint && 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
                    isFailurePoint && 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
                  )}
                >
                  {isFailurePoint ? 'Failed' : phase.label}
                </li>
              )
            })}
          </ol>

          {activeTx.hash && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 px-2.5 py-1.5 text-[11px] font-mono">
              <span className="text-slate-600 dark:text-slate-300" title={activeTx.hash}>
                {truncateAddress(activeTx.hash, 8)}
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyHash}
                  className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  aria-label="Copy transaction hash"
                >
                  {copied ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
                </button>
                {explorer ? (
                  <a href={explorer} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400" aria-label="Open in block explorer">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="font-sans text-slate-400">{networkLabel}</span>
                )}
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setTransactionStatus(null)}
          aria-label="Dismiss transaction status"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
