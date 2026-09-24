export const runtime = 'nodejs'

import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Janela das conclusões avisadas pro criador — evita devolver o histórico
// inteiro a cada consulta; o notificador só precisa do que é recente.
const CONCLUIDAS_JANELA_DIAS = 7

// Consultada a cada 10s pelo TarefasNotifier em qualquer página do
// dashboard, então é propositalmente enxuta: sem checagem de acesso à
// ferramenta (a RLS já limita às tarefas em que o usuário é criador ou
// responsável) e nomes só via profiles, sem listar usuários do Auth.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const desde = new Date(Date.now() - CONCLUIDAS_JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: novas }, { data: concluidas }, { data: pendentes }] = await Promise.all([
    supabase
      .from('tarefas')
      .select('id, titulo, criado_por, criado_em')
      .eq('atribuido_para', user.id)
      .eq('status', 'pendente')
      .neq('criado_por', user.id),
    supabase
      .from('tarefas')
      .select('id, titulo, atribuido_para, concluido_em')
      .eq('criado_por', user.id)
      .eq('status', 'concluida')
      .neq('atribuido_para', user.id)
      .gte('concluido_em', desde),
    // Base da assinatura: toda pendente em que o usuário está envolvido.
    // Filtro explícito por usuário porque pra admin a RLS devolve todas.
    supabase
      .from('tarefas')
      .select('id, atualizado_em')
      .eq('status', 'pendente')
      .or(`atribuido_para.eq.${user.id},criado_por.eq.${user.id}`),
  ])

  // Muda quando qualquer pendente do usuário é criada, editada, reatribuída,
  // concluída ou excluída — o notificador usa isso pra atualizar a tela
  // mesmo quando a mudança não gera aviso (ex.: exclusão).
  const assinatura = createHash('sha1')
    .update((pendentes ?? []).map(t => `${t.id}:${t.atualizado_em}`).sort().join('|'))
    .digest('hex')

  const ids = [...new Set([
    ...(novas ?? []).map(t => t.criado_por).filter((id): id is string => !!id),
    ...(concluidas ?? []).map(t => t.atribuido_para),
  ])]

  const nameMap = new Map<string, string>()
  if (ids.length > 0) {
    const { data: profiles } = await createAdminClient().from('profiles').select('id, full_name').in('id', ids)
    ;(profiles ?? []).forEach(p => nameMap.set(p.id, p.full_name ?? 'Alguém'))
  }

  return NextResponse.json({
    assinatura,
    novas: (novas ?? []).map(t => ({
      id: t.id,
      titulo: t.titulo,
      nome: (t.criado_por && nameMap.get(t.criado_por)) || 'Alguém',
    })),
    concluidas: (concluidas ?? []).map(t => ({
      id: t.id,
      titulo: t.titulo,
      nome: nameMap.get(t.atribuido_para) ?? 'Alguém',
      concluidoEm: t.concluido_em,
    })),
  })
}
