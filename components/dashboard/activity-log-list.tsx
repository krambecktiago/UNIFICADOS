'use client'

import { useMemo, useState } from 'react'
import { TableCard } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'

export interface ActivityEntry {
  id: string
  userName: string
  action: string
  description: string
  createdAt: string
}

const ACTION_TONE: Record<string, string> = {
  tool_run: 'text-emerald-600 dark:text-emerald-400',
  tool_export: 'text-sky-600 dark:text-sky-400',
  admin_user_create: 'text-purple-600 dark:text-purple-400',
  admin_user_update: 'text-purple-600 dark:text-purple-400',
  admin_tool_toggle: 'text-amber-600 dark:text-amber-400',
  admin_integration_create: 'text-amber-600 dark:text-amber-400',
  admin_integration_update: 'text-amber-600 dark:text-amber-400',
  admin_integration_delete: 'text-red-600 dark:text-red-400',
}

export function ActivityLogList({ entries }: { entries: ActivityEntry[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(e => e.userName.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
  }, [entries, query])

  return (
    <TableCard>
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filtrar por usuário ou ação..."
          className="w-full max-w-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
          {filtered.length.toLocaleString('pt-BR')} {filtered.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[70vh] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">Nenhuma atividade encontrada.</p>
        ) : (
          filtered.map(e => (
            <div key={e.id} className="px-5 py-3">
              <p className="text-sm text-gray-800 dark:text-gray-200">
                <span className="font-medium">{e.userName}</span>
                {' — '}
                <span className={ACTION_TONE[e.action] ?? 'text-gray-500 dark:text-gray-400'}>{e.description}</span>
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{formatDateTime(e.createdAt)}</p>
            </div>
          ))
        )}
      </div>
    </TableCard>
  )
}
