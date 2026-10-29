import React, { useState, useEffect } from 'react'
import {
  Coins,
  ShieldAlert,
  CheckCircle2,
  FileCheck,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'
import { Modal } from '../common/Modal'
import { api } from '../../api/client'
import { formatUSD, formatDate } from '../../utils/cn'
import type { CreditAssessment, LoanQuote, LoanRequest } from '../../types'

interface LoanMarketplaceProps {
  currentAssessment: CreditAssessment | null
  onLoanCreated: (loan: LoanRequest) => void
  onNavigate: (tab: string) => void
}

export const LoanMarketplace: React.FC<LoanMarketplaceProps> = ({
  currentAssessment,
  onLoanCreated,
  onNavigate,
}) => {
  const eligibleLimit = currentAssessment ? Math.min(currentAssessment.score * 15, 2000) : 0

  const [amount, setAmount] = useState(Math.min(500, eligibleLimit || 500))
  const [durationDays, setDurationDays] = useState(90)
  const [quote, setQuote] = useState<LoanQuote | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successLoan, setSuccessLoan] = useState<LoanRequest | null>(null)

  useEffect(() => {
    if (eligibleLimit > 0 && amount > eligibleLimit) {
      setAmount(eligibleLimit)
    }
  }, [eligibleLimit])

  // Recalculate quote whenever amount or duration changes
  useEffect(() => {
    let isCancelled = false
    const fetchQuote = async () => {
      if (amount <= 0 || !currentAssessment) return
      setIsLoadingQuote(true)
      try {
        const q = await api.getLoanQuote(amount, durationDays)
        if (!isCancelled) {
          setQuote(q)
          setErrorMessage(null)
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setErrorMessage((err as Error).message)
          setQuote(null)
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
  }, [amount, durationDays, currentAssessment])

  const handleApplyLoan = async () => {
    setIsSubmittingLoan(true)
    try {
      const loan = await api.requestLoan(amount, durationDays)
      setIsConfirmModalOpen(false)
      setSuccessLoan(loan)
      onLoanCreated(loan)
    } catch (err: unknown) {
      setErrorMessage((err as Error).message)
      setIsConfirmModalOpen(false)
    } finally {
      setIsSubmittingLoan(false)
    }
  }

  if (!currentAssessment) {
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
          Non-custodial micro-loans disbursed directly from the protocol liquidity pool
        </p>
      </div>

      {/* Success Banner */}
      {successLoan && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Loan Successfully Funded & Disbursed!</h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Facility of {formatUSD(successLoan.amount)} for {successLoan.duration_days} days is
              now active. Installment #1 is scheduled for{' '}
              {formatDate(successLoan.installments[0]?.due_date)}.
            </p>
            <div className="pt-2">
              <Button size="sm" variant="outline" onClick={() => onNavigate('borrower')}>
                View Active Facility in Dashboard
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
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Requested Principal
                  </span>
                  <span className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                    {formatUSD(amount)}
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max={eligibleLimit}
                  step="25"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full accent-blue-600 dark:accent-blue-400 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Min: $50.00</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Max Eligible: {formatUSD(eligibleLimit)}
                  </span>
                </div>
              </div>

              {/* Duration Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Repayment Duration
                  </span>
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                    {durationDays} Days ({Math.floor((durationDays + 29) / 30)} monthly installments)
                  </span>
                </div>
                <input
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
                {isLoadingQuote && (
                  <span className="text-[10px] text-blue-500 font-medium animate-pulse">
                    Updating...
                  </span>
                )}
              </div>
              <CardDescription>Generated from current pool liquidity & credit tier</CardDescription>
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
                        {formatUSD(quote.interest_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5 text-sm">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        Total Repayment
                      </span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {formatUSD(quote.total_repayment)}
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
                      onClick={() => setIsConfirmModalOpen(true)}
                    >
                      Request Loan Disbursement
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
        description="Review transaction terms before disbursing funds from the Credora LendingPool."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Disbursed Principal:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {formatUSD(amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Duration:</span>
              <span className="text-slate-800 dark:text-slate-200">{durationDays} Days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Obligation:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {quote ? formatUSD(quote.total_repayment) : '—'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            By confirming, you authorize the protocol to instantiate a smart loan contract.
            Disbursement will be simulated into your connected wallet address.
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
            <Button size="sm" onClick={handleApplyLoan} isLoading={isSubmittingLoan}>
              Confirm & Disburse
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
