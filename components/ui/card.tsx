import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: '5' | '6'
  hover?: boolean
  animate?: boolean
}

const PADDING_CLASS = { '5': 'p-5', '6': 'p-6' } as const

export function Card({ padding = '5', hover, animate = true, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl',
        PADDING_CLASS[padding],
        hover && 'transition-all hover:shadow-xl',
        animate && 'animate-fade-in-up',
        className
      )}
      {...props}
    />
  )
}

// Wrapper de tabela — sem padding, cantos cortam o cabeçalho da tabela.
export function TableCard({ className, animate = true, ...props }: HTMLAttributes<HTMLDivElement> & { animate?: boolean }) {
  return (
    <div
      className={cn('bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden', animate && 'animate-fade-in-up', className)}
      {...props}
    />
  )
}
