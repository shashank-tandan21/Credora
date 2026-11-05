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
        'fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-xl border bg-surface p-4 shadow-2xl dark:bg-surface',
        failed
          ? 'border-rose-200 dark:border-rose-900/70'
          : confirmed
            ? 'border-emerald-200 dark:border-emerald-900/70'
            : 'border-line dark:border-line',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0" aria-hidden="true">
          {failed ? (
            <XCircle className="w-5 h-5 text-rose-500" />
          ) : confirmed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold text-foreground dark:text-foreground">{activeTx.title}</p>
            <p className="text-xs text-muted dark:text-muted">
              {failed
                ? `${FAILURE_LABELS[activeTx.failureKind ?? 'error']}: ${activeTx.error ?? 'The transaction did not complete.'}`
                : confirmed
                  ? activeTx.description
                  : PHASE_HINTS[activeTx.state as keyof typeof PHASE_HINTS]}
            </p>
            {!failed && !confirmed && activeTx.description && (
              <p className="text-xs text-muted dark:text-muted mt-0.5">
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
                    'rounded-md px-1 py-1 text-center text-xs font-semibold',
                    reached && 'bg-brand-soft text-accent dark:bg-brand-soft dark:text-accent',
                    confirmed && index === 3 && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
                    !reached && !isFailurePoint && 'bg-surface text-muted dark:bg-subtle dark:text-muted',
                    isFailurePoint && 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
                  )}
                >
                  {isFailurePoint ? 'Failed' : phase.label}
                </li>
              )
            })}
          </ol>

          {activeTx.hash && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-surface dark:bg-subtle px-2.5 py-1.5 text-xs font-mono">
              <span className="text-muted dark:text-muted" title={activeTx.hash}>
                {truncateAddress(activeTx.hash, 8)}
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyHash}
                  className="text-muted hover:text-foreground dark:hover:text-muted cursor-pointer"
                  aria-label="Copy transaction hash"
                >
                  {copied ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
                </button>
                {explorer ? (
                  <a href={explorer} target="_blank" rel="noreferrer" className="text-accent dark:text-accent" aria-label="Open in block explorer">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="font-sans text-muted">{networkLabel}</span>
                )}
              </span>
            </div>
          )}
          {(activeTx.sender || activeTx.recipient || activeTx.gasCost) && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs dark:border-line dark:bg-subtle">
              {activeTx.sender && (
                <>
                  <dt className="font-sans text-muted">Sender</dt>
                  <dd className="truncate text-right font-mono" title={activeTx.sender}>{truncateAddress(activeTx.sender, 7)}</dd>
                </>
              )}
              {activeTx.recipient && (
                <>
                  <dt className="font-sans text-muted">Recipient / contract</dt>
                  <dd className="truncate text-right font-mono" title={activeTx.recipient}>{truncateAddress(activeTx.recipient, 7)}</dd>
                </>
              )}
              {activeTx.gasCost && (
                <>
                  <dt className="font-sans text-muted">Gas fee paid</dt>
                  <dd className="text-right font-mono">{activeTx.gasCost} ETH</dd>
                </>
              )}
              {activeTx.gasUsed && (
                <>
                  <dt className="font-sans text-muted">Gas used</dt>
                  <dd className="text-right font-mono">{activeTx.gasUsed}</dd>
                </>
              )}
              {activeTx.gasPrice && (
                <>
                  <dt className="font-sans text-muted">Gas price</dt>
                  <dd className="text-right font-mono">{activeTx.gasPrice} gwei</dd>
                </>
              )}
            </dl>
          )}
        </div>
        <button
          type="button"
          onClick={() => setTransactionStatus(null)}
          aria-label="Dismiss transaction status"
          className="rounded-lg p-1 text-muted hover:bg-surface hover:text-foreground dark:hover:bg-subtle dark:hover:text-muted cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
