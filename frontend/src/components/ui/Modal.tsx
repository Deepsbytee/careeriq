import { ReactNode, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, description, children, size = 'md', className }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              'relative w-full rounded-2xl glass-strong shadow-card overflow-hidden',
              sizes[size],
              className
            )}
          >
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 p-6 border-b border-ink/5">
                <div>
                  {title && <h2 className="text-lg font-bold text-slate-100">{title}</h2>}
                  {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                  <X size={18} />
                </Button>
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

interface DialogProps extends ModalProps {
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  variant?: 'default' | 'danger'
}

export function Dialog({
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'default',
  onClose,
  ...props
}: DialogProps) {
  return (
    <Modal {...props} onClose={onClose}>
      {props.children}
      {onConfirm && (
        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-ink/5">
          <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      )}
    </Modal>
  )
}
