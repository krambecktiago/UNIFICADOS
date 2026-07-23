'use client'

import { useState } from 'react'

interface ToolCount {
  slug: string
  label: string
  count: number
}

export interface UserToolBreakdown {
  id: string
  name: string
  total: number
  tools: ToolCount[]
}

export function UserToolUsageList({ users, currentUserId }: { users: UserToolBreakdown[]; currentUserId: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {users.map(u => {
        const isOpen = expanded.has(u.id)
        return (
          <div key={u.id}>
            <button
              type="button"
              onClick={() => toggle(u.id)}
              className="w-full flex items-center gap-3 py-3 text-left"
            >
              <div className="w-7 h-7 rounded-full bg-brand-navy flex items-center justify-center text-white text-xs font-bold shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">
                {u.name}{u.id === currentUserId ? ' (você)' : ''}
              </span>
              <span className="text-gray-400 dark:text-gray-500 text-xs shrink-0">{u.total}x</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {isOpen && (
              <div className="pb-3 pl-10 space-y-1.5">
                {u.tools.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">Nenhum uso registrado ainda.</p>
                ) : (
                  u.tools.map(tool => (
                    <div key={tool.slug} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{tool.label}</span>
                      <span className="text-gray-500 dark:text-gray-400 font-medium tabular-nums">{tool.count}x</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
