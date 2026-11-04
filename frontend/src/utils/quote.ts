import type { LoanQuote } from '../types'
/** A quote for previous inputs must never authorize a new request. */
export function isCurrentQuote(quote: LoanQuote | null, amount: number, duration: number, limit: number): boolean {
  return !!quote && Number.isFinite(amount) && amount >= 50 && amount <= limit &&
    quote.amount === amount && quote.duration_days === duration &&
    Number.isFinite(quote.total_repayment) && quote.total_repayment >= amount
}
