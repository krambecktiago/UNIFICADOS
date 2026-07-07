import { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="h-[68px] bg-white border-b border-gray-200 px-8 flex items-center justify-between">
      <div>
        <h1 className="text-base font-bold text-gray-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 leading-tight mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}
