import { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './spinner'

const VARIANT_CLASS = {
  primary: 'bg-brand-navy text-white hover:bg-brand-navy-hover disabled:hover:bg-brand-navy',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
  ghost: 'text-gray-500 hover:text-gray-800',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASS
  loading?: boolean
}

export function Button({ variant = 'primary', loading, disabled, className, children, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-medium',
        'transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md',
        'disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0 disabled:hover:shadow-none',
        VARIANT_CLASS[variant],
        className
      )}
      {...props}
    >
      {loading && <Spinner size="sm" className={variant === 'primary' ? 'text-white' : 'text-current'} />}
      {children}
    </button>
  )
}
