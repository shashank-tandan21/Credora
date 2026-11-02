import React, { useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, Coins, Droplets, LifeBuoy } from 'lucide-react'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../common/Card'
import { Input } from '../common/Input'
import { Modal } from '../common/Modal'
import { OnChainNotice } from './WalletControl'
import { chainNow, steps } from '../../web3/actions'
import { networkLabel } from '../../web3/config'
import { LOAN_STATUS } from '../../web3/contracts'
import { useBorrowerChainState, useOnChainStatus } from '../../web3/hooks'
import { formatTimestamp, formatUsdcExact, hashText } from '../../web3/units'
import { useContractTransaction } from '../../web3/useContractTransaction'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'indigo' | 'default'> = {
  Requested: 'warning',
  Active: 'indigo',
  Overdue: 'destructive',
  Restructured: 'warning',
  Repaid: 'success',
  Cancelled: 'default',
  Defaulted: 'destructive',
}

/** Borrower view of their open loan, read directly from LoanManager. */
export const OnChainLoanCard: React.FC<{ onRequestLoan: () => void }> = ({ onRequestLoan }) => {
  const status = useOnChainStatus()
  const borrower = useBorrowerChainState()
  const { run, isRunning } = useContractTransaction()
  const [message, setMessage] = useState<string | null>(null)
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)
  const [recoveryDays, setRecoveryDays] = useState('90')
  const [recoveryReason, setRecoveryReason] = useState('')

  const { loan, loanId } = borrower
  const statusName = loan ? LOAN_STATUS[loan.status] : undefined
  const disabled = !status.canTransact || isRunning
  const account = status.address

  const confirmWith = async (title: string, contractSteps: Parameters<typeof run>[1], success: string) => {
    const result = await run(title, contractSteps)
    if (result) {
      setMessage(success)
      setTimeout(() => setMessage(null), 8000)
    }
    return result
  }

  const payNextInstallment = async () => {
    if (!account || !borrower.nextPayment) return
    const [installment, , amount] = borrower.nextPayment
    await confirmWith(
      `Pay installment #${installment}`,
      steps.repay(account, loanId, amount),
      `Installment #${installment} (${formatUsdcExact(amount)}) confirmed on ${networkLabel}.`,
    )
  }

  const repayInFull = async () => {
    if (!account) return
    await confirmWith(
      'Repay loan in full',
      steps.repayInFull(account, loanId, borrower.outstanding),
      `Loan #${loanId} fully repaid on ${networkLabel}.`,
    )
  }

  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault()
    const days = Number(recoveryDays)
    if (!Number.isInteger(days) || days < 1 || days > 365 || !recoveryReason.trim()) return
    const finalDueAt = (await chainNow()) + BigInt(days * 86_400)
    const result = await confirmWith(
      'Submit restructuring request',
      steps.submitRecovery(loanId, borrower.outstanding, finalDueAt, hashText(recoveryReason.trim())),
      'Restructuring request recorded on-chain. A recovery officer must approve it before the schedule changes.',
    )
    if (result) {
      setIsRecoveryOpen(false)
      setRecoveryReason('')
    }
  }

  const scoreLabel = borrower.scoreBps > 0 ? (borrower.scoreBps / 100).toFixed(2) : '—'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              On-chain Loan Facility
            </CardTitle>
            <CardDescription>Read live from LoanManager on {networkLabel}</CardDescription>
          </div>
          {statusName && <Badge variant={STATUS_VARIANT[statusName] ?? 'default'}>{statusName}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <OnChainNotice action="manage your on-chain loan" />

        {message && (
          <div role="status" className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {message}
          </div>
        )}

        {status.canRead && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-slate-500">Identity</span>
                <span className={`font-semibold ${borrower.registered ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {borrower.registered ? 'Registered' : 'Not registered'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-slate-500">Attested score</span>
                <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">{scoreLabel}</span>
                <span className={`ml-1 ${borrower.scoreValid ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {borrower.scoreValid ? 'valid' : borrower.scoreBps > 0 ? 'invalid' : 'none'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-slate-500">Eligible limit</span>
                <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                  {formatUsdcExact(borrower.eligibleLimit)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="block text-slate-500">Wallet</span>
                <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                  {formatUsdcExact(borrower.walletBalance)}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => confirmWith('Claim test mUSDC', steps.claimFaucet(), '1,000 test mUSDC minted to your wallet.')}
                  className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 disabled:opacity-50 cursor-pointer"
                >
                  <Droplets className="w-3 h-3" /> Get test mUSDC
                </button>
              </div>
            </div>

            {!loan ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">No open on-chain loan</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {borrower.registered
                    ? borrower.scoreValid
                      ? 'You are eligible to request a loan from the LendingPool.'
                      : 'A reviewer with the attester role must publish your score on-chain before you can borrow.'
                    : 'Register your identity on-chain first (Attest Identity above).'}
                </p>
                <Button size="sm" onClick={onRequestLoan} disabled={!borrower.scoreValid}>
                  Request a loan
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs font-mono">
                  <div>
                    <span className="block text-slate-500 font-sans">Loan</span>#{loanId.toString()}
                  </div>
                  <div>
                    <span className="block text-slate-500 font-sans">Principal</span>
                    {formatUsdcExact(loan.principal)}
                  </div>
                  <div>
                    <span className="block text-slate-500 font-sans">Interest ({loan.annualRateBps / 100}% APR)</span>
                    {formatUsdcExact(loan.interest)}
                  </div>
                  <div>
                    <span className="block text-slate-500 font-sans">Outstanding</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{formatUsdcExact(borrower.outstanding)}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-sans">Repaid</span>
                    {formatUsdcExact(loan.principalRepaid + loan.interestRepaid)}
                  </div>
                  <div>
                    <span className="block text-slate-500 font-sans">Installments</span>
                    {loan.installmentCount} × 30 days
                  </div>
                  <div>
                    <span className="block text-slate-500 font-sans">Final due</span>
                    {formatTimestamp(loan.finalDueAt)}
                  </div>
                  <div>
                    <span className="block text-slate-500 font-sans">Past due</span>
                    <span className={borrower.amountPastDue > 0n ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}>
                      {formatUsdcExact(borrower.amountPastDue)}
                    </span>
                  </div>
                </div>

                {statusName === 'Requested' && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                    <CalendarClock className="w-4 h-4 shrink-0" />
                    Awaiting funding: the pool lacked idle liquidity at request time. A funder can fund it from the
                    Reviewer Desk before the request expires, or you can cancel it.
                  </p>
                )}

                {borrower.nextPayment && borrower.nextPayment[2] > 0n && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {borrower.nextPayment[0] > 0
                      ? `Next: installment #${borrower.nextPayment[0]} due ${formatTimestamp(borrower.nextPayment[1])} — ${formatUsdcExact(borrower.nextPayment[2])}`
                      : `Restructured: ${formatUsdcExact(borrower.nextPayment[2])} due by ${formatTimestamp(borrower.nextPayment[1])}`}
                  </p>
                )}

                {borrower.openRecoveryRequestId > 0n && (
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-2">
                    <LifeBuoy className="w-4 h-4 shrink-0" />
                    Recovery request #{borrower.openRecoveryRequestId.toString()} is open. A recovery officer reviews it in
                    the Reviewer Desk.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {statusName === 'Requested' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => confirmWith('Cancel loan request', steps.cancelLoan(loanId), `Loan request #${loanId} cancelled.`)}
                    >
                      Cancel request
                    </Button>
                  )}
                  {borrower.nextPayment && borrower.nextPayment[0] > 0 && (
                    <Button size="sm" disabled={disabled} onClick={payNextInstallment} isLoading={isRunning}>
                      Pay installment #{borrower.nextPayment[0]}
                    </Button>
                  )}
                  {(statusName === 'Active' || statusName === 'Overdue' || statusName === 'Restructured') && (
                    <Button size="sm" variant="outline" disabled={disabled} onClick={repayInFull}>
                      Repay in full ({formatUsdcExact(borrower.outstanding)})
                    </Button>
                  )}
                  {borrower.amountPastDue > 0n && (statusName === 'Active' || statusName === 'Restructured') && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={disabled}
                      leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
                      onClick={() => confirmWith('Mark loan overdue', steps.markOverdue(loanId), `Loan #${loanId} recorded as overdue.`)}
                    >
                      Record overdue status
                    </Button>
                  )}
                  {borrower.recoveryEligible && borrower.openRecoveryRequestId === 0n && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={disabled}
                      leftIcon={<LifeBuoy className="w-3.5 h-3.5" />}
                      onClick={() => setIsRecoveryOpen(true)}
                    >
                      Request restructuring
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Modal
        isOpen={isRecoveryOpen}
        onClose={() => setIsRecoveryOpen(false)}
        title="Request loan restructuring"
        description="Propose a new final due date for the full outstanding balance. A recovery officer approves a milestone plan."
      >
        <form onSubmit={submitRecovery} className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs font-mono">
            Outstanding to cover: {formatUsdcExact(borrower.outstanding)}
          </div>
          <Input
            label="New final due date (days from today, 1-365)"
            type="number"
            min="1"
            max="365"
            step="1"
            value={recoveryDays}
            onChange={(e) => setRecoveryDays(e.target.value)}
            required
          />
          <div className="space-y-1.5">
            <label htmlFor="recovery-reason" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Reason (stored off-chain; only its hash is written on-chain)
            </label>
            <textarea
              id="recovery-reason"
              required
              rows={3}
              value={recoveryReason}
              onChange={(e) => setRecoveryReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsRecoveryOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isRunning} disabled={!status.canTransact}>
              Submit request
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}
