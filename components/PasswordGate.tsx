'use client'
import { useEffect, useState } from 'react'

const APP_PASSWORD = process.env.NEXT_PUBLIC_APP_PASSWORD

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false)
  const [unlocked, setUnlocked] = useState(!APP_PASSWORD)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    (() => {
      if (!APP_PASSWORD) { setChecked(true); return }
      if (sessionStorage.getItem('ayq_auth') === '1') setUnlocked(true)
      setChecked(true)
    })()
  }, [])

  function checkLogin(e: React.FormEvent) {
    e.preventDefault()
    if (input === APP_PASSWORD) {
      sessionStorage.setItem('ayq_auth', '1')
      setUnlocked(true)
      setError('')
    } else {
      setError('Contraseña incorrecta, intentá de nuevo.')
      setInput('')
    }
  }

  if (!checked) return null
  if (unlocked) return <>{children}</>

  return (
    <div className="fixed inset-0 z-[9999] bg-[#18181A] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ayq.png" alt="Adonde y Que" className="h-8 mx-auto mb-4" />
        <div className="text-sm text-gray-400 mb-6">Ingresá la contraseña para continuar</div>
        <form onSubmit={checkLogin} className="flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="••••••••"
            className="w-full h-11 border border-[#E2DFD8] rounded-xl text-center tracking-widest outline-none focus:border-amber-400"
          />
          <button type="submit" className="w-full h-11 bg-[#18181A] text-white rounded-xl font-semibold">
            Entrar
          </button>
        </form>
        {error && <div className="text-red-500 text-xs mt-3">{error}</div>}
      </div>
    </div>
  )
}
