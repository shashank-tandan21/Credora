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
  AlertCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card'
import { Button } from '../common/Button'
import { RiskBadge, Badge } from '../common/Badge'
import { Modal } from '../common/Modal'
import { Input } from '../common/Input'
import { CreditStudio } from './CreditStudio'
import { LoanMarketplace } from './LoanMarketplace'
import { OnChainLoanCard } from '../web3/OnChainLoanCard'
import { OnChainNotice } from '../web3/WalletControl'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../api/client'
import { formatUSD, formatDate, truncateAddress } from '../../utils/cn'
import { steps } from '../../web3/actions'
import { explorerTxUrl, networkLabel } from '../../web3/config'
import { useBorrowerChainState, useOnChainStatus } from '../../web3/hooks'
import { fromUsdcUnits, hashText } from '../../web3/units'
import { useContractTransaction } from '../../web3/useContractTransaction'
import type { CreditAssessment, LoanRequest } from '../../types'

interface BorrowerPortalProps {
  currentAssessment: CreditAssessment | null
  loans: LoanRequest[]
  onRefresh: () => void
  onAssessmentUpdated: (newAssessment: CreditAssessment) => void
  onLoanCreated: (newLoan: LoanRequest) => void
  initialSubTab?: 'overview' | 'credit' | 'borrow'
}

const identityTxKey = (wallet: string) => `credora-identity-tx:${wallet.toLowerCase()}`

export const BorrowerPortal: React.FC<BorrowerPortalProps> = ({
  currentAssessment,
  loans,
  onRefresh,
  onAssessmentUpdated,
  onLoanCreated,
  initialSubTab = 'overview',
}) => {
  const { profile, walletAddress, refreshProfile, networkMode } = useAuth()
  const onchain = networkMode === 'onchain'
  const chainStatus = useOnChainStatus()
  const chainBorrower = useBorrowerChainState()
  const { run, isRunning } = useContractTransaction()
  const [subTab, setSubTab] = useState<'overview' | 'credit' | 'borrow'>(initialSubTab)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null)

  const flashSuccess = (text: string) => {
    setNoticeMsg(null)
    setSuccessMsg(text)
    setTimeout(() => setSuccessMsg(null), 7000)
  }

  const storedIdentityTx = chainStatus.address ? localStorage.getItem(identityTxKey(chainStatus.address)) : null

  /** Ask the backend to verify the IdentityRegistry receipt; chain state is already final. */
  const linkIdentityWithBackend = async (transactionHash: string) => {
    try {
      await api.syncIdentity(transactionHash)
      await refreshProfile()
      flashSuccess('Identity registered on-chain and verified by the backend from its receipt.')
    } catch (err: unknown) {
      setNoticeMsg(
        `Identity is registered on-chain (tx ${truncateAddress(transactionHash, 6)}), but backend verification failed: ${
          (err as Error).message === 'BACKEND_OFFLINE' ? 'the backend is offline' : (err as Error).message
        }. Use "Verify with backend" to retry.`
      )
    }
  }

  const registerOnChain = async () => {
    if (!chainStatus.canTransact || !chainStatus.address) return
    const current = profile ?? (await api.registerBorrower(displayName.trim(), bio.trim() || undefined))
    if (chainBorrower.registered) {
      if (storedIdentityTx) await linkIdentityWithBackend(storedIdentityTx)
      return
    }
    const result = await run('Register identity on-chain', steps.registerIdentity(hashText(current.id)))
    if (!result) return
    const transactionHash = result[result.length - 1].hash
    localStorage.setItem(identityTxKey(chainStatus.address), transactionHash)
    await linkIdentityWithBackend(transactionHash)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile && !displayName.trim()) return
    setIsSubmitting(true)
    try {
      if (onchain) {
        await registerOnChain()
      } else {
        await api.registerBorrower(displayName, bio)
        await refreshProfile()
        flashSuccess(
          'Profile saved in Demo Mode. It stays "pending" because nothing is registered on-chain until you use on-chain mode.'
        )
      }
      setIsRegisterModalOpen(false)
    } catch (err: unknown) {
      setNoticeMsg((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeLoan = loans.find((l) => l.status === 'active' || l.status === 'overdue')
  const borrowingLimit = onchain
    ? chainBorrower.scoreValid
      ? fromUsdcUnits(chainBorrower.eligibleLimit)
      : 0
    : currentAssessment
      ? Math.min(currentAssessment.score * 15, 2000)
      : 0
  const backendVerified = profile?.identity_status === 'registered'
  const identityExplorer = explorerTxUrl(profile?.registration_transaction_hash ?? undefined)

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
              {onchain && chainBorrower.registered ? (
                <Badge variant="success" size="sm">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Registered on {networkLabel}
                </Badge>
              ) : !onchain && profile ? (
                <Badge variant="warning" size="sm">
                  Demo profile (not on-chain)
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
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
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
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
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
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
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
        <div role="status" className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300 text-xs font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {noticeMsg && (
        <div role="alert" className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{noticeMsg}</span>
        </div>
      )}

      {/* Tab 1: Overview & Active Facility */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {onchain && <OnChainNotice action="register your identity and manage loans" />}

          {/* Top 3 Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Identity Card */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    On-Chain Identity
                  </span>
                  {onchain && chainBorrower.registered ? (
                    <Badge variant="success" size="sm">
                      Registered
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      {onchain ? 'Not registered' : 'Demo only'}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg mt-1">
                  {profile ? profile.display_name : 'Guest Borrower'}
                </CardTitle>
                <CardDescription className="line-clamp-1">
                  {profile?.bio || `IdentityRegistry on ${networkLabel}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {onchain && chainBorrower.registered ? (
                  backendVerified && profile?.registration_transaction_hash ? (
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Backend-verified tx</span>
                      {identityExplorer ? (
                        <a
                          href={identityExplorer}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 flex items-center gap-1"
                        >
                          {truncateAddress(profile.registration_transaction_hash, 6)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400" title={profile.registration_transaction_hash}>
                          {truncateAddress(profile.registration_transaction_hash, 6)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2 space-y-2">
                      <p className="text-[11px] text-slate-500">
                        Registered on-chain; the backend has not verified the receipt yet.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        disabled={!storedIdentityTx || isSubmitting}
                        title={storedIdentityTx ? undefined : 'No registration transaction from this browser to verify'}
                        onClick={async () => {
                          if (!storedIdentityTx) return
                          setIsSubmitting(true)
                          await linkIdentityWithBackend(storedIdentityTx)
                          setIsSubmitting(false)
                        }}
                      >
                        Verify with backend
                      </Button>
                    </div>
                  )
                ) : !onchain && profile ? (
                  <p className="pt-2 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800">
                    Demo profile saved. Switch to on-chain mode to register it in the IdentityRegistry.
                  </p>
                ) : (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      disabled={onchain && !chainStatus.canTransact}
                      onClick={() => setIsRegisterModalOpen(true)}
                    >
                      {onchain ? 'Attest Identity On-chain' : 'Create Demo Profile'}
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
                  {onchain
                    ? chainBorrower.scoreValid
                      ? `On-chain attested score ${(chainBorrower.scoreBps / 100).toFixed(2)}`
                      : 'No valid on-chain attestation yet'
                    : currentAssessment
                      ? `Expires ${formatDate(currentAssessment.expires_at)}`
                      : 'Submit evidence to calculate score'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500">
                    {onchain ? 'On-chain Borrowing Capacity' : 'Borrowing Capacity'}
                  </span>
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
                  12.0% Fixed APR • {onchain ? 'Disbursed by the LendingPool' : 'Simulated disbursement'}
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
          {onchain ? (
            <OnChainLoanCard onRequestLoan={() => setSubTab('borrow')} />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Active Loan Facility & Repayment Schedule
                    </CardTitle>
                    <CardDescription>
                      Demo Mode facility. Switch to on-chain mode for LoanManager repayments.
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
                                      Paid (demo)
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
                                        flashSuccess(
                                          `Demo payment simulated for installment #${inst.installment_number} (${formatUSD(inst.amount)}). No blockchain transaction was sent.`
                                        )
                                        onRefresh()
                                      }}
                                    >
                                      Simulate Payment
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
          )}
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
          onProceedToBorrow={() => setSubTab('borrow')}
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
        title={onchain ? 'Attest Academic Identity On-chain' : 'Create Demo Borrower Profile'}
        description={
          onchain
            ? 'Saves your profile with the backend, then registers a hash of it in the IdentityRegistry from your wallet. The backend marks it registered only after verifying the receipt.'
            : 'Demo Mode stores the profile only. No wallet or blockchain transaction is used.'
        }
      >
        <form onSubmit={handleRegister} className="space-y-4">
          {profile ? (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
              Profile <span className="font-semibold">{profile.display_name}</span> already exists; only the
              on-chain registration remains.
            </div>
          ) : (
            <>
              <Input
                label="Display Name / Legal Name"
                placeholder="e.g. Alex Thorne"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
              <div className="space-y-1.5">
                <label htmlFor="borrower-bio" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Academic Background / Affiliation
                </label>
                <textarea
                  id="borrower-bio"
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 transition-colors"
                  rows={3}
                  placeholder="e.g. Postgraduate Researcher at RVU in Computer Science. Recipient of STEM Grant."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 font-mono">
            Wallet: {truncateAddress(walletAddress, 8)}
            {onchain && <span className="block mt-1 font-sans">Only keccak256(profile id) is written on-chain.</span>}
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
            <Button
              type="submit"
              size="sm"
              isLoading={isSubmitting || isRunning}
              disabled={onchain && !chainStatus.canTransact}
            >
              {onchain ? 'Register On-chain' : 'Save Demo Profile'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
