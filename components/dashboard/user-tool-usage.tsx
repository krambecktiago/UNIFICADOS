'use client'

import { useState } from 'react'
import { formatRelativeTime } from '@/lib/utils'

// Considera "online agora" se o heartbeat (a cada 2min, ver
// components/dashboard/presence-heartbeat.tsx) bateu nos últimos 5min —
// dá margem pra uma batida perdida sem piscar o indicador à toa.
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

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
  lastSeenAt: string | null
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
        const isOnline = !!u.lastSeenAt && Date.now() - new Date(u.lastSeenAt).getTime() < ONLINE_THRESHOLD_MS
        return (
          <div key={u.id}>
            <button
              type="button"
              onClick={() => toggle(u.id)}
              className="w-full flex items-center gap-3 py-3 text-left"
            >
              <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-full bg-brand-navy flex items-center justify-center text-white text-xs font-bold">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                {isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-900" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  {u.name}{u.id === currentUserId ? ' (você)' : ''}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                  {u.lastSeenAt ? `Visto por último: ${formatRelativeTime(u.lastSeenAt)}` : 'Nunca acessou'}
                </p>
              </div>
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
