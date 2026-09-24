import Link from 'next/link'
import { Card } from '@/components/ui/card'

const TAREFAS_HREF = '/dashboard/ferramentas/tarefas'
const MAX_ITEMS = 5

export interface PendingTaskItem {
  id: string
  titulo: string
  nome: string
  criadoEm: string
}

interface PendingTasksCardProps {
  paraMim: PendingTaskItem[]
  aguardandoOutros: PendingTaskItem[]
  // Só admin: total de pendentes da empresa toda.
  totalEmpresa?: number | null
}

function diasDesde(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'há 1 dia'
  return `há ${dias} dias`
}

function TaskList({ items, prefix }: { items: PendingTaskItem[]; prefix: string }) {
  return (
    <ul className="space-y-2.5">
      {items.slice(0, MAX_ITEMS).map(t => (
        <li key={t.id}>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug line-clamp-2">{t.titulo}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{prefix} {t.nome} · {diasDesde(t.criadoEm)}</p>
        </li>
      ))}
      {items.length > MAX_ITEMS && (
        <li className="text-xs text-gray-400 dark:text-gray-500">+ {items.length - MAX_ITEMS} outra{items.length - MAX_ITEMS > 1 ? 's' : ''}</li>
      )}
    </ul>
  )
}

export function PendingTasksCard({ paraMim, aguardandoOutros, totalEmpresa }: PendingTasksCardProps) {
  return (
    <Card padding="6" className="border-l-4 border-indigo-600">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500">Tarefas pendentes</p>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          {paraMim.length} para mim
        </span>
      </div>

      {paraMim.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma tarefa pendente para você. 🎉</p>
      ) : (
        <TaskList items={paraMim} prefix="De" />
      )}

      {aguardandoOutros.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-2">
            Aguardando outros ({aguardandoOutros.length})
          </p>
          <TaskList items={aguardandoOutros} prefix="Com" />
        </div>
      )}

      {totalEmpresa != null && (
        <p className="mt-5 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
          Pendentes na empresa toda: <span className="font-semibold text-gray-700 dark:text-gray-200">{totalEmpresa}</span>
        </p>
      )}

      <Link href={TAREFAS_HREF} className="inline-block mt-4 text-xs font-semibold text-brand-navy dark:text-gray-300 hover:underline">
        Abrir Tarefas →
      </Link>
    </Card>
  )
}
