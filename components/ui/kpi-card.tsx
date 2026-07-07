'use client'

import { ReactNode } from 'react'
import { useCountUp } from '@/lib/hooks/use-count-up'

interface KpiCardProps {
  label: string
  value: number
  format?: (n: number) => string
  sub?: string
  accent: string
  icon?: ReactNode
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString('pt-BR')

export function KpiCard({ label, value, format = defaultFormat, sub, accent, icon }: KpiCardProps) {
  const animated = useCountUp(value)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 border-l-4 animate-fade-in-up" style={{ borderLeftColor: accent }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {icon && (
          <div
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: accent }}
          >
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{format(animated)}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
