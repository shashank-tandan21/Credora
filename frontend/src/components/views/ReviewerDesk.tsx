import React, { useState, useEffect } from 'react'
import {
  FileText,
  Scale,
  Sparkles,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'
import { Modal } from '../common/Modal'
import { api } from '../../api/client'
import { OperationsConsole } from '../web3/OperationsConsole'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate, truncateAddress } from '../../utils/cn'
import type { DisputeRecord } from '../../types'

export const ReviewerDesk: React.FC = () => {
  const { networkMode } = useAuth()
  const [disputes, setDisputes] = useState<DisputeRecord[]>([])
  const [selectedDispute, setSelectedDispute] = useState<DisputeRecord | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [isResolving, setIsResolving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  const reloadDisputes = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const list = await api.listDisputes()
      setDisputes(list)
    } catch {
      setLoadError('Could not load disputes. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (networkMode === 'demo') void reloadDisputes()
  }, [networkMode])

  const handleResolve = async (status: 'resolved_adjusted' | 'rejected') => {
    if (!selectedDispute || !reviewNotes.trim()) return
    setIsResolving(true)
    try {
      await api.resolveDispute(selectedDispute.id, reviewNotes, status)
      await reloadDisputes()
      setSelectedDispute(null)
      setReviewNotes('')
      setNotification(
        `Dispute ${selectedDispute.id} has been marked as ${
          status === 'resolved_adjusted' ? 'Approved' : 'Rejected'
        }. Demo decision recorded in this browser only (no blockchain transaction).`
      )
      setTimeout(() => setNotification(null), 6000)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The decision could not be saved.')
    } finally {
      setIsResolving(false)
    }
  }

  if (networkMode === 'onchain') return <OperationsConsole />

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {notification && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-brand-soft border border-line text-accent dark:bg-brand-soft dark:border-line dark:text-accent text-sm font-medium">
          <Sparkles className="w-4 h-4 text-accent dark:text-accent shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="pb-2 border-b border-line dark:border-line">
        <h2 className="text-xl font-semibold tracking-tight text-foreground dark:text-foreground flex items-center gap-2">
          <Scale className="w-5 h-5 text-accent dark:text-accent" />
          Dispute review
        </h2>
        <p className="text-sm text-muted dark:text-muted mt-0.5">
          Review assessment disputes and record a decision.
        </p>
      </div>

      {loadError && <div role="alert" className="inline-notice"><p>{loadError}</p><Button onClick={reloadDisputes} variant="outline">Retry</Button></div>}

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                Active Dispute Queue
              </CardTitle>
              <CardDescription>
                Demo queue (simulated in this browser). On-chain disputes appear under On-chain Operations.
              </CardDescription>
            </div>
            <Badge variant="indigo" size="sm">
              {disputes.filter((d) => d.status === 'pending').length} Pending Review
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-line dark:border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface dark:bg-subtle text-muted dark:text-muted border-b border-line dark:border-line">
                <tr>
                  <th className="p-3 font-medium">Dispute ID</th>
                  <th className="p-3 font-medium">Borrower Wallet</th>
                  <th className="p-3 font-medium">Submitted</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Reason Excerpt</th>
                  <th className="p-3 font-medium text-right">Adjudication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 tabular-nums">
                {disputes.length > 0 ? (
                  disputes.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-surface dark:hover:bg-subtle transition-colors"
                    >
                      <td className="p-3 font-semibold text-foreground dark:text-foreground">
                        {item.id}
                      </td>
                      <td className="p-3 text-accent dark:text-accent">
                        {truncateAddress(item.borrower_wallet, 6)}
                      </td>
                      <td className="p-3 text-muted">{formatDate(item.created_at)}</td>
                      <td className="p-3">
                        {item.status === 'pending' ? (
                          <Badge variant="warning" size="sm">
                            Pending
                          </Badge>
                        ) : item.status === 'resolved_adjusted' ? (
                          <Badge variant="success" size="sm">
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="destructive" size="sm">
                            Rejected
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 max-w-xs truncate text-muted dark:text-muted font-sans">
                        {item.dispute_reason || 'Reason text unavailable'}
                      </td>
                      <td className="p-3 text-right">
                        {item.status === 'pending' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-sm"
                            onClick={() => {
                              setSelectedDispute(item)
                              setReviewNotes('')
                            }}
                          >
                            Review & Decide
                          </Button>
                        ) : (
                          <span className="text-sm text-muted italic">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm text-muted font-sans">
                      {isLoading ? 'Loading disputes…' : loadError ? 'Disputes are unavailable.' : 'No disputes to review.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Review Adjudication Modal */}
      <Modal
        isOpen={Boolean(selectedDispute)}
        onClose={() => setSelectedDispute(null)}
        title="Adjudicate Credit Dispute"
        description="Review evidence context, write audit resolution notes, and execute decision."
      >
        {selectedDispute && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-surface dark:bg-subtle border border-line dark:border-line space-y-2 text-sm">
              <div className="flex justify-between tabular-nums">
                <span className="text-muted">Dispute ID:</span>
                <span className="font-semibold text-foreground dark:text-foreground">
                  {selectedDispute.id}
                </span>
              </div>
              <div className="flex justify-between tabular-nums">
                <span className="text-muted">Borrower Wallet:</span>
                <span className="text-accent dark:text-accent">
                  {selectedDispute.borrower_wallet}
                </span>
              </div>
              <div className="pt-2 border-t border-line dark:border-line">
                <span className="text-muted font-medium">Borrower Claim:</span>
                <p className="mt-1 text-foreground dark:text-foreground italic leading-relaxed">
                  "{selectedDispute.dispute_reason}"
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground dark:text-foreground">
                Reviewer Justification & Audit Notes (Required)
              </label>
              <textarea
                required
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="e.g. Verified university payroll remittance slip confirming 4-day administrative delay. Adjusting Cash-Flow factor from 78 to 86."
                className="w-full rounded-lg border border-line bg-surface p-3 text-sm text-foreground placeholder:text-muted focus:border-line focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-line dark:bg-surface dark:text-muted transition-colors"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDispute(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleResolve('rejected')}
                isLoading={isResolving}
                disabled={!reviewNotes.trim()}
              >
                Reject Claim
              </Button>
              <Button
                type="button"
                variant="success"
                size="sm"
                onClick={() => handleResolve('resolved_adjusted')}
                isLoading={isResolving}
                disabled={!reviewNotes.trim()}
              >
                Approve dispute
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
