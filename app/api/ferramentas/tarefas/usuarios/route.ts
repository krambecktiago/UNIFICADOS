export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getTarefasSession, getEligibleUserIds, getUserNames } from '@/lib/tarefas/server'

// Lista quem pode receber tarefa (tem a ferramenta liberada ou é admin),
// pro select de "Atribuir para". Devolve só id + nome — nada de email ou
// papel, já que qualquer usuário da ferramenta chama essa rota.
export async function GET() {
  const { user, hasAccess } = await getTarefasSession()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!hasAccess) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const ids = [...await getEligibleUserIds()]
  const names = await getUserNames(ids)
  const users = ids
    .map(id => ({ id, name: names.get(id) ?? '—' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return NextResponse.json({ data: users })
}
