import React, { useState } from 'react'
import {
  ShieldCheck,
  CreditCard,
  Calendar,
  ChevronRight,
  TrendingUp,
  ExternalLink,
  CheckCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card'
import { Button } from '../common/Button'
import { RiskBadge, Badge } from '../common/Badge'
import { Modal } from '../common/Modal'
import { Input } from '../common/Input'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../api/client'
import { formatUSD, formatDate, truncateAddress } from '../../utils/cn'
import type { CreditAssessment, LoanRequest } from '../../types'

interface BorrowerDashboardProps {
  onNavigate: (tab: string) => void
  currentAssessment: CreditAssessment | null
  loans: LoanRequest[]
  onRefresh: () => void
}

export const BorrowerDashboard: React.FC<BorrowerDashboardProps> = ({
  onNavigate,
  currentAssessment,
  loans,
  onRefresh,
}) => {
  const { profile, walletAddress, refreshProfile } = useAuth()
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return
    setIsSubmitting(true)
    try {
      await api.registerBorrower(displayName, bio)
      await refreshProfile()
      setIsRegisterModalOpen(false)
      setSuccessMsg('Borrower identity successfully attested on-chain.')
      setTimeout(() => setSuccessMsg(null), 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeLoan = loans.find((l) => l.status === 'active' || l.status === 'overdue')
  const borrowingLimit = currentAssessment ? Math.min(currentAssessment.score * 15, 2000) : 0

  return (
    <div className="space-y-6">
      {/* Welcome & Borrower Identity Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line dark:border-line">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground dark:text-foreground">
              {profile ? profile.display_name : 'Borrower Workspace'}
            </h2>
            {profile?.identity_status === 'registered' && (
              <Badge variant="success" size="sm">
                Verified Identity
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted dark:text-muted mt-1">
            {profile?.bio || 'Your borrower profile'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onNavigate('credit')}>
            Recalculate Score
          </Button>
          <Button size="sm" onClick={() => onNavigate('loans')}>
            Borrow from Pool
          </Button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300 text-sm font-medium">
          <CheckCircle className="w-4 h-4 text-foreground shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top Banner: Identity & Standing */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Identity Attestation Card */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted dark:text-muted">
                Identity Status
              </span>
              {profile?.identity_status === 'registered' ? (
                <Badge variant="success" size="sm">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Pending Verification
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg mt-1">
              {profile ? profile.display_name : 'Unregistered Identity'}
            </CardTitle>
            <CardDescription className="line-clamp-1">
              {profile?.bio || 'Your borrower profile'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {profile?.registration_transaction_hash ? (
              <div className="flex items-center justify-between text-sm tabular-nums text-muted dark:text-muted pt-2 border-t border-line dark:border-line">
                <span>Tx Hash</span>
                <span className="text-accent dark:text-accent flex items-center gap-1">
                  {truncateAddress(profile.registration_transaction_hash, 6)}
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            ) : (
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-sm"
                  onClick={() => setIsRegisterModalOpen(true)}
                >
                  Create profile
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credit Assessment Standing */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted dark:text-muted">
                Credit Standing
              </span>
              {currentAssessment ? (
                <RiskBadge category={currentAssessment.risk_category} size="sm" />
              ) : (
                <Badge variant="outline" size="sm">
                  Unassessed
                </Badge>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold tracking-tight text-foreground dark:text-foreground tabular-nums">
                {currentAssessment ? currentAssessment.score.toFixed(1) : '—'}
              </span>
              <span className="text-sm text-muted dark:text-muted">/ 100 max</span>
            </div>
            <CardDescription>
              {currentAssessment
                ? `Valid until ${formatDate(currentAssessment.expires_at)}`
                : 'Submit financial evidence to calculate score'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-center justify-between pt-2 border-t border-line dark:border-line">
              <span className="text-sm text-muted">Max Limit</span>
              <span className="text-sm font-semibold text-foreground dark:text-foreground tabular-nums">
                {formatUSD(borrowingLimit)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Available Liquidity & Quick Action */}
        <Card className="bg-gradient-to-br from-blue-50/50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20 border-line dark:border-line">
          <CardHeader className="pb-2">
            <span className="text-sm font-medium text-accent dark:text-accent flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Borrowing Capacity
            </span>
            <div className="text-2xl font-semibold tracking-tight text-foreground dark:text-foreground tabular-nums mt-1">
              {formatUSD(borrowingLimit)}
            </div>
            <CardDescription>
              Fixed 12% APR • 30 to 365 Days • Zero Early Repayment Penalty
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              size="sm"
              className="w-full text-sm"
              onClick={() => onNavigate('loans')}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Get Instant Quote
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Active Loan & Repayment Pipeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-accent dark:text-accent" />
                Active Loan & Installment Schedule
              </CardTitle>
              <CardDescription>
                Live repayment tracking linked to lending pool smart contract
              </CardDescription>
            </div>
            {activeLoan && (
              <Badge variant={activeLoan.status === 'overdue' ? 'destructive' : 'indigo'}>
                {activeLoan.status === 'overdue' ? 'Payment Overdue' : 'Active Facility'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {activeLoan ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-surface dark:bg-subtle border border-line dark:border-line">
                <div>
                  <span className="text-sm text-muted dark:text-muted">Principal</span>
                  <div className="text-base font-semibold tabular-nums text-foreground dark:text-foreground">
                    {formatUSD(activeLoan.amount)}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted dark:text-muted">Total Due</span>
                  <div className="text-base font-semibold tabular-nums text-foreground dark:text-foreground">
                    {formatUSD(activeLoan.total_repayment)}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted dark:text-muted">Interest</span>
                  <div className="text-base font-semibold tabular-nums text-foreground">
                    {formatUSD(activeLoan.interest_amount)} (12% APR)
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted dark:text-muted">Duration</span>
                  <div className="text-base font-semibold tabular-nums text-foreground dark:text-foreground">
                    {activeLoan.duration_days} Days
                  </div>
                </div>
              </div>

              {/* Installments Table */}
              <div>
                <h4 className="text-sm font-semibold text-foreground dark:text-foreground uppercase tracking-wider mb-2">
                  Amortized Repayment Schedule
                </h4>
                <div className="overflow-x-auto rounded-lg border border-line dark:border-line">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface dark:bg-subtle text-muted dark:text-muted border-b border-line dark:border-line">
                      <tr>
                        <th className="p-3 font-medium">#</th>
                        <th className="p-3 font-medium">Due Date</th>
                        <th className="p-3 font-medium">Amount Due</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 tabular-nums">
                      {activeLoan.installments.map((inst) => (
                        <tr
                          key={inst.installment_number}
                          className="hover:bg-surface dark:hover:bg-subtle"
                        >
                          <td className="p-3 font-medium text-foreground dark:text-foreground">
                            Installment #{inst.installment_number}
                          </td>
                          <td className="p-3 text-muted dark:text-muted">
                            {formatDate(inst.due_date)}
                          </td>
                          <td className="p-3 font-semibold text-foreground dark:text-foreground">
                            {formatUSD(inst.amount)}
                          </td>
                          <td className="p-3">
                            {inst.status === 'paid' ? (
                              <Badge variant="success" size="sm">
                                Paid
                              </Badge>
                            ) : inst.status === 'overdue' ? (
                              <Badge variant="destructive" size="sm">
                                Overdue
                              </Badge>
                            ) : (
                              <Badge variant="default" size="sm">
                                Scheduled
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {inst.status !== 'paid' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-sm"
                                onClick={() => {
                                  inst.status = 'paid'
                                  setSuccessMsg(
                                    `Installment #${inst.installment_number} of ${formatUSD(inst.amount)} simulated as paid.`
                                  )
                                  onRefresh()
                                }}
                              >
                                Pay Installment
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface dark:bg-subtle text-muted mx-auto flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground dark:text-foreground">
                  No Active Borrowing Facility
                </h4>
                <p className="text-sm text-muted dark:text-muted max-w-sm mx-auto mt-1">
                  You have no outstanding loans. Calculate your credit assessment or apply for a
                  micro-loan against the liquidity pool.
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-2">
                <Button size="sm" variant="outline" onClick={() => onNavigate('credit')}>
                  View Credit Studio
                </Button>
                <Button size="sm" onClick={() => onNavigate('loans')}>
                  Apply For Loan
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register your profile"
        description="Create a profile and register its identifier from your connected wallet."
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <Input
            label="Display Name / Legal Name"
            placeholder="e.g. Alex Thorne"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground dark:text-foreground">
              About you (optional)
            </label>
            <textarea
              className="w-full rounded-lg border border-line bg-surface p-3 text-sm text-foreground placeholder:text-muted focus:border-line focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-line dark:bg-surface dark:text-muted transition-colors"
              rows={3}
              placeholder="e.g. Postgraduate Researcher at RVU in Computer Science. Recipient of STEM Grant."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <div className="p-3 rounded-lg bg-surface dark:bg-subtle border border-line dark:border-line text-sm text-muted tabular-nums">
            Wallet: {truncateAddress(walletAddress, 8)}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsRegisterModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Submit Attestation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
