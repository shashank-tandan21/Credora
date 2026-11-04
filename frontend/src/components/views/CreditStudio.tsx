import React, { useState } from 'react'
import {
  Sliders,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Scale,
  ArrowRight,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card'
import { Button } from '../common/Button'
import { Badge, RiskBadge } from '../common/Badge'
import { Modal } from '../common/Modal'
import { api } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { formatUSD } from '../../utils/cn'
import { steps } from '../../web3/actions'
import { networkLabel } from '../../web3/config'
import { useBorrowerChainState, useOnChainStatus } from '../../web3/hooks'
import { hashText } from '../../web3/units'
import { useContractTransaction } from '../../web3/useContractTransaction'
import type { CreditAssessment } from '../../types'

const ZERO_ID = `0x${'0'.repeat(64)}`

interface CreditStudioProps {
  currentAssessment: CreditAssessment | null
  onAssessmentUpdated: (newAssessment: CreditAssessment) => void
  onProceedToBorrow?: () => void
}

export const CreditStudio: React.FC<CreditStudioProps> = ({
  currentAssessment,
  onAssessmentUpdated,
  onProceedToBorrow,
}) => {
  // Slider states for evidence
  const [repaymentHistory, setRepaymentHistory] = useState(
    currentAssessment?.components.find((c) => c.name === 'Repayment history')?.raw_score ?? 88
  )
  const [affordability, setAffordability] = useState(
    currentAssessment?.components.find((c) => c.name === 'Affordability')?.raw_score ?? 82
  )
  const [debtBurden, setDebtBurden] = useState(
    currentAssessment?.components.find((c) => c.name === 'Debt burden')?.raw_score ?? 80
  )
  const [cashFlow, setCashFlow] = useState(
    currentAssessment?.components.find((c) => c.name === 'Cash-flow stability')?.raw_score ?? 75
  )
  const [evidenceQuality, setEvidenceQuality] = useState(
    currentAssessment?.components.find((c) => c.name === 'Evidence quality')?.raw_score ?? 90
  )

  const [isCommitting, setIsCommitting] = useState(false)
  const [isDisputeOpen, setIsDisputeOpen] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeStatus, setDisputeStatus] = useState<string | null>(null)

  const { networkMode } = useAuth()
  const onchain = networkMode === 'onchain'
  const chainStatus = useOnChainStatus()
  const chainBorrower = useBorrowerChainState()
  const { run, isRunning } = useContractTransaction()
  const onChainAssessmentId =
    chainBorrower.assessmentId && chainBorrower.assessmentId !== ZERO_ID ? chainBorrower.assessmentId : undefined

  // Real-time calculated score projection
  const projectedScore = Number(
    (
      repaymentHistory * 0.35 +
      affordability * 0.25 +
      debtBurden * 0.15 +
      cashFlow * 0.15 +
      evidenceQuality * 0.1
    ).toFixed(2)
  )

  const getRiskCategory = (score: number) => {
    if (score < 40) return 'High risk'
    if (score < 60) return 'Moderate risk'
    if (score < 75) return 'Fair'
    if (score < 90) return 'Good'
    return 'Strong'
  }

  const radarData = [
    { subject: 'Repayment (35%)', value: repaymentHistory, benchmark: 70 },
    { subject: 'Affordability (25%)', value: affordability, benchmark: 70 },
    { subject: 'Debt Burden (15%)', value: debtBurden, benchmark: 70 },
    { subject: 'Cash Flow (15%)', value: cashFlow, benchmark: 70 },
    { subject: 'Evidence (10%)', value: evidenceQuality, benchmark: 70 },
  ]

  const handleCommitAssessment = async () => {
    setIsCommitting(true)
    try {
      await api.submitEvidence({
        evidence_type: 'Self-Reported & Verified Micro-Evidence',
        period_months: 6,
        repayment_history_score: repaymentHistory,
        affordability_score: affordability,
        debt_burden_score: debtBurden,
        cash_flow_stability_score: cashFlow,
        evidence_quality_score: evidenceQuality,
      })
      const newAssessment = await api.createAssessment(90)
      onAssessmentUpdated(newAssessment)
    } finally {
      setIsCommitting(false)
    }
  }

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!disputeReason.trim()) return
    if (onchain) {
      if (!onChainAssessmentId) return
      // Only the hash of the reason is written on-chain; the text stays off-chain.
      const result = await run('Open on-chain score dispute', steps.openDispute(onChainAssessmentId, hashText(disputeReason.trim())))
      if (!result) return
      setIsDisputeOpen(false)
      setDisputeReason('')
      setDisputeStatus(`Dispute recorded on ${networkLabel}. A reviewer resolves it from the Reviewer Desk.`)
      setTimeout(() => setDisputeStatus(null), 8000)
      return
    }
    if (!currentAssessment) return
    await api.disputeAssessment(currentAssessment.id, disputeReason)
    setIsDisputeOpen(false)
    setDisputeStatus('Demo dispute submitted to the Reviewer Desk queue (simulated, no blockchain transaction).')
    setTimeout(() => setDisputeStatus(null), 6000)
  }

  const projectedCategory = getRiskCategory(projectedScore)
  const projectedLimit = Math.min(projectedScore * 15, 2000)

  return (
    <div className="space-y-6">
      {/* Dispute Alert Banner */}
      {disputeStatus && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300 text-sm font-medium">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>{disputeStatus}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line dark:border-line">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground dark:text-foreground flex items-center gap-2">
            <Sliders className="w-5 h-5 text-accent dark:text-accent" />
            Assessment calculator
          </h2>
          <p className="text-sm text-muted dark:text-muted mt-0.5">
            Adjust the factor inputs to explore your assessment. Save when you are ready.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(onchain ? onChainAssessmentId : currentAssessment) && (
            <Button
              size="sm"
              variant="outline"
              className="text-sm"
              onClick={() => setIsDisputeOpen(true)}
              leftIcon={<Scale className="w-3.5 h-3.5" />}
            >
              {onchain ? 'Dispute On-chain Score' : 'Dispute Assessment'}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleCommitAssessment}
            isLoading={isCommitting}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Save assessment
          </Button>

        </div>
      </div>

      {/* Main Grid: Interactive Evidence Sliders & Live Radar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Sliders */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Assessment inputs</CardTitle>
                  <CardDescription>
                    Enter normalized factor scores. These inputs are self-reported.
                  </CardDescription>
                </div>
                <Badge variant="indigo" size="sm">
                  Five-factor model
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Factor 1: Repayment History */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground dark:text-foreground flex items-center gap-1.5">
                    Repayment History
                    <span className="text-sm text-accent dark:text-accent tabular-nums font-normal">
                      (35% Weight)
                    </span>
                  </span>
                  <span className="tabular-nums font-semibold text-foreground dark:text-foreground">
                    {repaymentHistory}/100
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  aria-label="Repayment history score"
                  value={repaymentHistory}
                  onChange={(e) => setRepaymentHistory(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer h-1.5 bg-subtle dark:bg-subtle rounded-lg"
                />
                <div className="flex justify-between text-sm text-muted">
                  <span>Delinquent (0)</span>
                  <span>Average (50)</span>
                  <span>Flawless (100)</span>
                </div>
              </div>

              {/* Factor 2: Affordability */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground dark:text-foreground flex items-center gap-1.5">
                    Affordability & Residual Income
                    <span className="text-sm text-accent dark:text-accent tabular-nums font-normal">
                      (25% Weight)
                    </span>
                  </span>
                  <span className="tabular-nums font-semibold text-foreground dark:text-foreground">
                    {affordability}/100
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  aria-label="Affordability score"
                  value={affordability}
                  onChange={(e) => setAffordability(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer h-1.5 bg-subtle dark:bg-subtle rounded-lg"
                />
                <div className="flex justify-between text-sm text-muted">
                  <span>Constrained (0)</span>
                  <span>Moderate (50)</span>
                  <span>Substantial (100)</span>
                </div>
              </div>

              {/* Factor 3: Debt Burden */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground dark:text-foreground flex items-center gap-1.5">
                    Debt Burden / Leverage Ratio
                    <span className="text-sm text-accent dark:text-accent tabular-nums font-normal">
                      (15% Weight)
                    </span>
                  </span>
                  <span className="tabular-nums font-semibold text-foreground dark:text-foreground">
                    {debtBurden}/100
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  aria-label="Debt burden score"
                  value={debtBurden}
                  onChange={(e) => setDebtBurden(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer h-1.5 bg-subtle dark:bg-subtle rounded-lg"
                />
                <div className="flex justify-between text-sm text-muted">
                  <span>High Debt (0)</span>
                  <span>Manageable (50)</span>
                  <span>Minimal/Zero (100)</span>
                </div>
              </div>

              {/* Factor 4: Cash-Flow Stability */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground dark:text-foreground flex items-center gap-1.5">
                    Cash-Flow Stability
                    <span className="text-sm text-accent dark:text-accent tabular-nums font-normal">
                      (15% Weight)
                    </span>
                  </span>
                  <span className="tabular-nums font-semibold text-foreground dark:text-foreground">
                    {cashFlow}/100
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  aria-label="Cash-flow stability score"
                  value={cashFlow}
                  onChange={(e) => setCashFlow(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer h-1.5 bg-subtle dark:bg-subtle rounded-lg"
                />
                <div className="flex justify-between text-sm text-muted">
                  <span>Erratic (0)</span>
                  <span>Seasonal (50)</span>
                  <span>Predictable (100)</span>
                </div>
              </div>

              {/* Factor 5: Evidence Quality */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground dark:text-foreground flex items-center gap-1.5">
                    Evidence Quality & Document Verifiability
                    <span className="text-sm text-accent dark:text-accent tabular-nums font-normal">
                      (10% Weight)
                    </span>
                  </span>
                  <span className="tabular-nums font-semibold text-foreground dark:text-foreground">
                    {evidenceQuality}/100
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  aria-label="Evidence quality score"
                  value={evidenceQuality}
                  onChange={(e) => setEvidenceQuality(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer h-1.5 bg-subtle dark:bg-subtle rounded-lg"
                />
                <div className="flex justify-between text-sm text-muted">
                  <span>Low (0)</span>
                  <span>Standard (50)</span>
                  <span>High (100)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Radar Visualization & Projected Standing */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Factor breakdown</CardTitle>
                <RiskBadge category={projectedCategory as any} size="sm" />
              </div>
              <CardDescription>Your input for each factor, on a scale of 0 to 100.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center">
              <dl className="w-full space-y-4 py-4">
                {radarData.map(factor => <div key={factor.subject}>
                  <div className="flex justify-between gap-3 text-sm mb-2"><dt>{factor.subject}</dt><dd className="tabular-nums font-medium">{factor.value} / 100</dd></div>
                  <div className="h-1.5 rounded-full bg-subtle overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: factor.value + '%' }} /></div>
                </div>)}
              </dl>

              {/* Projected Summary Box */}
              <div className="w-full grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface dark:bg-subtle border border-line dark:border-line mt-2">
                <div>
                  <span className="text-sm text-muted">Projected Score</span>
                  <div className="text-xl font-semibold tabular-nums text-accent dark:text-accent">
                    {projectedScore.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted">Estimated limit</span>
                  <div className="text-xl font-semibold tabular-nums text-foreground dark:text-foreground">
                    {formatUSD(projectedLimit)}
                  </div>
                </div>
              </div>

              {onProceedToBorrow && (
                <Button
                  size="sm"
                  className="w-full mt-3"
                  variant="outline"
                  disabled={!currentAssessment}
                  onClick={onProceedToBorrow}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Review loan options
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Explainability Explanations Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wider text-muted dark:text-muted flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                Saved assessment notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-muted dark:text-muted">
                {currentAssessment?.explanation.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                )) || (
                  <li className="text-muted italic">
                    Commit your inputs to generate automated explainability factors.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dispute Modal */}
      <Modal
        isOpen={isDisputeOpen}
        onClose={() => setIsDisputeOpen(false)}
        title="Dispute Credit Assessment"
        description="Submit documented evidence or context if you believe an external factor unjustly impacted your scoring."
      >
        <form onSubmit={handleDisputeSubmit} className="space-y-4">
          <div className="p-3 rounded-lg bg-surface dark:bg-subtle text-sm space-y-1">
            <span className="text-muted">
              {onchain ? 'On-chain attestation (assessment id):' : 'Assessment ID:'}
            </span>
            <div className="tabular-nums text-foreground dark:text-foreground break-all">
              {onchain ? onChainAssessmentId ?? 'No on-chain attestation to dispute' : currentAssessment?.id}
            </div>
            <div className="flex gap-4 pt-1 tabular-nums text-foreground dark:text-foreground">
              {onchain ? (
                <span>Attested Score: {chainBorrower.scoreBps > 0 ? (chainBorrower.scoreBps / 100).toFixed(2) : '—'}</span>
              ) : (
                <>
                  <span>Current Score: {currentAssessment?.score}</span>
                  <span>Tier: {currentAssessment?.risk_category}</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="dispute-reason" className="block text-sm font-medium text-foreground dark:text-foreground">
              Reason for Dispute / Clarification
              {onchain && <span className="font-normal text-muted"> (only its hash is written on-chain)</span>}
            </label>
            <textarea
              id="dispute-reason"
              required
              rows={4}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="e.g. University bursary deposit was recorded late by administrative office, which created a false dip in cash-flow stability. Bank reconciliation letter attached."
              className="w-full rounded-lg border border-line bg-surface p-3 text-sm text-foreground placeholder:text-muted focus:border-line focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-line dark:bg-surface dark:text-muted transition-colors"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDisputeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              isLoading={isRunning}
              disabled={onchain && (!chainStatus.canTransact || !onChainAssessmentId)}
            >
              {onchain ? 'Open Dispute On-chain' : 'Submit Formal Dispute'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
