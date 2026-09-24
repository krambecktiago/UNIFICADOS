export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getTarefasSession, getUserNames } from '@/lib/tarefas/server'

const MAX_ENTRIES = 500

export async function GET() {
  const { supabase, user, isAdmin } = await getTarefasSession()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!isAdmin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { data, error } = await supabase
    .from('tarefas_log')
    .select('id, tarefa_id, tarefa_titulo, user_id, acao, detalhe, criado_em')
    .order('criado_em', { ascending: false })
    .limit(MAX_ENTRIES)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const names = await getUserNames((data ?? []).map(l => l.user_id ?? ''))
  return NextResponse.json({
    data: (data ?? []).map(l => ({ ...l, user_nome: l.user_id ? (names.get(l.user_id) ?? 'Usuário removido') : 'Usuário removido' })),
  })
}
