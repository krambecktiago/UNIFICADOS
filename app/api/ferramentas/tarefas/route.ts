export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  SELECT_FIELDS,
  getTarefasSession,
  getEligibleUserIds,
  withNames,
  logTarefaAcao,
  type TarefaRow,
} from '@/lib/tarefas/server'

export async function GET() {
  const { supabase, user, isAdmin, hasAccess } = await getTarefasSession()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!hasAccess) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  // Client do usuário de propósito: a RLS já devolve só as tarefas em que
  // ele é criador ou responsável — ou todas, se for admin.
  const { data, error } = await supabase
    .from('tarefas')
    .select(SELECT_FIELDS)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // `me` vai junto pra tela saber quais ações mostrar em cada tarefa (concluir,
  // editar, excluir) sem outra chamada só pra descobrir o próprio id.
  return NextResponse.json({
    data: await withNames((data ?? []) as TarefaRow[]),
    me: { id: user.id, isAdmin },
  })
}

export async function POST(request: NextRequest) {
  const { supabase, user, hasAccess } = await getTarefasSession()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!hasAccess) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await request.json().catch(() => null) as {
    titulo?: string
    observacao?: string
    atribuidoPara?: string
  } | null

  const titulo = body?.titulo?.trim()
  const observacao = body?.observacao?.trim() || null
  const atribuidoPara = body?.atribuidoPara

  if (!titulo) return NextResponse.json({ error: 'Informe o título da tarefa.' }, { status: 400 })
  if (!atribuidoPara) return NextResponse.json({ error: 'Escolha para quem é a tarefa.' }, { status: 400 })

  const eligible = await getEligibleUserIds()
  if (!eligible.has(atribuidoPara)) {
    return NextResponse.json({ error: 'Esse usuário não tem acesso à ferramenta de Tarefas.' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('tarefas')
    .insert({ titulo, observacao, atribuido_para: atribuidoPara, criado_por: user.id, status: 'pendente' })
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [withName] = await withNames([data as TarefaRow])
  const responsavel = withName.atribuido_para_nome

  await logTarefaAcao(
    supabase, user.id,
    { tarefaId: data.id, titulo, acao: 'criada', detalhe: `Atribuída para ${responsavel}` },
    { action: 'tool_run', description: `Criou a tarefa "${titulo}" para ${responsavel}` },
  )

  return NextResponse.json({ data: withName })
}
