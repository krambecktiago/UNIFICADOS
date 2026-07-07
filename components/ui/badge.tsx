import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const TONE_CLASS = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-800',
  orange: 'bg-orange-100 text-orange-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-700',
  sky: 'bg-sky-100 text-sky-700',
  gray: 'bg-gray-100 text-gray-600',
  navy: 'bg-brand-navy/10 text-brand-navy',
} as const

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof TONE_CLASS
}

export function Badge({ tone = 'gray', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', TONE_CLASS[tone], className)}
      {...props}
    />
  )
}
