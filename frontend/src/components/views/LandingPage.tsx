import { ArrowRight, Check, ArrowUpRight } from 'lucide-react'
const journey = [
  ['Create your profile', 'A simple starting point for your borrowing journey.'],
  ['Understand your credit', 'Explore the five factors behind your assessment.'],
  ['Review your terms', 'See the amount, interest, and repayment schedule before you confirm.'],
  ['Stay on track', 'Follow your payments and explore support when you need it.'],
]
const factors = [['Repayment history', 35], ['Affordability', 25], ['Cash-flow stability', 15], ['Debt burden', 15], ['Evidence quality', 10]] as const
export const LandingPage = ({ onNavigate }: { onNavigate: (tab: string) => void }) => <div className="landing">
  <section className="landing-hero" aria-labelledby="landing-title">
    <div>
      <p className="eyebrow">A little room to move forward</p>
      <h1 id="landing-title">Small loans.<br />A clearer way<br className="hidden lg:block" /> forward.</h1>
      <p className="hero-description">For the gap between a delayed stipend and your next step. Understand your credit, review your terms, and keep every repayment in view.</p>
      <a className="text-link" href="#how-it-works">See how Credora works <ArrowRight size={18} /></a>
      <p className="hero-footnote">Built around students and early-career researchers.</p>
    </div>
    <div className="assessment-preview" aria-label="Illustrative assessment breakdown">
      <div className="flex justify-between items-center gap-3 border-b border-line pb-5"><span className="font-medium">A score you can understand</span><span className="text-sm text-muted">How it works</span></div>
      <p className="preview-title">Your story.<br /><span className="text-accent">Five clear factors.</span></p>
      <div className="space-y-5">{factors.map(([name, weight]) => <div key={name}>
        <div className="flex justify-between gap-4 text-sm mb-2"><span>{name}</span><span className="tabular-nums text-muted">{weight}%</span></div>
        <div className="h-1.5 rounded-full bg-subtle overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: weight + '%' }} /></div>
      </div>)}</div>
      <div className="flex gap-3 items-start pt-6 mt-6 border-t border-line text-sm text-muted"><Check size={18} className="shrink-0 text-accent" /><p>Each factor contributes to the result. See the breakdown, not just a number.</p></div>
    </div>
  </section>
  <section id="how-it-works" className="landing-section scroll-mt-24" aria-labelledby="journey-title">
    <div className="section-intro"><p className="eyebrow">From assessment to repayment</p><h2 id="journey-title">Know where you stand.<br />Know what comes next.</h2></div>
    <ol className="journey-grid">{journey.map(([title, description], index) => <li key={title}><span className="step-number">0{index + 1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
  </section>
  <section className="landing-section lending-story" aria-labelledby="pool-title">
    <div><p className="eyebrow">One shared pool</p><h2 id="pool-title">Support the next step.</h2></div>
    <div className="space-y-5"><p className="text-muted leading-relaxed">Lenders contribute to a shared pool instead of choosing individual loans. Repayments return to the pool; available liquidity determines how much can be withdrawn. Lending losses can reduce the value of pool shares.</p><button className="text-link" onClick={() => onNavigate('lender')}>Explore the lending pool <ArrowUpRight size={18} /></button></div>
  </section>
  <section className="landing-section faq-section" aria-labelledby="faq-title">
    <h2 id="faq-title">A few useful answers.</h2><div>
      {[
        ['Do I need a wallet to explore?', 'No. Demo mode lets you explore simulated profiles, assessments, and lending. Test-network actions need a wallet and use test mUSDC, which has no monetary value.'],
        ['What happens after an assessment?', 'You can inspect the factor breakdown and eligible amount. On-chain borrowing also requires a registered identity and an unexpired score approved by an authorized operator.'],
        ['Can I question my assessment?', 'Yes. You can submit a dispute for review. If a dispute is upheld on-chain, the existing score is revoked.'],
        ['What if I need help with repayments?', 'Eligible overdue loans can request a revised repayment plan. An authorized recovery officer reviews the request before a new plan takes effect.'],
      ].map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
    </div>
  </section>
</div>
