import React, { useState, useEffect } from 'react'
import {
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart as PieIcon,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Droplets,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'
import { Modal } from '../common/Modal'
import { Input } from '../common/Input'
import { OnChainNotice } from '../web3/WalletControl'
import { api } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { formatUSD } from '../../utils/cn'
import { steps } from '../../web3/actions'
import { networkLabel } from '../../web3/config'
import { useOnChainStatus, usePoolChainData } from '../../web3/hooks'
import { formatUsdcExact, fromUsdcUnits, toUsdcUnits } from '../../web3/units'
import { useContractTransaction } from '../../web3/useContractTransaction'
import type { LenderPosition, PoolStatistics } from '../../types'

export const LendingPool: React.FC = () => {
  const { networkMode } = useAuth()
  const onchain = networkMode === 'onchain'
  const chain = usePoolChainData()
  const chainStatus = useOnChainStatus()
  const { run, isRunning } = useContractTransaction()
  const [stats, setStats] = useState<PoolStatistics | null>(null)
  const [position, setPosition] = useState<LenderPosition | null>(null)
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  const reloadData = async () => {
    try {
      const s = await api.getPoolStatistics()
      const p = await api.getLenderPosition()
      setStats(s)
      setPosition(p)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    reloadData()
  }, [])

  // In on-chain mode every figure on this page comes from the LendingPool contract.
  const displayStats: PoolStatistics | null = onchain
    ? chain.loaded
      ? {
          total_pool_liquidity: fromUsdcUnits(chain.idle),
          total_deposited: fromUsdcUnits(chain.assets),
          total_active_loans: Number(chain.loansOriginated),
          total_outstanding_principal: fromUsdcUnits(chain.borrowed),
          utilization_rate: Number(chain.utilizationBps) / 100,
        }
      : null
    : stats
  const displayPosition: LenderPosition | null = onchain
    ? chain.loaded
      ? {
          deposited_amount: 0,
          withdrawn_amount: 0,
          pool_share: chain.totalShares > 0n ? Number((chain.shares * 10_000n) / chain.totalShares) / 100 : 0,
          current_value: fromUsdcUnits(chain.positionValue),
        }
      : null
    : position
  const actionBusy = isActionLoading || isRunning
  const actionsDisabled = onchain && !chainStatus.canTransact

  const showMessage = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text })
    if (type === 'success') setTimeout(() => setStatusMessage(null), 6000)
  }

  const runOnChain = async (kind: 'deposit' | 'withdraw') => {
    const units = toUsdcUnits(amountInput)
    if (units === null || !chainStatus.address) {
      showMessage('error', 'Enter a positive amount with at most 6 decimals.')
      return
    }
    const result =
      kind === 'deposit'
        ? await run('Deposit to LendingPool', steps.deposit(chainStatus.address, units))
        : await run('Withdraw from LendingPool', steps.withdraw(chainStatus.address, units))
    if (result) {
      setIsDepositOpen(false)
      setIsWithdrawOpen(false)
      setAmountInput('')
      showMessage(
        'success',
        `${kind === 'deposit' ? 'Deposit' : 'Withdrawal'} of ${formatUsdcExact(units)} confirmed on ${networkLabel}.`
      )
    }
  }

  const handleFaucet = async () => {
    const result = await run('Claim test mUSDC', steps.claimFaucet())
    if (result) {
      showMessage('success', `1,000 valueless test mUSDC minted to your wallet on ${networkLabel}.`)
    }
  }

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (onchain) {
      await runOnChain('deposit')
      return
    }
    const amt = parseFloat(amountInput)
    if (isNaN(amt) || amt <= 0) return

    setIsActionLoading(true)
    try {
      await api.depositToPool(amt)
      await reloadData()
      setIsDepositOpen(false)
      setAmountInput('')
      showMessage(
        'success',
        `Simulated deposit of ${formatUSD(amt)} recorded in Demo Mode. No blockchain transaction was sent.`
      )
    } catch (err: unknown) {
      showMessage('error', (err as Error).message)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (onchain) {
      await runOnChain('withdraw')
      return
    }
    const amt = parseFloat(amountInput)
    if (isNaN(amt) || amt <= 0) return

    setIsActionLoading(true)
    try {
      await api.withdrawFromPool(amt)
      await reloadData()
      setIsWithdrawOpen(false)
      setAmountInput('')
      showMessage(
        'success',
        `Simulated withdrawal of ${formatUSD(amt)} recorded in Demo Mode. No blockchain transaction was sent.`
      )
    } catch (err: unknown) {
      showMessage('error', (err as Error).message)
    } finally {
      setIsActionLoading(false)
    }
  }

  const netApy = displayStats ? (12.0 * (displayStats.utilization_rate / 100)).toFixed(2) : '—'

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {statusMessage && (
        <div
          role={statusMessage.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Lending Pool & Liquidity Desk
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Decentralized capital pool supplying micro-loans to credit-verified borrowers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onchain && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleFaucet}
              disabled={actionsDisabled || actionBusy}
              leftIcon={<Droplets className="w-3.5 h-3.5" />}
              title="Mint 1,000 valueless test mUSDC (once per 24 hours)"
            >
              Get test mUSDC
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={actionsDisabled}
            onClick={() => {
              setAmountInput('')
              setIsWithdrawOpen(true)
            }}
            leftIcon={<ArrowDownLeft className="w-3.5 h-3.5" />}
          >
            Withdraw
          </Button>
          <Button
            size="sm"
            disabled={actionsDisabled}
            onClick={() => {
              setAmountInput('')
              setIsDepositOpen(true)
            }}
            leftIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
          >
            Deposit Liquidity
          </Button>
        </div>
      </div>

      <OnChainNotice action="supply or withdraw liquidity" />

      {/* Pool Statistics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Liquidity (TVL)
            </span>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
              {displayStats ? formatUSD(displayStats.total_deposited) : '—'}
            </div>
            <CardDescription>
              {onchain ? 'Idle cash plus outstanding principal' : 'Aggregate capital deposited'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Available Cash
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {displayStats ? formatUSD(displayStats.total_pool_liquidity) : '—'}
            </div>
            <CardDescription>Instant disbursement headroom</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Pool Utilization
            </span>
            <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              {displayStats ? `${displayStats.utilization_rate.toFixed(1)}%` : '—'}
            </div>
            <CardDescription>
              {displayStats?.total_active_loans || 0}{' '}
              {displayStats?.total_active_loans === 1 ? 'loan' : 'loans'}{' '}
              {onchain ? 'originated on-chain' : 'active and funded'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Current Lending APY
            </span>
            <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
              {netApy}%
            </div>
            <CardDescription>Variable yield on supplied capital</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Lender Position & Pool Allocation Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Your Position */}
        <div className="lg:col-span-6 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Your Lender Position
                </CardTitle>
                <Badge variant={onchain ? 'indigo' : 'warning'} size="sm">
                  {onchain ? `On-chain · ${networkLabel}` : 'Demo position'}
                </Badge>
              </div>
              <CardDescription>
                {onchain
                  ? 'Read from your LendingPool shares; value includes repaid interest'
                  : 'Simulated position balance and accumulated lending interest'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Current Position Value</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {displayPosition ? formatUSD(displayPosition.current_value) : '$0.00'}
                  </span>
                </div>
                {onchain && chain.loaded ? (
                  <>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700/60">
                      <span className="text-slate-500">Pool Shares (cpUSDC)</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {fromUsdcUnits(chain.shares).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Withdrawable Now</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatUSD(fromUsdcUnits(chain.maxWithdraw))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Wallet mUSDC</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {formatUSD(fromUsdcUnits(chain.walletBalance))}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700/60">
                      <span className="text-slate-500">Principal Deposited</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {displayPosition ? formatUSD(displayPosition.deposited_amount) : '$0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Total Yield Earned</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {displayPosition
                          ? formatUSD(Math.max(0, displayPosition.current_value - displayPosition.deposited_amount))
                          : '$0.00'}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Pool Share</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {displayPosition?.pool_share.toFixed(2) || '0.00'}%
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={actionsDisabled}
                  onClick={() => setIsWithdrawOpen(true)}
                >
                  Redeem Capital
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={actionsDisabled}
                  onClick={() => setIsDepositOpen(true)}
                >
                  Supply More USDC
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pool Liquidity Utilization Progress */}
        <div className="lg:col-span-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Capital Utilization & Solvency
              </CardTitle>
              <CardDescription>
                Visual distribution between available liquidity reserves and active borrower loans
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-slate-500">Reserve Utilization</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {displayStats?.utilization_rate.toFixed(1) ?? '0.0'}% Active
                  </span>
                </div>
                {/* Dual Color Progress Bar */}
                <div className="h-4 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                  <div
                    style={{ width: `${displayStats?.utilization_rate ?? 0}%` }}
                    className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-500"
                    title="Active Loans"
                  />
                  <div
                    style={{ width: `${100 - (displayStats?.utilization_rate ?? 0)}%` }}
                    className="bg-emerald-500 dark:bg-emerald-600 h-full transition-all duration-500"
                    title="Available Liquidity"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-2 font-mono">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    Loaned: {displayStats ? formatUSD(displayStats.total_outstanding_principal) : '—'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Available: {displayStats ? formatUSD(displayStats.total_pool_liquidity) : '—'}
                  </span>
                </div>
              </div>

              {onchain && chain.loaded && (
                <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="block text-slate-500">Interest earned</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {formatUsdcExact(chain.interestEarned)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="block text-slate-500">Losses written off</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      {formatUsdcExact(chain.losses)}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                  Protocol Risk Parameter
                </div>
                <p>
                  Loans require a registered identity and an attested, unexpired credit score. Overdue
                  loans become eligible for officer-approved restructuring; written-off principal lowers
                  the share price for all lenders.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deposit Modal */}
      <Modal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        title="Deposit USDC to Lending Pool"
        description="Supply liquidity to the Credora micro-lending pool to earn algorithmic lending yield."
      >
        <form onSubmit={handleDeposit} className="space-y-4">
          <Input
            label="Deposit Amount (MockUSDC)"
            type="number"
            min="0.000001"
            step="any"
            placeholder="e.g. 500.00"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            required
          />

          <div className="flex gap-2 text-xs">
            {['100', '250', '500', '1000'].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmountInput(val)}
                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono transition-colors"
              >
                +${val}
              </button>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-mono space-y-1 text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Estimated Annual Yield:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">~{netApy}%</span>
            </div>
            {onchain && chain.loaded && (
              <div className="flex justify-between">
                <span>Wallet balance:</span>
                <span>{formatUsdcExact(chain.walletBalance)}</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            {onchain
              ? 'Your wallet asks you to approve this exact amount (only if needed) and then to confirm the deposit. Nothing is final until it is confirmed on-chain.'
              : 'Demo Mode: the deposit is simulated in this browser. No wallet or blockchain is used.'}
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDepositOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={actionBusy}>
              Confirm Deposit
            </Button>
          </div>
        </form>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        title="Redeem Capital from Pool"
        description="Withdraw your deposited liquidity and accumulated interest back to your wallet."
      >
        <form onSubmit={handleWithdraw} className="space-y-4">
          <Input
            label="Withdrawal Amount (MockUSDC)"
            type="number"
            min="0.000001"
            max={onchain && chain.loaded ? fromUsdcUnits(chain.maxWithdraw) : position?.current_value || 0}
            step="any"
            placeholder="e.g. 250.00"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            required
          />

          <div className="flex justify-between text-xs font-mono text-slate-500">
            <span>{onchain ? 'Withdrawable now (capped by idle liquidity):' : 'Available in Position:'}</span>
            <span>
              {onchain && chain.loaded ? formatUsdcExact(chain.maxWithdraw) : formatUSD(position?.current_value)}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsWithdrawOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="destructive" isLoading={actionBusy}>
              Confirm Withdrawal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
