'use client'
import { cn } from '@/lib/utils'

export const inputClass = 'w-full px-3 py-2 text-sm bg-white border border-[#E2DFD8] rounded-xl outline-none focus:border-amber-400'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, className)} {...props} />
}

export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      {children}
    </label>
  )
}
