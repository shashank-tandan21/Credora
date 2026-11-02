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
  const [notification, setNotification] = useState<string | null>(null)

  const reloadDisputes = async () => {
    try {
      const list = await api.listDisputes()
      setDisputes(list)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    reloadDisputes()
  }, [])

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
          status === 'resolved_adjusted' ? 'Approved & Score Adjusted' : 'Rejected'
        }. Demo decision recorded in this browser only (no blockchain transaction).`
      )
      setTimeout(() => setNotification(null), 6000)
    } finally {
      setIsResolving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {notification && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-300 text-xs font-medium">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Scale className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Reviewer & Dispute Adjudication Desk
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Role-protected reviewer queue for credit assessment disputes and workout audits
        </p>
      </div>

      {networkMode === 'onchain' && <OperationsConsole />}

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
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
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-medium">Dispute ID</th>
                  <th className="p-3 font-medium">Borrower Wallet</th>
                  <th className="p-3 font-medium">Submitted</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Reason Excerpt</th>
                  <th className="p-3 font-medium text-right">Adjudication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {disputes.length > 0 ? (
                  disputes.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                        {item.id}
                      </td>
                      <td className="p-3 text-blue-600 dark:text-blue-400">
                        {truncateAddress(item.borrower_wallet, 6)}
                      </td>
                      <td className="p-3 text-slate-500">{formatDate(item.created_at)}</td>
                      <td className="p-3">
                        {item.status === 'pending' ? (
                          <Badge variant="warning" size="sm">
                            Pending
                          </Badge>
                        ) : item.status === 'resolved_adjusted' ? (
                          <Badge variant="success" size="sm">
                            Adjusted
                          </Badge>
                        ) : (
                          <Badge variant="destructive" size="sm">
                            Rejected
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 max-w-xs truncate text-slate-600 dark:text-slate-300 font-sans">
                        {item.dispute_reason}
                      </td>
                      <td className="p-3 text-right">
                        {item.status === 'pending' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setSelectedDispute(item)
                              setReviewNotes('')
                            }}
                          >
                            Review & Decide
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-slate-400 font-sans">
                      No active disputes in the reviewer queue.
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
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Dispute ID:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedDispute.id}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Borrower Wallet:</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {selectedDispute.borrower_wallet}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60">
                <span className="text-slate-500 font-medium">Borrower Claim:</span>
                <p className="mt-1 text-slate-800 dark:text-slate-200 italic leading-relaxed">
                  "{selectedDispute.dispute_reason}"
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Reviewer Justification & Audit Notes (Required)
              </label>
              <textarea
                required
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="e.g. Verified university payroll remittance slip confirming 4-day administrative delay. Adjusting Cash-Flow factor from 78 to 86."
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 transition-colors"
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
                Approve & Adjust
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
