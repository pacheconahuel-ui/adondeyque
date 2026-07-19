'use client'

export default function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2.5 mb-3">
      {message}
    </div>
  )
}
