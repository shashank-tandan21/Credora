import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'
interface ModalProps { isOpen: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; maxWidth?: 'sm' | 'md' | 'lg' | 'xl' }
export const Modal = ({ isOpen, onClose, title, description, children, maxWidth = 'md' }: ModalProps) => {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    if (!isOpen) return
    const element = dialog.current!
    const trigger = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = overflow; if (trigger?.isConnected) trigger.focus() }
  }, [isOpen])
  if (!isOpen) return null
  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    onCancel={event => { event.preventDefault(); close.current() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0)
      const first = targets[0]
      const last = targets[targets.length - 1]
      if (!first) { event.preventDefault(); event.currentTarget.focus(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}
    onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close.current() } }}
    className={cn('modal-surface', { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }[maxWidth])}>
    <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
      <div><h2 id={titleId} className="text-xl font-semibold">{title}</h2>{description && <p id={descriptionId} className="text-sm text-muted mt-2">{description}</p>}</div>
      <button type="button" className="icon-button shrink-0" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>
    </div><div className="pt-5">{children}</div>
  </dialog>, document.body)
}

