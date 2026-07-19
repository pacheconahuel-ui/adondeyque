'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, LayoutDashboard, Users, Contact, Banknote, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import PasswordGate from '@/components/PasswordGate'

const NAV = [
  { href: '/calendario',  label: 'Calendario',  icon: CalendarDays },
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/grupos',      label: 'Grupos',      icon: Users },
  { href: '/pasajeros',   label: 'Pasajeros',   icon: Contact },
  { href: '/cobros',      label: 'Cobros',      icon: Banknote },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <PasswordGate>
      <div className="min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-[#18181A] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ayq-icon.png" alt="Adonde y Que" className="w-6 h-6 rounded-full" />
            <span className="font-semibold text-sm tracking-wide">Adonde y Que</span>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 rounded-lg">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="fixed inset-0 z-30 bg-[#18181A] text-white pt-16 px-6 flex flex-col gap-2">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href} href={href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-4 rounded-xl text-base font-medium transition-colors',
                  pathname.startsWith(href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-300 hover:bg-white/10'
                )}
              >
                <Icon size={20} />
                {label}
              </Link>
            ))}
          </div>
        )}

        {/* Content */}
        <main className="flex-1 pb-20">
          {children}
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2DFD8] px-2 py-2 flex justify-around">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link key={href} href={href} className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors',
                active ? 'text-amber-600' : 'text-gray-400'
              )}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </PasswordGate>
  )
}
