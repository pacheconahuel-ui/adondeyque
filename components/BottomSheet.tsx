'use client'
import { cn } from '@/lib/utils'

export default function BottomSheet({
  open, onClose, children, desktopCenter, className,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  desktopCenter?: boolean
  className?: string
}) {
  if (!open) return null
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-black/50 flex items-end',
        desktopCenter && 'sm:items-center sm:justify-center'
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-white rounded-t-2xl w-full p-6 max-h-[90vh] overflow-y-auto',
          desktopCenter && 'sm:rounded-2xl sm:max-w-md sm:max-h-[85vh]',
          className
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className={cn('w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5', desktopCenter && 'sm:hidden')} />
        {children}
        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      </div>
    </div>
  )
}
