import React, { useState } from 'react'
import {
  ShieldCheck,
  CreditCard,
  Calendar,
  Sliders,
  Coins,
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
import { CreditStudio } from './CreditStudio'
import { LoanMarketplace } from './LoanMarketplace'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../api/client'
import { formatUSD, formatDate, truncateAddress } from '../../utils/cn'
import type { CreditAssessment, LoanRequest } from '../../types'

interface BorrowerPortalProps {
  currentAssessment: CreditAssessment | null
  loans: LoanRequest[]
  onRefresh: () => void
  onAssessmentUpdated: (newAssessment: CreditAssessment) => void
  onLoanCreated: (newLoan: LoanRequest) => void
  initialSubTab?: 'overview' | 'credit' | 'borrow'
}

export const BorrowerPortal: React.FC<BorrowerPortalProps> = ({
  currentAssessment,
  loans,
  onRefresh,
  onAssessmentUpdated,
  onLoanCreated,
  initialSubTab = 'overview',
}) => {
  const { profile, walletAddress, refreshProfile } = useAuth()
  const [subTab, setSubTab] = useState<'overview' | 'credit' | 'borrow'>(initialSubTab)
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
      setSuccessMsg('Academic identity successfully registered on-chain.')
      setTimeout(() => setSuccessMsg(null), 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeLoan = loans.find((l) => l.status === 'active' || l.status === 'overdue')
  const borrowingLimit = currentAssessment ? Math.min(currentAssessment.score * 15, 2000) : 0

  return (
    <div className="space-y-6">
      {/* Borrower Header & Workflow Sub-Navigation */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Borrower Workspace
              </h2>
              {profile?.identity_status === 'registered' ? (
                <Badge variant="success" size="sm">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Verified Identity
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Unregistered
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              End-to-end borrowing lifecycle: establish credit, disburse loans, and service installments.
            </p>
          </div>

          {/* Workflow Step Pill */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-xs">
            <button
              onClick={() => setSubTab('overview')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                subTab === 'overview'
                  ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-400 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              1. My Facilities
            </button>
            <button
              onClick={() => setSubTab('credit')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                subTab === 'credit'
                  ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-400 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              2. Credit Studio
            </button>
            <button
              onClick={() => setSubTab('borrow')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                subTab === 'borrow'
                  ? 'bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-400 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              3. Request Loan
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300 text-xs font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab 1: Overview & Active Facility */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* Top 3 Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Identity Card */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    On-Chain Identity
                  </span>
                  {profile?.identity_status === 'registered' ? (
                    <Badge variant="success" size="sm">
                      Attested
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      Pending
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg mt-1">
                  {profile ? profile.display_name : 'Guest Borrower'}
                </CardTitle>
                <CardDescription className="line-clamp-1">
                  {profile?.bio || 'IdentityRegistry on Sepolia'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {profile?.registration_transaction_hash ? (
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>Tx Hash</span>
                    <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      {truncateAddress(profile.registration_transaction_hash, 6)}
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                ) : (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => setIsRegisterModalOpen(true)}
                    >
                      Attest Identity
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Credit Standing Card */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
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
                  <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                    {currentAssessment ? currentAssessment.score.toFixed(1) : '—'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">/ 100 max</span>
                </div>
                <CardDescription>
                  {currentAssessment
                    ? `Expires ${formatDate(currentAssessment.expires_at)}`
                    : 'Submit evidence to calculate score'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Borrowing Capacity</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {formatUSD(borrowingLimit)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Borrow Capacity CTA Card */}
            <Card className="bg-gradient-to-br from-blue-50/50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20 border-blue-100 dark:border-blue-900/40">
              <CardHeader className="pb-2">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Available to Borrow
                </span>
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono mt-1">
                  {formatUSD(borrowingLimit)}
                </div>
                <CardDescription>
                  12.0% Fixed APR • Instant Pool Disbursement
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Button
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setSubTab('borrow')}
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Request Micro-Loan
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Active Facility & Installment Pipeline */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Active Loan Facility & Repayment Schedule
                  </CardTitle>
                  <CardDescription>
                    Live repayment tracking linked to lending pool contract
                  </CardDescription>
                </div>
                {activeLoan && (
                  <Badge variant={activeLoan.status === 'overdue' ? 'destructive' : 'indigo'}>
                    {activeLoan.status === 'overdue' ? 'Overdue' : 'Active Facility'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {activeLoan ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Principal</span>
                      <div className="text-base font-semibold font-mono text-slate-900 dark:text-slate-100">
                        {formatUSD(activeLoan.amount)}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Total Due</span>
                      <div className="text-base font-semibold font-mono text-slate-900 dark:text-slate-100">
                        {formatUSD(activeLoan.total_repayment)}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Interest</span>
                      <div className="text-base font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatUSD(activeLoan.interest_amount)} (12% APR)
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Duration</span>
                      <div className="text-base font-semibold font-mono text-slate-900 dark:text-slate-100">
                        {activeLoan.duration_days} Days
                      </div>
                    </div>
                  </div>

                  {/* Installments Table */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Amortized Repayment Schedule
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-3 font-medium">Installment</th>
                            <th className="p-3 font-medium">Due Date</th>
                            <th className="p-3 font-medium">Amount Due</th>
                            <th className="p-3 font-medium">Status</th>
                            <th className="p-3 font-medium text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                          {activeLoan.installments.map((inst) => (
                            <tr
                              key={inst.installment_number}
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                            >
                              <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                                Payment #{inst.installment_number}
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-400">
                                {formatDate(inst.due_date)}
                              </td>
                              <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
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
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      inst.status = 'paid'
                                      setSuccessMsg(
                                        `Installment #${inst.installment_number} of ${formatUSD(inst.amount)} successfully paid.`
                                      )
                                      onRefresh()
                                    }}
                                  >
                                    Pay Now
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
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      No Active Borrowing Facility
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                      You currently have zero outstanding loan obligations. Check your credit score
                      or apply for a micro-loan.
                    </p>
                  </div>
                  <div className="pt-2 flex justify-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSubTab('credit')}>
                      Calculate Credit Score
                    </Button>
                    <Button size="sm" onClick={() => setSubTab('borrow')}>
                      Request Micro-Loan
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Credit Studio */}
      {subTab === 'credit' && (
        <CreditStudio
          currentAssessment={currentAssessment}
          onAssessmentUpdated={(newAssessment) => {
            onAssessmentUpdated(newAssessment)
            setSubTab('borrow')
          }}
        />
      )}

      {/* Tab 3: Request Loan */}
      {subTab === 'borrow' && (
        <LoanMarketplace
          currentAssessment={currentAssessment}
          onLoanCreated={(newLoan) => {
            onLoanCreated(newLoan)
            setSubTab('overview')
          }}
          onNavigate={(tab) => {
            if (tab === 'credit') setSubTab('credit')
            else if (tab === 'borrower') setSubTab('overview')
          }}
        />
      )}

      {/* Registration Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Attest Academic Identity"
        description="Register your display name and academic context on-chain to bind your wallet to the IdentityRegistry."
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
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Academic Background / Affiliation
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 transition-colors"
              rows={3}
              placeholder="e.g. Postgraduate Researcher at RVU in Computer Science. Recipient of STEM Grant."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 font-mono">
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
