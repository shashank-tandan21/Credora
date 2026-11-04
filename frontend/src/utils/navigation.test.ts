import { describe, expect, it } from 'vitest'
import { parseRoute, routeHash } from './navigation'
import { formatTokenAmount } from './cn'
describe('workspace deep links', () => {
  it('restores the selected borrower section after a reload', () => {
    expect(parseRoute('#/borrower/credit')).toEqual({ page: 'borrower', section: 'credit' })
    expect(parseRoute(routeHash('loans'))).toEqual({ page: 'borrower', section: 'borrow' })
  })
  it('keeps public anchors and invalid links out of restricted workspaces', () => {
    expect(parseRoute('#how-it-works').page).toBe('overview')
    expect(parseRoute('#/unknown').page).toBe('overview')
    expect(parseRoute('#/borrower/unknown').section).toBe('overview')
  })
  it('does not interpret navigation as authorization', () => {
    expect(parseRoute(routeHash('reviewer'))).toEqual({ page: 'reviewer', section: 'overview' })
  })
})
describe('test-token display', () => {
  it('distinguishes unavailable data from a genuine zero', () => {
    expect(formatTokenAmount(null)).toBe('—')
    expect(formatTokenAmount(NaN)).toBe('—')
    expect(formatTokenAmount(0)).toBe('0.00 mUSDC')
    expect(formatTokenAmount(500)).toBe('500.00 mUSDC')
  })
})
