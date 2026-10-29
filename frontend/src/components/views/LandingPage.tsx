import React, { useState } from 'react'
import {
  ArrowRight,
  ShieldCheck,
  Sliders,
  Landmark,
  Coins,
  ChevronRight,
  Scale,
} from 'lucide-react'
import { Button } from '../common/Button'
import { Badge, RiskBadge } from '../common/Badge'
import { formatUSD } from '../../utils/cn'

interface LandingPageProps {
  onNavigate: (tab: string) => void
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  // Interactive preview slider on hero
  const [demoScore, setDemoScore] = useState(84)
  const [demoAmount, setDemoAmount] = useState(600)

  const borrowingLimit = Math.min(demoScore * 15, 2000)
  const interest = Number(((demoAmount * 0.12 * 90) / 365).toFixed(2))
  const totalRepayment = (demoAmount + interest).toFixed(2)
  const monthlyPayment = (Number(totalRepayment) / 3).toFixed(2)

  return (
    <div className="space-y-24 pb-16">
      {/* Hero Section */}
      <section className="relative pt-6 sm:pt-12">
        {/* Subtle Ambient Background Gradients (Toned down, elegant, human) */}
        <div className="absolute inset-0 -z-10 flex items-center justify-center overflow-hidden pointer-events-none">
          <div className="w-[600px] h-[350px] bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl transform -translate-y-12" />
          <div className="w-[450px] h-[250px] bg-emerald-500/10 dark:bg-emerald-600/10 rounded-full blur-3xl transform translate-x-32" />
        </div>

        <div className="max-w-4xl mx-auto text-center space-y-6">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 dark:border-blue-900/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-medium">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
            <span className="font-semibold">Credora Protocol 1.0</span>
            <span className="text-blue-300 dark:text-blue-700">•</span>
            <span>Academic Micro-Lending Prototype</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
            Undercollateralized micro-loans. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-300 dark:to-emerald-400">
              Powered by explainable credit.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            A transparent decentralized lending protocol pairing deterministic 5-factor scoring
            with on-chain liquidity pools. Designed for academic and micro-grant bridge financing.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={() => onNavigate('borrower')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="shadow-md shadow-blue-500/15 hover:shadow-lg transition-all"
            >
              Launch Borrower App
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => onNavigate('credit')}
              leftIcon={<Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
            >
              Test Credit Studio
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => onNavigate('lender')}
              leftIcon={<Landmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            >
              Lending Pool TVL
            </Button>
          </div>

          {/* Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-slate-200/80 dark:border-slate-800/80 text-left">
            <div className="p-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total Pool Capital</span>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                $25,000.00
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                100% Solvency Ratio
              </span>
            </div>
            <div className="p-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">Fixed Borrower APR</span>
              <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                12.00%
              </div>
              <span className="text-[11px] text-slate-500">Zero origination fee</span>
            </div>
            <div className="p-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">Assessment Expiry</span>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                90 Days
              </div>
              <span className="text-[11px] text-slate-500">Transparent renewal</span>
            </div>
            <div className="p-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">Smart Contract Layer</span>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                Sepolia / Demo
              </div>
              <span className="text-[11px] text-slate-500">Non-custodial pool</span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Interactive Protocol Simulator */}
      <section className="relative">
        <div className="max-w-5xl mx-auto rounded-2xl border border-slate-200/80 bg-white/90 p-6 sm:p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900/90 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Interactive Protocol Simulator
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                See How Your Credit Score Directly Dictates Borrowing Terms
              </h3>
            </div>
            <Badge variant="indigo">Deterministic Model</Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6">
            {/* Simulator Controls */}
            <div className="lg:col-span-7 space-y-6">
              {/* Score Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Simulate Your Academic Credit Score:
                  </span>
                  <span className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                    {demoScore} / 100
                  </span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="98"
                  value={demoScore}
                  onChange={(e) => {
                    const sc = Number(e.target.value)
                    setDemoScore(sc)
                    if (demoAmount > sc * 15) setDemoAmount(sc * 15)
                  }}
                  className="w-full accent-blue-600 dark:accent-blue-400 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Fair (50)</span>
                  <span>Good (75)</span>
                  <span>Strong (90+)</span>
                </div>
              </div>

              {/* Amount Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Requested Micro-Loan Amount:
                  </span>
                  <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {formatUSD(demoAmount)}
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max={borrowingLimit}
                  step="25"
                  value={demoAmount}
                  onChange={(e) => setDemoAmount(Number(e.target.value))}
                  className="w-full accent-emerald-600 dark:accent-emerald-400 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>$50 Min</span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    Max Limit: {formatUSD(borrowingLimit)}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  No Traditional FICO Required
                </div>
                <p>
                  Scores are calculated from academic grant inflows, residual income ratios, and
                  repayment timeliness—not commercial credit bureau telemetry.
                </p>
              </div>
            </div>

            {/* Live Calculation Preview Card */}
            <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4">
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 font-sans">Risk Assessment Tier</span>
                  <RiskBadge category={demoScore >= 85 ? 'Strong' : demoScore >= 70 ? 'Good' : 'Fair'} size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Eligible Borrowing Cap</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatUSD(borrowingLimit)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Tenure Duration</span>
                  <span className="text-slate-800 dark:text-slate-200">90 Days (3 Months)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">3-Month Interest (12%)</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    +${interest}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700 text-sm">
                  <span className="font-bold text-slate-900 dark:text-slate-100 font-sans">
                    Monthly Installment
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    ${monthlyPayment} / mo
                  </span>
                </div>
              </div>

              <Button
                className="w-full text-xs"
                onClick={() => onNavigate('loans')}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Apply With This Estimate
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* The Three Pillars of Credora */}
      <section className="space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            System Architecture
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Built on Financial Rigor & Mathematical Transparency
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Credora bridges the gap between decentralized liquidity and explainable off-chain underwriting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 hover:border-blue-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              1. Non-Custodial Identity
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Attest identity on-chain via the <code className="text-blue-600 dark:text-blue-400 font-mono">IdentityRegistry</code> contract. 
              Zero passwords, zero seed phrase leaks—authenticated securely using EIP-4361 wallet signatures.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 hover:border-indigo-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              2. 5-Factor Scoring Model
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Transparent weights: 35% Repayment History, 25% Affordability, 15% Cash Flow, 15% Debt
              Burden, and 10% Evidence Quality. Every score includes plain-English explainability notes.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 hover:border-emerald-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              3. Shared Liquidity & Yield
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Lenders supply capital to the shared lending pool and earn automated interest
              distribution. Borrowers receive micro-loans directly into their Web3 wallets with exact-cent schedules.
            </p>
          </div>
        </div>
      </section>

      {/* Reviewer & Dispute Governance Section */}
      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 p-8 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <Badge variant="indigo">Democratic Governance</Badge>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Human Reviewers & Dispute Adjudication
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Unlike cold commercial algorithms that reject borrowers without recourse, Credora
              incorporates an audited Reviewer Desk. Borrowers can dispute algorithmic edge cases,
              provide supplemental evidence, and receive transparent human adjustments.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="md" onClick={() => onNavigate('reviewer')}>
              Open Reviewer Desk
            </Button>
            <Button size="md" onClick={() => onNavigate('credit')}>
              Explore Scoring Engine
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
