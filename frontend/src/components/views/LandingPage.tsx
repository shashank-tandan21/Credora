import React from 'react'
import {
  ArrowRight,
  ShieldCheck,
  Landmark,
  Coins,
  ChevronRight,
} from 'lucide-react'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'

interface LandingPageProps {
  onNavigate: (tab: string) => void
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section */}
      <section className="pt-8 sm:pt-14 text-center max-w-4xl mx-auto space-y-6">
        {/* Protocol Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-200/80 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
          <span className="font-semibold">Credora Protocol 1.0</span>
          <span className="text-blue-300 dark:text-blue-700">•</span>
          <span>Academic Micro-Lending System</span>
        </div>

        {/* Primary Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
          Undercollateralized micro-lending.{' '}
          <span className="text-blue-600 dark:text-blue-400">
            Powered by explainable credit.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          Credora replaces 150% crypto collateral requirements with a deterministic 5-factor
          credit scoring model and pooled on-chain liquidity. Built for academic and bridge micro-financing.
        </p>

        {/* Primary Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            size="lg"
            onClick={() => onNavigate('borrower')}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="shadow-sm hover:shadow transition-all px-6"
          >
            Launch Borrower App
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => onNavigate('lender')}
            leftIcon={<Landmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            className="px-6"
          >
            Explore Lending Pool
          </Button>
        </div>

        {/* High-Level Institutional Metrics Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 border-t border-slate-200/80 dark:border-slate-800/80 text-left">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/70">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Pool Liquidity</span>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
              ₹25,000.00
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              100% Solvency Ratio
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/70">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fixed Borrower APR</span>
            <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              12.00%
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
              Zero hidden origination fees
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/70">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Scoring Engine</span>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
              5-Factor
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
              Explainable & deterministic
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/70">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Settlement Layer</span>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              Smart Contracts
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
              Non-custodial escrow & pool
            </span>
          </div>
        </div>
      </section>

      {/* How the Protocol Works: 3-Step Lifecycle */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            System Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:white">
            How Credora Solves Crypto Under-Collateralization
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            A cohesive three-step pipeline combining verifiable off-chain credit computation with trustless on-chain execution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 space-y-4 hover:border-blue-300 dark:hover:border-blue-800/80 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
              01
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Verifiable Credit Scoring
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Borrowers connect their wallet and submit normalized financial evidence. The 5-factor model evaluates cash flow, debt burden, and repayment history to generate an explainable score.
              </p>
            </div>
            <div className="pt-2 text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
              <span>Weighted across 5 dimensions</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 space-y-4 hover:border-emerald-300 dark:hover:border-emerald-800/80 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              02
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Instant Pool Disbursement
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Qualified borrowers select loan amounts up to their certified limit. The smart contract validates their attestation and disburses loan capital directly from the liquidity pool into their wallet.
              </p>
            </div>
            <div className="pt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <span>Direct smart contract execution</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 space-y-4 hover:border-indigo-300 dark:hover:border-indigo-800/80 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              03
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Amortized Repayment & Yield
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Borrowers pay scheduled installments in rupees. Repaid principal and 12% APR interest flow back into the pool, increasing the value of lenders' pool shares in real time.
              </p>
            </div>
            <div className="pt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
              <span>Automated accounting & yield accrual</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* Role Workspaces: Choose Your Flow */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Workspaces
            </span>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              Select Your Participant Portal
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Credora separates participant contexts to provide role-specific workflows and security boundaries.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Borrower Card */}
          <div
            onClick={() => onNavigate('borrower')}
            className="group p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer flex flex-col justify-between space-y-6 shadow-2xs hover:shadow-md"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Borrower Workspace
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Submit financial evidence, evaluate your 5-factor credit rating, request micro-loans, and service installment payments.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span>Open Borrower Portal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Lender Card */}
          <div
            onClick={() => onNavigate('lender')}
            className="group p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer flex flex-col justify-between space-y-6 shadow-2xs hover:shadow-md"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Lending Pool Desk
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Provide liquidity into the non-custodial lending pool, earn passive yield from loan interest, and track your liquidity share.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span>Manage Liquidity</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Reviewer Card */}
          <div
            onClick={() => onNavigate('reviewer')}
            className="group p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 hover:border-purple-500 dark:hover:border-purple-500 transition-all cursor-pointer flex flex-col justify-between space-y-6 shadow-2xs hover:shadow-md"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  Reviewer & Audit Desk
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Adjudicate borrower credit disputes, oversee restructuring milestones for overdue facilities, and attest verified ratings.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-purple-600 dark:text-purple-400">
              <span>Access Audit Console</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* Academic 5-Factor Model Explanation Table */}
      <section className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Risk Methodology
            </span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              Transparent 5-Factor Credit Formula
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Every score is deterministic, inspectable, and subject to formal dispute resolution.
            </p>
          </div>
          <Badge variant="indigo">academic_model=true</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3 font-semibold">Evaluation Factor</th>
                <th className="p-3 font-semibold">Weight</th>
                <th className="p-3 font-semibold">What is Measured</th>
                <th className="p-3 font-semibold">Target Benchmark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              <tr>
                <td className="p-3 font-medium text-slate-900 dark:text-white">Repayment History</td>
                <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">35%</td>
                <td className="p-3 text-slate-600 dark:text-slate-400">On-time installment record and historical default absence</td>
                <td className="p-3 text-slate-500 dark:text-slate-400">≥ 80 / 100</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-slate-900 dark:text-white">Affordability</td>
                <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">25%</td>
                <td className="p-3 text-slate-600 dark:text-slate-400">Net disposable monthly margin after verified recurring obligations</td>
                <td className="p-3 text-slate-500 dark:text-slate-400">&gt; ₹25,000 buffer</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-slate-900 dark:text-white">Cash-flow Stability</td>
                <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">15%</td>
                <td className="p-3 text-slate-600 dark:text-slate-400">Consistency of monthly deposit volume over a rolling 90-day window</td>
                <td className="p-3 text-slate-500 dark:text-slate-400">Low coefficient of variance</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-slate-900 dark:text-white">Debt Burden (DTI)</td>
                <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">15%</td>
                <td className="p-3 text-slate-600 dark:text-slate-400">Ratio of existing verified liabilities against total monthly earnings</td>
                <td className="p-3 text-slate-500 dark:text-slate-400">DTI &lt; 35%</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-slate-900 dark:text-white">Evidence Quality</td>
                <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">10%</td>
                <td className="p-3 text-slate-600 dark:text-slate-400">Completeness of documentation and cryptographic identity attestation</td>
                <td className="p-3 text-slate-500 dark:text-slate-400">Full verified documentation</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
