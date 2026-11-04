import React, { useState } from 'react'
import { BadgeCheck, Gavel, LifeBuoy, Landmark, ShieldCheck, XCircle } from 'lucide-react'
import { isAddress } from 'viem'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../common/Card'
import { Input } from '../common/Input'
import { OnChainNotice } from './WalletControl'
import { truncateAddress } from '../../utils/cn'
import { chainNow, steps } from '../../web3/actions'
import { networkLabel } from '../../web3/config'
import { DISPUTE_STATUS, LOAN_STATUS, RECOVERY_STATUS } from '../../web3/contracts'
import {
  useDisputeQueue,
  useLoanLookup,
  useOnChainStatus,
  useOperatorRoles,
  useRecoveryQueue,
} from '../../web3/hooks'
import { formatTimestamp, formatUsdcExact, hashText, isUuid, scoreToBps, uuidToBytes32 } from '../../web3/units'
import { useContractTransaction } from '../../web3/useContractTransaction'

const textareaClass =
  'w-full rounded-lg border border-line bg-surface p-2.5 text-xs text-foreground focus:border-line focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-line dark:bg-surface dark:text-muted'

const RoleChip: React.FC<{ label: string; held: boolean }> = ({ label, held }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
      held
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
        : 'bg-surface text-muted dark:bg-subtle dark:text-muted'
    }`}
  >
    {held ? <BadgeCheck className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
    {label}
  </span>
)

/** Split `total` into `count` milestones; the last absorbs the rounding remainder. */
function buildPlan(total: bigint, count: number, finalDueAt: bigint, now: bigint) {
  const per = total / BigInt(count)
  const span = finalDueAt - now
  const amounts = Array.from({ length: count }, (_, i) => (i === count - 1 ? total - per * BigInt(count - 1) : per))
  const dueDates = Array.from({ length: count }, (_, i) => now + (span * BigInt(i + 1)) / BigInt(count))
  return { amounts, dueDates }
}

/** Reviewer/admin console for role-gated contract operations. Roles are read from chain. */
export const OperationsConsole: React.FC = () => {
  const status = useOnChainStatus()
  const roles = useOperatorRoles()
  const disputes = useDisputeQueue()
  const recoveries = useRecoveryQueue()
  const { run, isRunning } = useContractTransaction()
  const disabled = !status.canTransact || isRunning

  const [borrower, setBorrower] = useState('')
  const [score, setScore] = useState('71')
  const [validityDays, setValidityDays] = useState('90')
  const [assessmentId, setAssessmentId] = useState<string>('')
  const [formError, setFormError] = useState<string | null>(null)

  const [loanIdInput, setLoanIdInput] = useState('')
  const lookupId = /^\d+$/.test(loanIdInput) && loanIdInput !== '0' ? BigInt(loanIdInput) : undefined
  const lookup = useLoanLookup(lookupId)
  const lookupStatus = lookup.loan && lookup.loan.status > 0 ? LOAN_STATUS[lookup.loan.status] : undefined

  const [notes, setNotes] = useState<Record<string, string>>({})
  const [milestoneCounts, setMilestoneCounts] = useState<Record<string, string>>({})
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({})

  const attest = async (e: React.FormEvent) => {
    e.preventDefault()
    const scoreValue = Number(score)
    const days = Number(validityDays)
    if (!isAddress(borrower)) return setFormError('Enter a valid borrower wallet address.')
    if (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 100) return setFormError('Score must be between 0 and 100.')
    if (!Number.isInteger(days) || days < 1 || days > 365) return setFormError('Validity must be 1-365 days.')
    if (!isUuid(assessmentId)) return setFormError('Assessment id must be a UUID (use the backend assessment id).')
    setFormError(null)
    const expiresAt = (await chainNow()) + BigInt(days * 86_400)
    const result = await run(
      'Publish score attestation',
      steps.attestScore(borrower, uuidToBytes32(assessmentId), scoreToBps(scoreValue), expiresAt),
    )
    if (result) setAssessmentId(crypto.randomUUID())
  }

  const resolveDispute = async (id: bigint, upheld: boolean) => {
    const text = notes[id.toString()]?.trim()
    if (!text) return
    const result = await run(upheld ? 'Uphold dispute' : 'Reject dispute', steps.resolveDispute(id, upheld, hashText(text)))
    if (result) setNotes((current) => ({ ...current, [id.toString()]: '' }))
  }

  const decideRecovery = async (id: bigint, total: bigint, finalDueAt: bigint, approve: boolean) => {
    const key = id.toString()
    const text = notes[`r${key}`]?.trim()
    if (!text) {
      setPlanErrors((current) => ({ ...current, [key]: 'Decision notes are required.' }))
      return
    }
    if (!approve) {
      await run('Reject recovery request', steps.rejectRecovery(id, hashText(text)))
      return
    }
    const count = Number(milestoneCounts[key] ?? '2')
    const now = await chainNow()
    if (!Number.isInteger(count) || count < 1 || count > 12) {
      setPlanErrors((current) => ({ ...current, [key]: 'Use 1-12 milestones.' }))
      return
    }
    if (finalDueAt <= now + BigInt(count) * 3_600n) {
      setPlanErrors((current) => ({ ...current, [key]: 'The proposed due date is too close or has passed; reject and ask for a new request.' }))
      return
    }
    setPlanErrors((current) => ({ ...current, [key]: '' }))
    const plan = buildPlan(total, count, finalDueAt, now)
    await run('Approve recovery plan', steps.approveRecovery(id, plan.amounts, plan.dueDates, hashText(text)))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              On-chain Operations
            </CardTitle>
            <CardDescription>
              Role-gated contract actions on {networkLabel}. Roles are enforced by the contracts, not by this page.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {status.canTransact && roles.loaded && <>
            <RoleChip label="Attester" held={roles.attester} />
            <RoleChip label="Funder" held={roles.funder} />
            <RoleChip label="Reviewer" held={roles.reviewer} />
            <RoleChip label="Recovery officer" held={roles.recoveryOfficer} />
            </>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <OnChainNotice action="run reviewer operations" />
        {status.canTransact && !roles.loaded && <p role="status" className="text-sm text-muted">{roles.error ? 'Permissions could not be checked. Actions remain unavailable.' : 'Checking permissions…'}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attestation */}
          <section aria-labelledby="ops-attest" className="space-y-3">
            <h3 id="ops-attest" className="text-sm font-semibold text-foreground dark:text-foreground flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-accent" /> Publish score attestation
            </h3>
            <form onSubmit={attest} className="space-y-3">
              <Input label="Borrower wallet" placeholder="0x…" value={borrower} onChange={(e) => setBorrower(e.target.value.trim())} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Score (0-100)" type="number" min="0" max="100" step="0.01" value={score} onChange={(e) => setScore(e.target.value)} required />
                <Input label="Validity (days)" type="number" min="1" max="365" step="1" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} required />
              </div>
              <Input
                label="Assessment id (backend UUID)"
                value={assessmentId}
                onChange={(e) => setAssessmentId(e.target.value.trim())}
                helperText="Use the backend assessment id so on-chain and off-chain records link up."
                required
              />
              {formError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{formError}</p>}
              <Button type="submit" size="sm" disabled={disabled || !roles.attester} title={roles.attester ? undefined : 'Requires ATTESTER_ROLE'}>
                Attest score
              </Button>
            </form>
          </section>

          {/* Loan operations */}
          <section aria-labelledby="ops-loans" className="space-y-3">
            <h3 id="ops-loans" className="text-sm font-semibold text-foreground dark:text-foreground flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-500" /> Loan operations
            </h3>
            <Input label="Loan id" inputMode="numeric" placeholder="e.g. 1" value={loanIdInput} onChange={(e) => setLoanIdInput(e.target.value.trim())} />
            {lookupId !== undefined && (
              lookup.loan && lookupStatus ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-surface dark:bg-subtle text-xs font-mono">
                    <span className="text-muted font-sans">Status</span>
                    <span>{lookupStatus}</span>
                    <span className="text-muted font-sans">Borrower</span>
                    <span title={lookup.loan.borrower}>{truncateAddress(lookup.loan.borrower)}</span>
                    <span className="text-muted font-sans">Principal</span>
                    <span>{formatUsdcExact(lookup.loan.principal)}</span>
                    <span className="text-muted font-sans">Outstanding</span>
                    <span>{formatUsdcExact(lookup.outstanding)}</span>
                    <span className="text-muted font-sans">Past due</span>
                    <span className={lookup.amountPastDue > 0n ? 'text-rose-600' : ''}>{formatUsdcExact(lookup.amountPastDue)}</span>
                    <span className="text-muted font-sans">Final due</span>
                    <span>{formatTimestamp(lookup.loan.finalDueAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={disabled || !roles.funder || lookupStatus !== 'Requested'} onClick={() => run('Fund loan', steps.fundLoan(lookupId))}>
                      Fund & disburse
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled || lookup.amountPastDue === 0n || (lookupStatus !== 'Active' && lookupStatus !== 'Restructured')}
                      onClick={() => run('Mark loan overdue', steps.markOverdue(lookupId))}
                    >
                      Mark overdue
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={disabled || !roles.funder || lookupStatus !== 'Overdue'}
                      onClick={() => run('Mark loan defaulted', steps.markDefaulted(lookupId))}
                      title="Allowed 60 days after the final due date; unrepaid principal becomes a pool loss"
                    >
                      Mark defaulted
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">No loan with id {loanIdInput} on {networkLabel}.</p>
              )
            )}
          </section>
        </div>

        {/* Disputes */}
        <section aria-labelledby="ops-disputes" className="space-y-3">
          <h3 id="ops-disputes" className="text-sm font-semibold text-foreground dark:text-foreground flex items-center gap-2">
            <Gavel className="w-4 h-4 text-accent" /> On-chain disputes
          </h3>
          {disputes.length === 0 ? (
            <p className="text-xs text-muted">No disputes have been opened on-chain.</p>
          ) : (
            <ul className="space-y-2">
              {disputes.map((dispute) => {
                const key = dispute.id.toString()
                const statusName = DISPUTE_STATUS[dispute.status]
                return (
                  <li key={key} className="rounded-xl border border-line dark:border-line p-3 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-semibold">Dispute #{key}</span>
                      <Badge variant={statusName === 'Open' ? 'warning' : statusName === 'Upheld' ? 'success' : 'default'} size="sm">
                        {statusName}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 font-mono text-muted dark:text-muted">
                      <span title={dispute.borrower}>Borrower {truncateAddress(dispute.borrower)}</span>
                      <span title={dispute.assessmentId}>Assessment {truncateAddress(dispute.assessmentId, 6)}</span>
                      <span>Opened {formatTimestamp(dispute.openedAt)}</span>
                    </div>
                    {statusName === 'Open' && (
                      <div className="space-y-2">
                        <label htmlFor={`dispute-notes-${key}`} className="block text-xs text-muted">
                          Resolution notes (required; the hash is recorded on-chain)
                        </label>
                        <textarea
                          id={`dispute-notes-${key}`}
                          rows={2}
                          className={textareaClass}
                          value={notes[key] ?? ''}
                          onChange={(e) => setNotes((current) => ({ ...current, [key]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" disabled={disabled || !roles.reviewer || !notes[key]?.trim()} onClick={() => resolveDispute(dispute.id, false)}>
                            Reject claim
                          </Button>
                          <Button size="sm" variant="success" disabled={disabled || !roles.reviewer || !notes[key]?.trim()} onClick={() => resolveDispute(dispute.id, true)}>
                            Uphold (revoke score)
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Recovery */}
        <section aria-labelledby="ops-recovery" className="space-y-3">
          <h3 id="ops-recovery" className="text-sm font-semibold text-foreground dark:text-foreground flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-amber-500" /> Recovery requests
          </h3>
          {recoveries.length === 0 ? (
            <p className="text-xs text-muted">No restructuring requests have been submitted on-chain.</p>
          ) : (
            <ul className="space-y-2">
              {recoveries.map((request) => {
                const key = request.id.toString()
                const statusName = RECOVERY_STATUS[request.status]
                return (
                  <li key={key} className="rounded-xl border border-line dark:border-line p-3 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-semibold">
                        Request #{key} · Loan #{request.loanId.toString()}
                      </span>
                      <Badge variant={statusName === 'Submitted' ? 'warning' : statusName === 'Completed' ? 'success' : 'indigo'} size="sm">
                        {statusName}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 font-mono text-muted dark:text-muted">
                      <span title={request.borrower}>Borrower {truncateAddress(request.borrower)}</span>
                      <span>Proposed {formatUsdcExact(request.proposedOutstanding)}</span>
                      <span>By {formatTimestamp(request.proposedFinalDueAt)}</span>
                    </div>
                    {statusName === 'Submitted' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                          <Input
                            label="Milestones (1-12)"
                            type="number"
                            min="1"
                            max="12"
                            value={milestoneCounts[key] ?? '2'}
                            onChange={(e) => setMilestoneCounts((current) => ({ ...current, [key]: e.target.value }))}
                          />
                          <div className="sm:col-span-2 space-y-1">
                            <label htmlFor={`recovery-notes-${key}`} className="block text-xs text-muted">
                              Decision notes (required; hash recorded)
                            </label>
                            <textarea
                              id={`recovery-notes-${key}`}
                              rows={1}
                              className={textareaClass}
                              value={notes[`r${key}`] ?? ''}
                              onChange={(e) => setNotes((current) => ({ ...current, [`r${key}`]: e.target.value }))}
                            />
                          </div>
                        </div>
                        {planErrors[key] && <p role="alert" className="text-rose-600 dark:text-rose-400">{planErrors[key]}</p>}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={disabled || !roles.recoveryOfficer}
                            onClick={() => decideRecovery(request.id, request.proposedOutstanding, request.proposedFinalDueAt, false)}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="success"
                            disabled={disabled || !roles.recoveryOfficer}
                            onClick={() => decideRecovery(request.id, request.proposedOutstanding, request.proposedFinalDueAt, true)}
                          >
                            Approve equal milestones
                          </Button>
                        </div>
                      </div>
                    )}
                    {statusName === 'Approved' && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          Progress {request.milestonesCompleted}/{request.milestoneCount} milestones · plan total{' '}
                          {formatUsdcExact(request.approvedOutstanding)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() => run('Complete recovery milestone', steps.completeMilestone(request.id, request.milestonesCompleted))}
                          title="Succeeds only when repayments since approval cover the milestone"
                        >
                          Complete milestone {request.milestonesCompleted + 1}
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
