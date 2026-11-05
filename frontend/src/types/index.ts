export type UserRole = 'borrower' | 'lender' | 'reviewer' | 'admin'

export type IdentityStatus = 'pending' | 'registered'

export type RiskCategory = 'High risk' | 'Moderate risk' | 'Fair' | 'Good' | 'Strong'

export type AssessmentStatus = 'active' | 'expired' | 'disputed'

export type LoanStatus = 'requested' | 'approved' | 'disbursed' | 'active' | 'overdue' | 'repaid'

export type RepaymentStatus = 'scheduled' | 'paid' | 'overdue'

export interface AuthenticatedUser {
  wallet_address: string
  role: UserRole
  demo_mode: boolean
}

export interface BorrowerProfile {
  id: string
  wallet_address: string
  display_name: string
  bio: string | null
  identity_status: IdentityStatus
  registration_transaction_hash: string | null
  created_at: string
}

export interface EvidenceSubmission {
  id?: string
  evidence_type: string
  period_months: number
  repayment_history_score: number
  affordability_score: number
  cash_flow_stability_score: number
  debt_burden_score: number
  evidence_quality_score: number
  notes?: string | null
  created_at?: string
}

export interface ScoreComponent {
  name: string
  raw_score: number
  weight: number
  contribution: number
}

export interface CreditAssessment {
  id: string
  score: number
  risk_category: RiskCategory
  components: ScoreComponent[]
  explanation: string[]
  academic_model: boolean
  valid_from: string
  expires_at: string
  status: AssessmentStatus
}

export interface RepaymentInstallment {
  installment_number: number
  due_date: string
  amount: number
  status: RepaymentStatus
}

export interface LoanQuote {
  amount: number
  eligible_limit: number
  interest_rate: number
  interest_amount: number
  total_repayment: number
  duration_days: int
  installments: RepaymentInstallment[]
}

type int = number

export interface LoanRequest extends LoanQuote {
  id: string
  wallet_address: string
  status: LoanStatus
  created_at: string
}

export interface PoolStatistics {
  total_pool_liquidity: number
  total_deposited: number
  total_active_loans: number
  total_outstanding_principal: number
  utilization_rate: number
}

export interface LenderPosition {
  deposited_amount: number
  withdrawn_amount: number
  pool_share: number
  current_value: number
}

export interface RecoveryMilestone {
  id: string
  description: string
  due_date: string
  target_amount: number
  completed: boolean
  completed_at?: string | null
}

export interface RecoveryRequest {
  id: string
  loan_id: string
  borrower_wallet: string
  reason: string
  status: 'pending' | 'in_progress' | 'completed' | 'defaulted'
  total_restructured_amount: number
  milestones: RecoveryMilestone[]
  created_at: string
}

export interface DisputeRecord {
  id: string
  assessment_id: string
  borrower_wallet: string
  dispute_reason: string
  status: 'pending' | 'under_review' | 'resolved_adjusted' | 'rejected'
  reviewer_notes?: string | null
  resolved_at?: string | null
  created_at: string
}

/** Wallet transaction lifecycle. `submitted` and `pending` are never success. */
export type TransactionPhase = 'prepared' | 'submitted' | 'pending' | 'confirmed' | 'failed'

export type TransactionFailureKind =
  | 'rejected'
  | 'reverted'
  | 'timeout'
  | 'replaced'
  | 'wrong_chain'
  | 'not_configured'
  | 'error'

export interface TransactionStatus {
  hash?: string
  hashes?: string[]
  sender?: string
  recipient?: string
  gasCost?: string
  gasUsed?: string
  gasPrice?: string
  state: 'idle' | TransactionPhase
  title: string
  description?: string
  error?: string
  failureKind?: TransactionFailureKind
  /** Lifecycle index where a failure happened: 0 prepare, 1 wallet submit, 2 pending receipt. */
  failedStep?: number
  stepIndex?: number
  stepCount?: number
}

export type NetworkMode = 'demo' | 'onchain'

export interface ChainConfig {
  demo_mode: boolean
  chain_id: number
  network: 'sepolia' | 'hardhat-local' | 'unsupported'
  rpc_configured: boolean
  contracts_configured: boolean
  confirmations: number
  contracts: Record<string, string | null>
}
