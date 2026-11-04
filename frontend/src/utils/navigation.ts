export type WorkspacePage = 'overview' | 'borrower' | 'lender' | 'reviewer'
export type BorrowerSection = 'overview' | 'credit' | 'borrow'
export function parseRoute(hash: string): { page: WorkspacePage; section: BorrowerSection } {
  const [page, section] = hash.replace(/^#\/?/, '').split('/')
  if (page === 'borrower') return { page, section: section === 'credit' || section === 'borrow' ? section : 'overview' }
  if (page === 'lender' || page === 'reviewer') return { page, section: 'overview' }
  return { page: 'overview', section: 'overview' }
}
export function routeHash(target: string): string {
  if (target === 'credit') return '#/borrower/credit'
  if (target === 'borrow' || target === 'loans') return '#/borrower/borrow'
  if (target === 'borrower' || target === 'lender' || target === 'reviewer') return '#/' + target
  return '#/'
}
