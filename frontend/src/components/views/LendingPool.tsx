import React, { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2, Droplets, RefreshCw, Landmark, PieChart as PieIcon, TrendingUp, ShieldCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  const [stats, setStats] = useState<PoolStatistics | null>(null)
  const [position, setPosition] = useState<LenderPosition | null>(null)
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  const reloadData = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [s, p] = await Promise.all([api.getPoolStatistics(), api.getLenderPosition()])
      setStats(s)
      setPosition(p)
    } catch {
      setLoadError('We could not load your pool data. Try again in a moment.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!onchain) reloadData()
  }, [onchain])

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
    ? chain.loaded && chain.positionLoaded && chainStatus.isConnected && !chainStatus.wrongChain
      ? {
          deposited_amount: 0,
          withdrawn_amount: 0,
          pool_share: chain.totalShares > 0n ? Number((chain.shares * 10_000n) / chain.totalShares) / 100 : 0,
          current_value: fromUsdcUnits(chain.positionValue),
        }
      : null
    : position
  const actionBusy = isActionLoading || isRunning
  const actionsDisabled = actionBusy || (onchain ? !chainStatus.canTransact || !chain.loaded : isLoading || !!loadError)

  const showMessage = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text })
    if (type === 'success') setTimeout(() => setStatusMessage(null), 6000)
  }

  const runOnChain = async (kind: 'deposit' | 'withdraw') => {
    const units = toUsdcUnits(amountInput)
    if (units === null || units <= 0n || !chainStatus.address) {
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
          className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-foreground shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line dark:border-line">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground dark:text-foreground flex items-center gap-2">
            <Landmark className="w-5 h-5 text-accent dark:text-accent" />
            Lending pool
          </h2>
          <p className="text-sm text-muted dark:text-muted mt-0.5">
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

        </div>
      </div>

      <OnChainNotice action="supply or withdraw liquidity" />
      {(onchain ? chain.isLoading : isLoading) && <p role="status" className="text-sm text-muted">Loading pool data…</p>}
      {(onchain ? chain.error : loadError) && <div role="alert" className="inline-notice"><p>Pool data is unavailable. Please try again.</p><Button variant="outline" leftIcon={<RefreshCw size={16} />} onClick={() => { if (onchain) void queryClient.invalidateQueries(); else void reloadData() }}>Retry</Button></div>}

      {/* Pool Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium text-muted dark:text-muted">
              Total Liquidity (TVL)
            </span>
            <div className="text-2xl font-semibold tabular-nums text-foreground dark:text-foreground mt-1">
              {displayStats ? formatUSD(displayStats.total_deposited) : '—'}
            </div>
            <CardDescription>
              {onchain ? 'Idle cash plus outstanding principal' : 'Aggregate capital deposited'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium text-muted dark:text-muted">
              Available Cash
            </span>
            <div className="text-2xl font-semibold tabular-nums text-foreground mt-1">
              {displayStats ? formatUSD(displayStats.total_pool_liquidity) : '—'}
            </div>
            <CardDescription>Instant disbursement headroom</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium text-muted dark:text-muted">
              Pool Utilization
            </span>
            <div className="text-2xl font-semibold tabular-nums text-accent dark:text-accent mt-1">
              {displayStats ? `${displayStats.utilization_rate.toFixed(1)}%` : '—'}
            </div>
            <CardDescription>
              {displayStats?.total_active_loans ?? '—'}{' '}
              {displayStats?.total_active_loans === 1 ? 'loan' : 'loans'}{' '}
              {onchain ? 'originated on-chain' : 'active and funded'}
            </CardDescription>
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
                  <PieIcon className="w-4 h-4 text-accent dark:text-accent" />
                  Your position
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
              {onchain && !displayPosition && <p className="text-sm text-muted">Connect your wallet on the configured network to view your position.</p>}
              <div className="p-4 rounded-xl bg-surface dark:bg-subtle border border-line dark:border-line space-y-3 tabular-nums text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Current Position Value</span>
                  <span className="text-lg font-semibold text-foreground dark:text-foreground">
                    {displayPosition ? formatUSD(displayPosition.current_value) : '—'}
                  </span>
                </div>
                {onchain && chain.loaded && chain.positionLoaded && chainStatus.canTransact ? (
                  <>
                    <div className="flex justify-between items-center pt-2 border-t border-line dark:border-line">
                      <span className="text-muted">Pool Shares (cpUSDC)</span>
                      <span className="text-foreground dark:text-foreground">
                        {fromUsdcUnits(chain.shares).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted">Withdrawable Now</span>
                      <span className="text-foreground font-semibold">
                        {formatUSD(fromUsdcUnits(chain.maxWithdraw))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted">Wallet mUSDC</span>
                      <span className="text-foreground dark:text-foreground">
                        {formatUSD(fromUsdcUnits(chain.walletBalance))}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center pt-2 border-t border-line dark:border-line">
                      <span className="text-muted">Principal Deposited</span>
                      <span className="text-foreground dark:text-foreground">
                        {displayPosition ? formatUSD(displayPosition.deposited_amount) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted">Net position change</span>
                      <span className="text-foreground font-semibold">
                        {displayPosition
                          ? formatUSD(displayPosition.current_value - displayPosition.deposited_amount + displayPosition.withdrawn_amount)
                          : '—'}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted">Pool Share</span>
                  <span className="text-accent dark:text-accent font-semibold">
                    {displayPosition ? displayPosition.pool_share.toFixed(2) + '%' : '—'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={actionsDisabled}
                  onClick={() => { setAmountInput(''); setIsWithdrawOpen(true) }}
                >
                  Withdraw
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={actionsDisabled}
                  onClick={() => { setAmountInput(''); setIsDepositOpen(true) }}
                >
                  Deposit
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
                <TrendingUp className="w-4 h-4 text-foreground" />
                Pool allocation
              </CardTitle>
              <CardDescription>
                Visual distribution between available liquidity reserves and active borrower loans
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex justify-between text-sm tabular-nums mb-2">
                  <span className="text-muted">Reserve Utilization</span>
                  <span className="font-semibold text-foreground dark:text-foreground">
                    {displayStats ? displayStats.utilization_rate.toFixed(1) + '% active' : '—'}
                  </span>
                </div>
                {/* Dual Color Progress Bar */}
                <div className="h-4 w-full rounded-full bg-surface dark:bg-subtle overflow-hidden flex">
                  <div
                    style={{ width: `${displayStats?.utilization_rate ?? 0}%` }}
                    className="bg-brand dark:bg-brand h-full transition-all duration-500"
                    title="Active Loans"
                  />
                  <div
                    style={{ width: `${100 - (displayStats?.utilization_rate ?? 0)}%` }}
                    className="bg-subtle h-full transition-all duration-500"
                    title="Available Liquidity"
                  />
                </div>
                <div className="flex justify-between text-sm text-muted mt-2 tabular-nums">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                    Loaned: {displayStats ? formatUSD(displayStats.total_outstanding_principal) : '—'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-subtle border border-control" />
                    Available: {displayStats ? formatUSD(displayStats.total_pool_liquidity) : '—'}
                  </span>
                </div>
              </div>

              {onchain && chain.loaded && (
                <div className="grid grid-cols-2 gap-3 text-sm tabular-nums">
                  <div className="p-2.5 rounded-lg bg-surface dark:bg-subtle">
                    <span className="block text-muted">Interest earned</span>
                    <span className="text-foreground font-semibold">
                      {formatUsdcExact(chain.interestEarned)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface dark:bg-subtle">
                    <span className="block text-muted">Losses written off</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      {formatUsdcExact(chain.losses)}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg bg-surface dark:bg-subtle border border-line dark:border-line text-sm text-muted space-y-1">
                <div className="font-semibold text-foreground dark:text-foreground flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent" />
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
        title="Deposit Funds to Lending Pool"
        description="Review your contribution to the shared lending pool."
      >
        <form onSubmit={handleDeposit} className="space-y-4">
          <Input
            label={onchain ? "Deposit amount (mUSDC)" : "Deposit amount (mUSDC)"}
            type="number"
            min="0.000001"
            step="any"
            placeholder="e.g. 500.00"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            required
          />

          <div className="flex gap-2 text-sm">
            {['100', '250', '500', '1000'].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmountInput(val)}
                className="px-2.5 py-1 rounded bg-surface dark:bg-subtle hover:bg-subtle dark:hover:bg-subtle tabular-nums transition-colors"
              >
                +{val}
              </button>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-surface dark:bg-subtle text-sm tabular-nums space-y-1 text-muted dark:text-muted">
            <div className="flex justify-between">
              <span>Estimated Annual Yield:</span>
              <span className="text-foreground font-semibold">~{netApy}%</span>
            </div>
            {onchain && chain.loaded && (
              <div className="flex justify-between">
                <span>Wallet balance:</span>
                <span>{formatUsdcExact(chain.walletBalance)}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-muted">
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
        title="Withdraw from Pool"
        description="Withdraw your deposited liquidity and accumulated interest back to your wallet."
      >
        <form onSubmit={handleWithdraw} className="space-y-4">
          <Input
            label={onchain ? "Withdrawal amount (mUSDC)" : "Withdrawal amount (mUSDC)"}
            type="number"
            min="0.000001"
            max={onchain && chain.loaded ? fromUsdcUnits(chain.maxWithdraw) : position?.current_value || 0}
            step="any"
            placeholder="e.g. 250.00"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            required
          />

          <div className="flex justify-between text-sm tabular-nums text-muted">
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
