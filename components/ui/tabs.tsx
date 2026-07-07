'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TabDef<T extends string> {
  key: T
  label: string
  count: number
  border: string
  text: string
}

interface TabsProps<T extends string> {
  tabs: TabDef<T>[]
  activeTab: T
  onChange: (key: T) => void
}

export function Tabs<T extends string>({ tabs, activeTab, onChange }: TabsProps<T>) {
  return (
    <div className="flex border-b border-gray-100 overflow-x-auto">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
            activeTab === tab.key ? `${tab.border} ${tab.text} bg-white` : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          )}
        >
          {tab.label}
          <span
            className={cn(
              'text-xs font-semibold px-1.5 py-0.5 rounded-full',
              activeTab === tab.key ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
            )}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  )
}

// Troca a `key` a cada mudança de aba, forçando o React a remontar o painel
// e disparar o fade-in de novo — assim a troca de aba não parece um corte seco.
export function TabPanel({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  return (
    <div key={tabKey} className="animate-fade-in">
      {children}
    </div>
  )
}
