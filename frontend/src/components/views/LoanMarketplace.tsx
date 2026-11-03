import React, { useState, useEffect } from 'react'
import {
  Coins,
  ShieldAlert,
  CheckCircle2,
  FileCheck,
} from 'lucide-react'
import { parseEventLogs } from 'viem'
import { useReadContract } from 'wagmi'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'
import { Modal } from '../common/Modal'
import { OnChainNotice } from '../web3/WalletControl'
import { api } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { formatUSD, formatDate } from '../../utils/cn'
import { steps } from '../../web3/actions'
import { networkLabel, targetChain } from '../../web3/config'
import { contracts } from '../../web3/contracts'
import { loanManagerAbi } from '../../web3/generated/abis'
import { useBorrowerChainState, useOnChainStatus } from '../../web3/hooks'
import { formatUsdcExact, fromUsdcUnits, toUsdcUnits } from '../../web3/units'
import { useContractTransaction } from '../../web3/useContractTransaction'
import type { CreditAssessment, LoanQuote, LoanRequest } from '../../types'

interface LoanMarketplaceProps {
  currentAssessment: CreditAssessment | null
  onLoanCreated: (loan: LoanRequest) => void
  onNavigate: (tab: string) => void
}

type SuccessState =
  | { kind: 'demo'; loan: LoanRequest }
  | { kind: 'onchain'; funded: boolean; loanId?: bigint; principal: bigint }

export const LoanMarketplace: React.FC<LoanMarketplaceProps> = ({
  currentAssessment,
  onLoanCreated,
  onNavigate,
}) => {
  const { networkMode } = useAuth()
  const onchain = networkMode === 'onchain'
  const chainStatus = useOnChainStatus()
  const chainBorrower = useBorrowerChainState()
  const { run, isRunning } = useContractTransaction()

  const eligibleLimit = onchain
    ? chainBorrower.scoreValid
      ? fromUsdcUnits(chainBorrower.eligibleLimit)
      : 0
    : currentAssessment
      ? Math.min(currentAssessment.score * 15, 2000)
      : 0

  const [amount, setAmount] = useState(Math.min(500, eligibleLimit || 500))
  const [durationDays, setDurationDays] = useState(90)
  const [backendQuote, setBackendQuote] = useState<LoanQuote | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessState | null>(null)
  // Anchor for estimated on-chain due dates; the real schedule starts at funding time.
  const [quotedAt] = useState(() => Date.now())

  const principalUnits = toUsdcUnits(String(amount)) ?? 0n
  const chainQuote = useReadContract({
    ...contracts.loanManager,
    functionName: 'quote',
    args: [principalUnits, durationDays],
    chainId: targetChain.id,
    query: { enabled: onchain && chainStatus.canRead && principalUnits > 0n },
  })

  useEffect(() => {
    if (eligibleLimit > 0 && amount > eligibleLimit) {
      setAmount(eligibleLimit)
    }
  }, [eligibleLimit])

  // Demo / backend quote: recalculated whenever amount or duration changes.
  useEffect(() => {
    if (onchain) return
    let isCancelled = false
    const fetchQuote = async () => {
      if (amount <= 0 || !currentAssessment) return
      setIsLoadingQuote(true)
      try {
        const q = await api.getLoanQuote(amount, durationDays)
        if (!isCancelled) {
          setBackendQuote(q)
          setErrorMessage(null)
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setErrorMessage((err as Error).message)
          setBackendQuote(null)
        }
      } finally {
        if (!isCancelled) setIsLoadingQuote(false)
      }
    }

    const timer = setTimeout(fetchQuote, 150)
    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [amount, durationDays, currentAssessment, onchain])

  // On-chain quote: exact smallest-unit amounts from LoanManager.quote. Due dates are
  // estimates; the real schedule starts when the loan is funded.
  const onChainQuote: LoanQuote | null = (() => {
    if (!onchain || !chainQuote.data) return null
    const [interest, totalDue, count, perInstallment] = chainQuote.data
    return {
      amount,
      eligible_limit: eligibleLimit,
      interest_rate: 12,
      interest_amount: fromUsdcUnits(interest),
      total_repayment: fromUsdcUnits(totalDue),
      duration_days: durationDays,
      installments: Array.from({ length: count }, (_, index) => ({
        installment_number: index + 1,
        due_date: new Date(quotedAt + (index + 1) * 30 * 86_400_000).toISOString().split('T')[0],
        amount: fromUsdcUnits(index === count - 1 ? totalDue - perInstallment * BigInt(count - 1) : perInstallment),
        status: 'scheduled' as const,
      })),
    }
  })()
  const quote = onchain ? onChainQuote : backendQuote

  const handleApplyLoan = async () => {
    if (onchain) {
      if (principalUnits === 0n) return
      const result = await run('Request on-chain loan', steps.requestLoan(principalUnits, durationDays))
      setIsConfirmModalOpen(false)
      if (!result) return
      const receipt = result[result.length - 1].receipt
      const requested = parseEventLogs({ abi: loanManagerAbi, eventName: 'LoanRequested', logs: receipt.logs })[0]
      const funded = parseEventLogs({ abi: loanManagerAbi, eventName: 'LoanFunded', logs: receipt.logs }).length > 0
      setSuccess({ kind: 'onchain', funded, loanId: requested?.args.loanId, principal: principalUnits })
      return
    }

    setIsSubmittingLoan(true)
    try {
      const loan = await api.requestLoan(amount, durationDays)
      setIsConfirmModalOpen(false)
      setSuccess({ kind: 'demo', loan })
      onLoanCreated(loan)
    } catch (err: unknown) {
      setErrorMessage((err as Error).message)
      setIsConfirmModalOpen(false)
    } finally {
      setIsSubmittingLoan(false)
    }
  }

  // A confirmed request must always show its outcome, even though the borrower now has an
  // open loan (which would otherwise route to the gate below after the refetch).
  if (onchain && success?.kind === 'onchain') {
    return (
      <div role="status" className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-200 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">
            {success.funded
              ? `Loan #${success.loanId?.toString() ?? ''} funded and disbursed on ${networkLabel}`
              : `Loan #${success.loanId?.toString() ?? ''} requested on ${networkLabel}`}
          </h4>
          <p className="text-xs">
            {success.funded
              ? `${formatUsdcExact(success.principal)} was transferred to your wallet by the LendingPool. The schedule starts now.`
              : 'The pool lacked idle liquidity, so the request is queued for a funder. It is not disbursed yet.'}
          </p>
          <div className="pt-2">
            <Button size="sm" variant="outline" onClick={() => onNavigate('borrower')}>
              View On-chain Facility
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (onchain && (!chainStatus.canRead || !chainBorrower.registered || !chainBorrower.scoreValid || chainBorrower.loan)) {
    const openLoan = chainBorrower.loan
    return (
      <Card className="max-w-xl mx-auto my-12 text-center p-8 space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <CardTitle className="text-lg">
          {openLoan ? `Open on-chain loan #${chainBorrower.loanId}` : 'On-chain eligibility required'}
        </CardTitle>
        <CardDescription className="max-w-md mx-auto">
          {!chainStatus.canRead
            ? `Connect to ${networkLabel} to check your on-chain eligibility.`
            : openLoan
              ? 'LoanManager allows one open loan per borrower. Repay or cancel it before requesting another.'
              : !chainBorrower.registered
                ? 'Register your identity in the IdentityRegistry from My Facilities first.'
                : 'A reviewer with the attester role must publish your current score in the CreditScoreRegistry (Reviewer Desk → On-chain Operations).'}
        </CardDescription>
        <OnChainNotice action="request an on-chain loan" />
        <div>
          <Button onClick={() => onNavigate('borrower')}>Open My Facilities</Button>
        </div>
      </Card>
    )
  }

  if (!onchain && !currentAssessment) {
    return (
      <Card className="max-w-xl mx-auto my-12 text-center p-8">
        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <CardTitle className="text-lg">Credit Assessment Required</CardTitle>
        <CardDescription className="max-w-md mx-auto mt-2">
          Under the Credora academic protocol, micro-loans require an active 5-factor credit
          assessment to establish your borrowing limit.
        </CardDescription>
        <div className="pt-6">
          <Button onClick={() => onNavigate('credit')}>Open Credit Studio</Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Coins className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Loan Marketplace & Quotation Engine
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {onchain
            ? `Loans are requested from your wallet and disbursed by the LendingPool on ${networkLabel}`
            : 'Demo Mode: requests are simulated; nothing is disbursed on-chain'}
        </p>
      </div>

      {onchain && <OnChainNotice action="request a loan" />}

      {/* Success Banner */}
      {success?.kind === 'demo' && (
        <div role="status" className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Demo loan request recorded</h4>
            <p className="text-xs">
              Simulated facility of {formatUSD(success.loan.amount)} for {success.loan.duration_days} days. Installment
              #1 would be due {formatDate(success.loan.installments[0]?.due_date)}. No funds moved and no blockchain
              transaction was sent.
            </p>
            <div className="pt-2">
              <Button size="sm" variant="outline" onClick={() => onNavigate('borrower')}>
                View Demo Facility
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Main Grid: Term Configuration & Live Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Sliders */}
        <div className="lg:col-span-7 space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Loan Parameters</CardTitle>
                  <CardDescription>
                    Configure desired principal and repayment tenure
                  </CardDescription>
                </div>
                <Badge variant="indigo" size="sm">
                  12.0% Fixed APR
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Amount Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="loan-amount" className="font-semibold text-slate-700 dark:text-slate-300">
                    Requested Principal
                  </label>
                  <span className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                    {formatUSD(amount)}
                  </span>
                </div>
                <input
                  id="loan-amount"
                  type="range"
                  min="50"
                  max={eligibleLimit}
                  step="25"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full accent-blue-600 dark:accent-blue-400 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Min: {formatUSD(50)}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Max Eligible{onchain ? ' (on-chain)' : ''}: {formatUSD(eligibleLimit)}
                  </span>
                </div>
              </div>

              {/* Duration Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="loan-duration" className="font-semibold text-slate-700 dark:text-slate-300">
                    Repayment Duration
                  </label>
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                    {durationDays} Days ({Math.floor((durationDays + 29) / 30)} monthly installments)
                  </span>
                </div>
                <input
                  id="loan-duration"
                  type="range"
                  min="30"
                  max="365"
                  step="30"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full accent-blue-600 dark:accent-blue-400 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>30 Days (1 mo)</span>
                  <span>180 Days (6 mos)</span>
                  <span>365 Days (1 yr)</span>
                </div>
              </div>

              {/* Protocol Terms Disclosure */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs space-y-2 text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2 text-slate-900 dark:text-slate-200 font-medium">
                  <FileCheck className="w-4 h-4 text-blue-500" />
                  <span>Transparent Financial Conventions</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  • Interest is computed on exact 365-day basis points (1200 bps).
                  <br />• Final installment absorbs rounding difference so schedule totals equal
                  the exact repayment obligation.
                  <br />• Zero origination fees or prepayment penalties.
                  {onchain && (
                    <>
                      <br />• On-chain amounts are exact to 6 decimals and rounded down; they are authoritative for
                      settlement.
                    </>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Quotation Summary & Amortization Table */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Quotation Breakdown</CardTitle>
                {(isLoadingQuote || chainQuote.isFetching) && (
                  <span className="text-[10px] text-blue-500 font-medium animate-pulse">
                    Updating...
                  </span>
                )}
              </div>
              <CardDescription>
                {onchain ? 'Read from LoanManager.quote on-chain' : 'Generated from current pool liquidity & credit tier'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {quote ? (
                <>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-500">Principal Disbursed</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatUSD(quote.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-500">Annual Interest Rate</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        12.00% APR
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-slate-500">Total Accrued Interest</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {onchain && chainQuote.data ? formatUsdcExact(chainQuote.data[0]) : formatUSD(quote.interest_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5 text-sm">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        Total Repayment
                      </span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {onchain && chainQuote.data ? formatUsdcExact(chainQuote.data[1]) : formatUSD(quote.total_repayment)}
                      </span>
                    </div>
                  </div>

                  {/* Installment Schedule Preview */}
                  <div>
                    <h5 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Installment Schedule ({quote.installments.length} Payments)
                    </h5>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 text-xs font-mono">
                      {quote.installments.map((inst) => (
                        <div
                          key={inst.installment_number}
                          className="flex justify-between items-center p-2 rounded bg-slate-50 dark:bg-slate-800/60"
                        >
                          <span className="text-slate-600 dark:text-slate-400">
                            #{inst.installment_number} Due {formatDate(inst.due_date)}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {formatUSD(inst.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={onchain && !chainStatus.canTransact}
                      onClick={() => setIsConfirmModalOpen(true)}
                    >
                      {onchain ? 'Request Loan On-chain' : 'Simulate Loan Request'}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  {errorMessage || 'Calculating live quotation...'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Micro-Loan Request"
        description={
          onchain
            ? 'Your wallet will ask you to confirm LoanManager.requestLoan.'
            : 'Demo Mode: this request is simulated.'
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Principal:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {onchain ? formatUsdcExact(principalUnits) : formatUSD(amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Duration:</span>
              <span className="text-slate-800 dark:text-slate-200">{durationDays} Days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Obligation:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {onchain && chainQuote.data
                  ? formatUsdcExact(chainQuote.data[1])
                  : quote
                    ? formatUSD(quote.total_repayment)
                    : '—'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            {onchain
              ? 'If the pool has enough idle liquidity the loan is funded and disbursed in the same transaction; otherwise it is queued for a funder. Success is shown only after the transaction is confirmed.'
              : 'By confirming you create a simulated request. No wallet, contract, or funds are involved.'}
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleApplyLoan} isLoading={isSubmittingLoan || isRunning}>
              {onchain ? 'Confirm in Wallet' : 'Confirm Simulation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
