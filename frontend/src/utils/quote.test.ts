import { expect, it } from 'vitest'
import { isCurrentQuote } from './quote'
import type { LoanQuote } from '../types'
const quote: LoanQuote = { amount: 500, eligible_limit: 1000, duration_days: 90, interest_rate: 12, interest_amount: 14.79, total_repayment: 514.79, installments: [] }
it('rejects stale quotes during input changes and reduced eligibility', () => {
  expect(isCurrentQuote(quote, 500, 90, 1000)).toBe(true)
  expect(isCurrentQuote(quote, 600, 90, 1000)).toBe(false)
  expect(isCurrentQuote(quote, 500, 180, 1000)).toBe(false)
  expect(isCurrentQuote(quote, 500, 90, 400)).toBe(false)
})
it('rejects missing, nonfinite and out-of-range quotes', () => {
  expect(isCurrentQuote(null, 500, 90, 1000)).toBe(false)
  expect(isCurrentQuote(quote, NaN, 90, 1000)).toBe(false)
  expect(isCurrentQuote({ ...quote, amount: 0 }, 0, 90, 1000)).toBe(false)
  expect(isCurrentQuote({ ...quote, total_repayment: NaN }, 500, 90, 1000)).toBe(false)
})
