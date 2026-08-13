export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logToolUsage } from '@/lib/supabase/tool-usage'
import { logActivity } from '@/lib/supabase/activity-log'
import { formatBRL } from '@/lib/utils/br-format'

const LOJAS = ['L01', 'L02', 'L03', 'L04', 'L05'] as const
const SELECT_FIELDS = 'id, loja, cod_fornecedor, nome_motoboy, duplicata, motivo, valor, data_para_descontar, status, descontado_em, criado_em'

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null) as {
    action?: 'edit' | 'mark_done' | 'reopen'
    loja?: string
    codFornecedor?: string
    nomeMotoboy?: string
    duplicata?: string
    motivo?: string
    valor?: number
    dataParaDescontar?: string
  } | null

  const adminClient = createAdminClient()

  if (body?.action === 'edit') {
    const loja = body.loja
    const codFornecedor = body.codFornecedor?.trim()
    const nomeMotoboy = body.nomeMotoboy?.trim()
    const duplicata = body.duplicata?.trim()
    const motivo = body.motivo?.trim()
    const valor = body.valor
    const dataParaDescontar = body.dataParaDescontar

    if (!loja || !LOJAS.includes(loja as typeof LOJAS[number])) {
      return NextResponse.json({ error: 'Loja inválida.' }, { status: 400 })
    }
    if (!codFornecedor || !nomeMotoboy || !duplicata || !motivo) {
      return NextResponse.json({ error: 'Preencha código do fornecedor, nome do motoboy, duplicata e motivo.' }, { status: 400 })
    }
    if (typeof valor !== 'number' || valor <= 0) {
      return NextResponse.json({ error: 'Valor deve ser maior que zero.' }, { status: 400 })
    }
    if (!dataParaDescontar || !/^\d{4}-\d{2}-\d{2}$/.test(dataParaDescontar)) {
      return NextResponse.json({ error: 'Data para descontar inválida.' }, { status: 400 })
    }

    const { data, error } = await adminClient
      .from('motoboy_descontos')
      .update({
        loja,
        cod_fornecedor: codFornecedor,
        nome_motoboy: nomeMotoboy,
        duplicata,
        motivo,
        valor,
        data_para_descontar: dataParaDescontar,
        atualizado_por: user.id,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logToolUsage(supabase, user.id, 'desconto-motoboys', 0)
    await logActivity(user.id, 'tool_run', `Editou desconto de ${nomeMotoboy} (${loja})`)

    return NextResponse.json({ data })
  }

  if (body?.action === 'mark_done') {
    const { data, error } = await adminClient
      .from('motoboy_descontos')
      .update({ status: 'descontado', descontado_em: hojeISO(), atualizado_por: user.id, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logToolUsage(supabase, user.id, 'desconto-motoboys', 0)
    await logActivity(user.id, 'tool_run', `Marcou desconto de ${data.nome_motoboy} (${data.loja}) como descontado`)

    return NextResponse.json({ data })
  }

  if (body?.action === 'reopen') {
    const { data, error } = await adminClient
      .from('motoboy_descontos')
      .update({ status: 'pendente', descontado_em: null, atualizado_por: user.id, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logToolUsage(supabase, user.id, 'desconto-motoboys', 0)
    await logActivity(user.id, 'tool_run', `Reabriu desconto de ${data.nome_motoboy} (${data.loja})`)

    return NextResponse.json({ data })
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: selfProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (selfProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: existing } = await adminClient
    .from('motoboy_descontos')
    .select('nome_motoboy, loja, valor')
    .eq('id', id)
    .maybeSingle()

  const { error } = await adminClient.from('motoboy_descontos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logToolUsage(supabase, user.id, 'desconto-motoboys', 0)
  if (existing) {
    await logActivity(user.id, 'admin_delete', `Excluiu desconto de ${existing.nome_motoboy} (${existing.loja}) — ${formatBRL(existing.valor)}`)
  }

  return NextResponse.json({ ok: true })
}
