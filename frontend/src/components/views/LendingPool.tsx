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
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'
import { Modal } from '../common/Modal'
import { Input } from '../common/Input'
import { api } from '../../api/client'
import { formatUSD } from '../../utils/cn'
import type { LenderPosition, PoolStatistics } from '../../types'

export const LendingPool: React.FC = () => {
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

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amountInput)
    if (isNaN(amt) || amt <= 0) return

    setIsActionLoading(true)
    try {
      await api.depositToPool(amt)
      await reloadData()
      setIsDepositOpen(false)
      setAmountInput('')
      setStatusMessage({
        type: 'success',
        text: `Successfully supplied ${formatUSD(amt)} to the Credora Lending Pool.`,
      })
      setTimeout(() => setStatusMessage(null), 6000)
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: (err as Error).message })
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amountInput)
    if (isNaN(amt) || amt <= 0) return

    setIsActionLoading(true)
    try {
      await api.withdrawFromPool(amt)
      await reloadData()
      setIsWithdrawOpen(false)
      setAmountInput('')
      setStatusMessage({
        type: 'success',
        text: `Successfully redeemed ${formatUSD(amt)} from the liquidity pool.`,
      })
      setTimeout(() => setStatusMessage(null), 6000)
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: (err as Error).message })
    } finally {
      setIsActionLoading(false)
    }
  }

  const netApy = stats ? (12.0 * (stats.utilization_rate / 100)).toFixed(2) : '3.12'

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {statusMessage && (
        <div
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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
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

      {/* Pool Statistics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Liquidity (TVL)
            </span>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
              {stats ? formatUSD(stats.total_deposited) : '—'}
            </div>
            <CardDescription>Aggregate capital deposited</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Available Cash
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {stats ? formatUSD(stats.total_pool_liquidity) : '—'}
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
              {stats ? `${stats.utilization_rate.toFixed(1)}%` : '—'}
            </div>
            <CardDescription>{stats?.total_active_loans || 0} active loans funded</CardDescription>
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
                <Badge variant="success" size="sm">
                  Active Supplier
                </Badge>
              </div>
              <CardDescription>
                Real-time position balance and accumulated lending interest
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Current Position Value</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {position ? formatUSD(position.current_value) : '$0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  <span className="text-slate-500">Principal Deposited</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {position ? formatUSD(position.deposited_amount) : '$0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Total Yield Earned</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {position
                      ? formatUSD(Math.max(0, position.current_value - position.deposited_amount))
                      : '$0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Pool Share</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {position?.pool_share.toFixed(2) || '0.00'}%
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsWithdrawOpen(true)}
                >
                  Redeem Capital
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
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
                    {stats?.utilization_rate.toFixed(1)}% Active
                  </span>
                </div>
                {/* Dual Color Progress Bar */}
                <div className="h-4 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                  <div
                    style={{ width: `${stats?.utilization_rate || 26}%` }}
                    className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-500"
                    title="Active Loans"
                  />
                  <div
                    style={{ width: `${100 - (stats?.utilization_rate || 26)}%` }}
                    className="bg-emerald-500 dark:bg-emerald-600 h-full transition-all duration-500"
                    title="Available Liquidity"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-2 font-mono">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    Loaned: {stats ? formatUSD(stats.total_outstanding_principal) : '—'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Available: {stats ? formatUSD(stats.total_pool_liquidity) : '—'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                  Protocol Risk Parameter
                </div>
                <p>
                  Pool deposits are protected by on-chain identity attestations and explainable credit
                  scoring. Overdue loans trigger automated restructuring procedures.
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
            min="10"
            step="10"
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
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDepositOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isActionLoading}>
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
            min="1"
            max={position?.current_value || 0}
            step="1"
            placeholder="e.g. 250.00"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            required
          />

          <div className="flex justify-between text-xs font-mono text-slate-500">
            <span>Available in Position:</span>
            <span>{formatUSD(position?.current_value)}</span>
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
            <Button type="submit" size="sm" variant="destructive" isLoading={isActionLoading}>
              Confirm Withdrawal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
