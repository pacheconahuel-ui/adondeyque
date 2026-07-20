'use client'

export default function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2DFD8] p-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ayq-icon.png" alt="" className="w-16 h-16 mx-auto mb-4" />
      <h2 className="text-base font-semibold text-[#18181A] mb-2">{title}</h2>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  )
}
