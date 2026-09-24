export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logToolUsage } from '@/lib/supabase/tool-usage'
import { logActivity } from '@/lib/supabase/activity-log'
import {
  TOOL_SLUG,
  SELECT_FIELDS,
  getTarefasSession,
  getEligibleUserIds,
  getUserNames,
  withNames,
  logTarefa,
  type TarefaRow,
} from '@/lib/tarefas/server'

// Regras de quem pode fazer o quê (a escrita é via service role, então
// tudo é checado aqui):
// - concluir: só o responsável, com explicação obrigatória
// - reabrir: criador ou responsável (ex.: criador não ficou satisfeito)
// - editar: só o criador, e só enquanto pendente
// - excluir: criador ou admin
// Admin enxerga tudo mas não conclui/edita tarefa dos outros.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, hasAccess } = await getTarefasSession()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!hasAccess) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => null) as {
    action?: 'concluir' | 'reabrir' | 'editar'
    explicacao?: string
    titulo?: string
    observacao?: string
    atribuidoPara?: string
  } | null

  const adminClient = createAdminClient()
  const { data: existing } = await adminClient.from('tarefas').select(SELECT_FIELDS).eq('id', id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 })
  const tarefa = existing as TarefaRow

  const isCriador = tarefa.criado_por === user.id
  const isResponsavel = tarefa.atribuido_para === user.id
  const now = new Date().toISOString()

  if (body?.action === 'concluir') {
    if (!isResponsavel) return NextResponse.json({ error: 'Só o responsável pode concluir a tarefa.' }, { status: 403 })
    if (tarefa.status === 'concluida') return NextResponse.json({ error: 'A tarefa já está concluída.' }, { status: 400 })

    const explicacao = body.explicacao?.trim()
    if (!explicacao) return NextResponse.json({ error: 'Explique como a tarefa foi concluída.' }, { status: 400 })

    const { data, error } = await adminClient
      .from('tarefas')
      .update({ status: 'concluida', explicacao_conclusao: explicacao, concluido_em: now, atualizado_em: now })
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logTarefa(id, tarefa.titulo, user.id, 'concluida', explicacao)
    await logToolUsage(supabase, user.id, TOOL_SLUG, 0)
    await logActivity(user.id, 'tool_run', `Concluiu a tarefa "${tarefa.titulo}"`)

    const [withName] = await withNames([data as TarefaRow])
    return NextResponse.json({ data: withName })
  }

  if (body?.action === 'reabrir') {
    if (!isCriador && !isResponsavel) return NextResponse.json({ error: 'Só o criador ou o responsável podem reabrir a tarefa.' }, { status: 403 })
    if (tarefa.status === 'pendente') return NextResponse.json({ error: 'A tarefa já está pendente.' }, { status: 400 })

    // A explicação anterior fica registrada no log (ação "concluida"), então
    // pode ser limpa aqui sem perder o histórico.
    const { data, error } = await adminClient
      .from('tarefas')
      .update({ status: 'pendente', explicacao_conclusao: null, concluido_em: null, atualizado_em: now })
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logTarefa(id, tarefa.titulo, user.id, 'reaberta')
    await logToolUsage(supabase, user.id, TOOL_SLUG, 0)
    await logActivity(user.id, 'tool_run', `Reabriu a tarefa "${tarefa.titulo}"`)

    const [withName] = await withNames([data as TarefaRow])
    return NextResponse.json({ data: withName })
  }

  if (body?.action === 'editar') {
    if (!isCriador) return NextResponse.json({ error: 'Só quem criou a tarefa pode editá-la.' }, { status: 403 })
    if (tarefa.status === 'concluida') return NextResponse.json({ error: 'Reabra a tarefa antes de editar.' }, { status: 400 })

    const titulo = body.titulo?.trim()
    const observacao = body.observacao?.trim() || null
    const atribuidoPara = body.atribuidoPara

    if (!titulo) return NextResponse.json({ error: 'Informe o título da tarefa.' }, { status: 400 })
    if (!atribuidoPara) return NextResponse.json({ error: 'Escolha para quem é a tarefa.' }, { status: 400 })

    if (atribuidoPara !== tarefa.atribuido_para) {
      const eligible = await getEligibleUserIds()
      if (!eligible.has(atribuidoPara)) {
        return NextResponse.json({ error: 'Esse usuário não tem acesso à ferramenta de Tarefas.' }, { status: 400 })
      }
    }

    const { data, error } = await adminClient
      .from('tarefas')
      .update({ titulo, observacao, atribuido_para: atribuidoPara, atualizado_em: now })
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const mudancas: string[] = []
    if (titulo !== tarefa.titulo) mudancas.push(`título: "${tarefa.titulo}" → "${titulo}"`)
    if (observacao !== tarefa.observacao) mudancas.push('observação alterada')
    if (atribuidoPara !== tarefa.atribuido_para) {
      const names = await getUserNames([tarefa.atribuido_para, atribuidoPara])
      mudancas.push(`responsável: ${names.get(tarefa.atribuido_para)} → ${names.get(atribuidoPara)}`)
    }

    await logTarefa(id, titulo, user.id, 'editada', mudancas.join('; ') || null)
    await logToolUsage(supabase, user.id, TOOL_SLUG, 0)
    await logActivity(user.id, 'tool_run', `Editou a tarefa "${titulo}"`)

    const [withName] = await withNames([data as TarefaRow])
    return NextResponse.json({ data: withName })
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, isAdmin, hasAccess } = await getTarefasSession()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!hasAccess) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()
  const { data: existing } = await adminClient.from('tarefas').select('titulo, criado_por, atribuido_para').eq('id', id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 })

  if (existing.criado_por !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Só quem criou a tarefa pode excluí-la.' }, { status: 403 })
  }

  const { error } = await adminClient.from('tarefas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const names = await getUserNames([existing.atribuido_para])
  await logTarefa(id, existing.titulo, user.id, 'excluida', `Era de ${names.get(existing.atribuido_para)}`)
  await logToolUsage(supabase, user.id, TOOL_SLUG, 0)
  await logActivity(user.id, isAdmin && existing.criado_por !== user.id ? 'admin_delete' : 'tool_run', `Excluiu a tarefa "${existing.titulo}"`)

  return NextResponse.json({ ok: true })
}
