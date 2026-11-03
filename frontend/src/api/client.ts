import type {
  AuthenticatedUser,
  BorrowerProfile,
  ChainConfig,
  CreditAssessment,
  DisputeRecord,
  EvidenceSubmission,
  LenderPosition,
  LoanQuote,
  LoanRequest,
  PoolStatistics,
  UserRole,
} from '../types'

const API_BASE = '/api/v1'

class ApiClient {
  private token: string | null = null
  private tokenWallet: string | null = null
  private currentRole: UserRole = 'borrower'
  private demoWallet: string = '0x71C83955620935560935593883839281728392A1'
  private isBackendAvailable: boolean | null = null

  constructor() {
    this.token = localStorage.getItem('credora-token')
    this.tokenWallet = localStorage.getItem('credora-token-wallet')
  }

  setToken(token: string | null) {
    this.token = token
    if (token) {
      this.tokenWallet = this.demoWallet.toLowerCase()
      localStorage.setItem('credora-token', token)
      localStorage.setItem('credora-token-wallet', this.tokenWallet)
    } else {
      this.tokenWallet = null
      localStorage.removeItem('credora-token')
      localStorage.removeItem('credora-token-wallet')
    }
  }

  getToken(): string | null {
    return this.token
  }

  setRole(role: UserRole) {
    this.currentRole = role
  }

  getRole(): UserRole {
    return this.currentRole
  }

  getWallet(): string {
    return this.demoWallet
  }

  /** Switching wallets drops the session so the backend never acts for the wrong wallet. */
  setWallet(address: string) {
    this.demoWallet = address
    if (this.token && this.tokenWallet !== address.toLowerCase()) {
      this.setToken(null)
    }
  }

  getIsBackendAvailable(): boolean | null {
    return this.isBackendAvailable
  }

  async ensureAuthenticated(): Promise<string> {
    if (this.token) {
      return this.token
    }
    try {
      const normalizedWallet = this.demoWallet.toLowerCase()
      const { nonce } = await this.requestNonce(normalizedWallet)
      const res = await this.verifySignature(normalizedWallet, nonce, `demo:${nonce}`)
      return res.access_token
    } catch {
      return ''
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (!this.token && !path.startsWith('/auth/')) {
      await this.ensureAuthenticated()
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      })

      if (response.status === 401 && !path.startsWith('/auth/')) {
        this.token = null
        await this.ensureAuthenticated()
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`
          const retryRes = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers,
          })
          if (retryRes.ok) {
            this.isBackendAvailable = true
            return await retryRes.json()
          }
        }
      }

      if (!response.ok) {
        let errMessage = `HTTP ${response.status}`
        try {
          const errData = await response.json()
          errMessage = errData.detail || errData.error?.message || errMessage
        } catch {
          // ignore json parse error
        }
        throw new Error(errMessage)
      }

      this.isBackendAvailable = true
      return await response.json()
    } catch (err: unknown) {
      const error = err as Error
      // If network fails (backend not running or connection refused), fallback to in-memory demo engine
      if (
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('ECONNREFUSED')
      ) {
        this.isBackendAvailable = false
        throw new Error('BACKEND_OFFLINE')
      }
      throw error
    }
  }

  // --- Auth APIs ---
  async requestNonce(walletAddress: string): Promise<{ nonce: string; message: string }> {
    try {
      return await this.request<{ nonce: string; message: string }>('/auth/nonce', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: walletAddress }),
      })
    } catch (err: unknown) {
      const error = err as Error
      if (error.message === 'BACKEND_OFFLINE') {
        const nonce = `credora-demo-${Date.now().toString(36)}`
        return {
          nonce,
          message: `Credora Protocol: Sign to verify ${walletAddress}. Nonce: ${nonce}`,
        }
      }
      throw error
    }
  }

  async verifySignature(
    walletAddress: string,
    nonce: string,
    signature: string,
    message?: string
  ): Promise<{ access_token: string; user: AuthenticatedUser }> {
    try {
      const data = await this.request<{
        access_token: string
        user: AuthenticatedUser
      }>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          wallet_address: walletAddress,
          nonce,
          signature,
          ...(message ? { message } : {}),
        }),
      })
      this.setToken(data.access_token)
      return data
    } catch (err: unknown) {
      const error = err as Error
      if (error.message === 'BACKEND_OFFLINE') {
        const mockToken = `demo_token_${Date.now()}`
        this.setToken(mockToken)
        return {
          access_token: mockToken,
          user: {
            wallet_address: walletAddress,
            role: this.currentRole,
            demo_mode: true,
          },
        }
      }
      throw error
    }
  }

  // --- Borrower APIs ---
  async getBorrowerProfile(): Promise<BorrowerProfile | null> {
    try {
      return await this.request<BorrowerProfile>('/borrowers/me')
    } catch (err: unknown) {
      const error = err as Error
      if (error.message === 'BACKEND_OFFLINE') {
        return mockStore.getProfile(this.demoWallet)
      }
      if (
        error.message.includes('404') ||
        error.message.includes('not been registered') ||
        error.message.includes('not registered')
      ) {
        return null
      }
      throw error
    }
  }

  async registerBorrower(displayName: string, bio?: string): Promise<BorrowerProfile> {
    try {
      return await this.request<BorrowerProfile>('/borrowers/register', {
        method: 'POST',
        body: JSON.stringify({ display_name: displayName, bio }),
      })
    } catch (err: unknown) {
      const error = err as Error
      if (error.message === 'BACKEND_OFFLINE') {
        return mockStore.registerProfile(this.demoWallet, displayName, bio)
      }
      throw error
    }
  }

  /**
   * Ask the backend to verify an IdentityRegistry receipt and link it to the profile.
   * Requires the backend to be online with chain configuration; there is no offline
   * fallback because a confirmation cannot be simulated.
   */
  async syncIdentity(transactionHash: string): Promise<BorrowerProfile> {
    return await this.request<BorrowerProfile>('/borrowers/me/identity/sync', {
      method: 'POST',
      body: JSON.stringify({ transaction_hash: transactionHash }),
    })
  }

  async getChainConfig(): Promise<ChainConfig | null> {
    try {
      return await this.request<ChainConfig>('/chain/config')
    } catch {
      return null
    }
  }

  // --- Credit & Assessment APIs ---
  async submitEvidence(evidence: EvidenceSubmission): Promise<EvidenceSubmission> {
    try {
      return await this.request<EvidenceSubmission>('/credit/evidence', {
        method: 'POST',
        body: JSON.stringify(evidence),
      })
    } catch (err: unknown) {
      const error = err as Error
      if (error.message === 'BACKEND_OFFLINE') {
        return mockStore.saveEvidence(this.demoWallet, evidence)
      }
      throw error
    }
  }

  async createAssessment(validityDays = 90): Promise<CreditAssessment> {
    try {
      return await this.request<CreditAssessment>('/credit/assess', {
        method: 'POST',
        body: JSON.stringify({ validity_days: validityDays }),
      })
    } catch (err: unknown) {
      const error = err as Error
      if (error.message === 'BACKEND_OFFLINE') {
        return mockStore.generateAssessment(this.demoWallet, validityDays)
      }
      throw error
    }
  }

  async getCurrentAssessment(): Promise<CreditAssessment | null> {
    try {
      return await this.request<CreditAssessment>('/credit/current')
    } catch (err: unknown) {
      const error = err as Error
      if (error.message === 'BACKEND_OFFLINE') {
        return mockStore.getCurrentAssessment(this.demoWallet)
      }
      if (
        error.message.includes('404') ||
        error.message.includes('422') ||
        error.message.includes('No active credit assessment') ||
        error.message.includes('expired')
      ) {
        return null
      }
      throw error
    }
  }

  async getAssessmentHistory(): Promise<CreditAssessment[]> {
    try {
      return await this.request<CreditAssessment[]>('/credit/history')
    } catch (err: unknown) {
      const error = err as Error
      if (error.message === 'BACKEND_OFFLINE') {
        return mockStore.getAssessmentHistory(this.demoWallet)
      }
      return []
    }
  }

  // --- Loan APIs ---
  async getLoanQuote(amount: number, durationDays: number): Promise<LoanQuote> {
    try {
      return await this.request<LoanQuote>('/loans/quote', {
        method: 'POST',
        body: JSON.stringify({ amount, duration_days: durationDays }),
      })
    } catch (err: unknown) {
      const error = err as Error
      if (error.message === 'BACKEND_OFFLINE') {
        return mockStore.calculateQuote(this.demoWallet, amount, durationDays)
      }
      throw error
    }
  }

  async requestLoan(amount: number, durationDays: number): Promise<LoanRequest> {
    try {
      return await this.request<LoanRequest>('/loans', {
        method: 'POST',
        body: JSON.stringify({ amount, duration_days: durationDays }),
      })
    } catch (err: unknown) {
      const error = err as Error
      if (error.message === 'BACKEND_OFFLINE') {
        return mockStore.createLoan(this.demoWallet, amount, durationDays)
      }
      throw error
    }
  }

  async getLoans(): Promise<LoanRequest[]> {
    try {
      return await this.request<LoanRequest[]>('/loans')
    } catch (err: unknown) {
      const error = err as Error
      if (error.message === 'BACKEND_OFFLINE') {
        return mockStore.getLoans(this.demoWallet)
      }
      return []
    }
  }

  // --- Pool & Lender APIs ---
  async getPoolStatistics(): Promise<PoolStatistics> {
    try {
      return await this.request<PoolStatistics>('/pool/statistics')
    } catch (err: unknown) {
      const error = err as Error
      if (error.message === 'BACKEND_OFFLINE') {
        return mockStore.getPoolStats()
      }
      throw error
    }
  }

  async getLenderPosition(): Promise<LenderPosition> {
    return mockStore.getLenderPosition(this.demoWallet)
  }

  async depositToPool(amount: number): Promise<LenderPosition> {
    return mockStore.deposit(this.demoWallet, amount)
  }

  async withdrawFromPool(amount: number): Promise<LenderPosition> {
    return mockStore.withdraw(this.demoWallet, amount)
  }

  // --- Disputes & Reviewer ---
  async disputeAssessment(assessmentId: string, reason: string): Promise<DisputeRecord> {
    return mockStore.createDispute(this.demoWallet, assessmentId, reason)
  }

  async listDisputes(): Promise<DisputeRecord[]> {
    return mockStore.listDisputes()
  }

  async resolveDispute(
    disputeId: string,
    reviewerNotes: string,
    status: 'resolved_adjusted' | 'rejected'
  ): Promise<DisputeRecord> {
    return mockStore.resolveDispute(disputeId, reviewerNotes, status)
  }
}

// In-browser High-Fidelity Demo Store (Faithful to FastAPI services & formulas)
class InBrowserDemoStore {
  private profiles = new Map<string, BorrowerProfile>()
  private evidences = new Map<string, EvidenceSubmission[]>()
  private assessments = new Map<string, CreditAssessment[]>()
  private loans = new Map<string, LoanRequest[]>()
  private disputes: DisputeRecord[] = []
  private lenderPositions = new Map<string, LenderPosition>()

  private poolStats: PoolStatistics = {
    total_pool_liquidity: 18500.0,
    total_deposited: 25000.0,
    total_active_loans: 4,
    total_outstanding_principal: 6500.0,
    utilization_rate: 26.0,
  }

  constructor() {
    this.initDefaultSeedData()
  }

  private initDefaultSeedData() {
    const demoWallet = '0x71C83955620935560935593883839281728392A1'

    // Seed Profile
    this.profiles.set(demoWallet, {
      id: 'b-01',
      wallet_address: demoWallet,
      display_name: 'Alex Thorne',
      bio: 'Postgrad researcher in Distributed Systems. Seeking micro-grant bridge.',
      // Demo data never carries a transaction hash: nothing was submitted on-chain.
      identity_status: 'pending',
      registration_transaction_hash: null,
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    })

    // Seed Evidence
    const evidence: EvidenceSubmission = {
      id: 'ev-01',
      evidence_type: 'Academic Micro-Grant & Bank Inflows',
      period_months: 6,
      repayment_history_score: 92.0,
      affordability_score: 84.0,
      cash_flow_stability_score: 78.0,
      debt_burden_score: 85.0,
      evidence_quality_score: 90.0,
      notes: 'Verified university stipend receipts & on-time credit card records.',
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    }
    this.evidences.set(demoWallet, [evidence])

    // Seed Assessment
    const assessment: CreditAssessment = {
      id: 'ca-01',
      score: 86.85,
      risk_category: 'Good',
      components: [
        { name: 'Repayment history', raw_score: 92.0, weight: 0.35, contribution: 32.2 },
        { name: 'Affordability', raw_score: 84.0, weight: 0.25, contribution: 21.0 },
        { name: 'Debt burden', raw_score: 85.0, weight: 0.15, contribution: 12.75 },
        { name: 'Cash-flow stability', raw_score: 78.0, weight: 0.15, contribution: 11.7 },
        { name: 'Evidence quality', raw_score: 90.0, weight: 0.1, contribution: 9.0 },
      ],
      explanation: [
        'Repayment history is the strongest positive factor at 92.0/100.',
        'Cash-flow stability is the main factor limiting the score at 78.0/100.',
        'This is an academic prototype score and not a validated lending risk model.',
      ],
      academic_model: true,
      valid_from: new Date(Date.now() - 7 * 86400000).toISOString(),
      expires_at: new Date(Date.now() + 83 * 86400000).toISOString(),
      status: 'active',
    }
    this.assessments.set(demoWallet, [assessment])

    // Seed an active loan
    const loan: LoanRequest = {
      id: 'ln-01',
      wallet_address: demoWallet,
      amount: 600.0,
      eligible_limit: 1302.75,
      interest_rate: 0.12,
      interest_amount: 17.75,
      total_repayment: 617.75,
      duration_days: 90,
      status: 'active',
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      installments: [
        {
          installment_number: 1,
          due_date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
          amount: 205.92,
          status: 'scheduled',
        },
        {
          installment_number: 2,
          due_date: new Date(Date.now() + 40 * 86400000).toISOString().split('T')[0],
          amount: 205.92,
          status: 'scheduled',
        },
        {
          installment_number: 3,
          due_date: new Date(Date.now() + 70 * 86400000).toISOString().split('T')[0],
          amount: 205.91,
          status: 'scheduled',
        },
      ],
    }
    this.loans.set(demoWallet, [loan])

    // Seed lender position
    this.lenderPositions.set(demoWallet, {
      deposited_amount: 5000.0,
      withdrawn_amount: 0.0,
      pool_share: 20.0,
      current_value: 5142.5,
    })

    // Seed a dispute for reviewer queue
    this.disputes.push({
      id: 'disp-01',
      assessment_id: 'ca-seed-99',
      borrower_wallet: '0x3A21908235029312948291039840294820491823',
      dispute_reason:
        'Stipend deposit was delayed by university payroll by 4 days, falsely dragging cash-flow stability score.',
      status: 'pending',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    })
  }

  getProfile(wallet: string): BorrowerProfile | null {
    return this.profiles.get(wallet) || null
  }

  registerProfile(wallet: string, displayName: string, bio?: string): BorrowerProfile {
    const profile: BorrowerProfile = {
      id: `b-${Date.now().toString(36)}`,
      wallet_address: wallet,
      display_name: displayName,
      bio: bio || null,
      identity_status: 'pending',
      registration_transaction_hash: null,
      created_at: new Date().toISOString(),
    }
    this.profiles.set(wallet, profile)
    return profile
  }

  saveEvidence(wallet: string, evidence: EvidenceSubmission): EvidenceSubmission {
    const item = {
      ...evidence,
      id: `ev-${Date.now().toString(36)}`,
      created_at: new Date().toISOString(),
    }
    const current = this.evidences.get(wallet) || []
    this.evidences.set(wallet, [...current, item])
    return item
  }

  generateAssessment(wallet: string, validityDays: number): CreditAssessment {
    const evList = this.evidences.get(wallet) || []
    const ev = evList[evList.length - 1] || {
      repayment_history_score: 85,
      affordability_score: 80,
      cash_flow_stability_score: 75,
      debt_burden_score: 80,
      evidence_quality_score: 80,
    }

    const weights = {
      'Repayment history': 0.35,
      Affordability: 0.25,
      'Debt burden': 0.15,
      'Cash-flow stability': 0.15,
      'Evidence quality': 0.1,
    }

    const values = {
      'Repayment history': ev.repayment_history_score,
      Affordability: ev.affordability_score,
      'Debt burden': ev.debt_burden_score,
      'Cash-flow stability': ev.cash_flow_stability_score,
      'Evidence quality': ev.evidence_quality_score,
    }

    const components = Object.entries(values).map(([name, raw]) => {
      const weight = weights[name as keyof typeof weights]
      return {
        name,
        raw_score: raw,
        weight,
        contribution: Number((raw * weight).toFixed(2)),
      }
    })

    const score = Number(components.reduce((sum, c) => sum + c.contribution, 0).toFixed(2))

    let risk_category: CreditAssessment['risk_category'] = 'Good'
    if (score < 40) risk_category = 'High risk'
    else if (score < 60) risk_category = 'Moderate risk'
    else if (score < 75) risk_category = 'Fair'
    else if (score < 90) risk_category = 'Good'
    else risk_category = 'Strong'

    const entries = Object.entries(values)
    const strongest = entries.reduce((max, curr) => (curr[1] > max[1] ? curr : max))[0]
    const weakest = entries.reduce((min, curr) => (curr[1] < min[1] ? min : curr))[0]

    const assessment: CreditAssessment = {
      id: `ca-${Date.now().toString(36)}`,
      score,
      risk_category,
      components,
      explanation: [
        `${strongest} is the strongest positive factor at ${values[strongest as keyof typeof values].toFixed(1)}/100.`,
        `${weakest} is the main factor limiting the score at ${values[weakest as keyof typeof values].toFixed(1)}/100.`,
        'This is an academic prototype score and not a validated lending risk model.',
      ],
      academic_model: true,
      valid_from: new Date().toISOString(),
      expires_at: new Date(Date.now() + validityDays * 86400000).toISOString(),
      status: 'active',
    }

    const history = this.assessments.get(wallet) || []
    this.assessments.set(wallet, [...history, assessment])
    return assessment
  }

  getCurrentAssessment(wallet: string): CreditAssessment | null {
    const list = this.assessments.get(wallet)
    return list && list.length > 0 ? list[list.length - 1] : null
  }

  getAssessmentHistory(wallet: string): CreditAssessment[] {
    return this.assessments.get(wallet) || []
  }

  calculateQuote(wallet: string, amount: number, durationDays: number): LoanQuote {
    const assessment = this.getCurrentAssessment(wallet)
    const eligible_limit = assessment ? Math.min(assessment.score * 15, 2000) : 500

    if (amount > eligible_limit) {
      throw new Error(`Requested amount exceeds your borrowing limit of $${eligible_limit.toFixed(2)}`)
    }

    const ANNUAL_RATE = 0.12
    const interest_amount = Number(((amount * ANNUAL_RATE * durationDays) / 365).toFixed(2))
    const total_repayment = Number((amount + interest_amount).toFixed(2))
    const count = Math.max(1, Math.floor((durationDays + 29) / 30))
    const installment_amount = Number((total_repayment / count).toFixed(2))

    const installments = []
    let remaining = total_repayment
    const now = new Date()

    for (let i = 1; i <= count; i++) {
      const dueDate = new Date(now.getTime() + i * 30 * 86400000).toISOString().split('T')[0]
      const currentAmt = i === count ? remaining : installment_amount
      remaining = Number((remaining - currentAmt).toFixed(2))
      installments.push({
        installment_number: i,
        due_date: dueDate,
        amount: currentAmt,
        status: 'scheduled' as const,
      })
    }

    return {
      amount,
      eligible_limit,
      interest_rate: ANNUAL_RATE,
      interest_amount,
      total_repayment,
      duration_days: durationDays,
      installments,
    }
  }

  createLoan(wallet: string, amount: number, durationDays: number): LoanRequest {
    const quote = this.calculateQuote(wallet, amount, durationDays)
    const loan: LoanRequest = {
      ...quote,
      id: `ln-${Date.now().toString(36)}`,
      wallet_address: wallet,
      status: 'active',
      created_at: new Date().toISOString(),
    }
    const current = this.loans.get(wallet) || []
    this.loans.set(wallet, [loan, ...current])

    this.poolStats.total_pool_liquidity = Math.max(
      0,
      Number((this.poolStats.total_pool_liquidity - amount).toFixed(2))
    )
    this.poolStats.total_outstanding_principal = Number(
      (this.poolStats.total_outstanding_principal + amount).toFixed(2)
    )
    this.poolStats.total_active_loans += 1
    this.poolStats.utilization_rate = Number(
      ((this.poolStats.total_outstanding_principal / this.poolStats.total_deposited) * 100).toFixed(1)
    )

    return loan
  }

  getLoans(wallet: string): LoanRequest[] {
    return this.loans.get(wallet) || []
  }

  getPoolStats(): PoolStatistics {
    return { ...this.poolStats }
  }

  getLenderPosition(wallet: string): LenderPosition {
    return (
      this.lenderPositions.get(wallet) || {
        deposited_amount: 0,
        withdrawn_amount: 0,
        pool_share: 0,
        current_value: 0,
      }
    )
  }

  deposit(wallet: string, amount: number): LenderPosition {
    const current = this.getLenderPosition(wallet)
    const updated = {
      ...current,
      deposited_amount: current.deposited_amount + amount,
      current_value: current.current_value + amount,
    }
    this.poolStats.total_deposited += amount
    this.poolStats.total_pool_liquidity += amount
    updated.pool_share = Number(((updated.deposited_amount / this.poolStats.total_deposited) * 100).toFixed(2))
    this.lenderPositions.set(wallet, updated)
    return updated
  }

  withdraw(wallet: string, amount: number): LenderPosition {
    const current = this.getLenderPosition(wallet)
    if (amount > current.current_value) {
      throw new Error('Insufficient position balance')
    }
    if (amount > this.poolStats.total_pool_liquidity) {
      throw new Error('Insufficient available pool liquidity')
    }
    const updated = {
      ...current,
      withdrawn_amount: current.withdrawn_amount + amount,
      current_value: current.current_value - amount,
    }
    this.poolStats.total_deposited -= amount
    this.poolStats.total_pool_liquidity -= amount
    this.lenderPositions.set(wallet, updated)
    return updated
  }

  createDispute(wallet: string, assessmentId: string, reason: string): DisputeRecord {
    const dispute: DisputeRecord = {
      id: `disp-${Date.now().toString(36)}`,
      assessment_id: assessmentId,
      borrower_wallet: wallet,
      dispute_reason: reason,
      status: 'pending',
      created_at: new Date().toISOString(),
    }
    this.disputes.unshift(dispute)
    return dispute
  }

  listDisputes(): DisputeRecord[] {
    return [...this.disputes]
  }

  resolveDispute(
    disputeId: string,
    notes: string,
    status: 'resolved_adjusted' | 'rejected'
  ): DisputeRecord {
    const d = this.disputes.find((item) => item.id === disputeId)
    if (!d) throw new Error('Dispute not found')
    d.status = status
    d.reviewer_notes = notes
    d.resolved_at = new Date().toISOString()
    return d
  }
}

export const mockStore = new InBrowserDemoStore()
export const api = new ApiClient()
