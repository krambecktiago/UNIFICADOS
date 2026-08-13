export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logToolUsage } from '@/lib/supabase/tool-usage'
import { logActivity } from '@/lib/supabase/activity-log'
import { formatBRL } from '@/lib/utils/br-format'

const LOJAS = ['L01', 'L02', 'L03', 'L04', 'L05'] as const

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const loja = request.nextUrl.searchParams.get('loja')
  const status = request.nextUrl.searchParams.get('status')

  let query = supabase
    .from('motoboy_descontos')
    .select('id, loja, cod_fornecedor, nome_motoboy, duplicata, motivo, valor, data_para_descontar, status, descontado_em, criado_em')
    .order('data_para_descontar', { ascending: true })

  if (loja) query = query.eq('loja', loja)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null) as {
    loja?: string
    codFornecedor?: string
    nomeMotoboy?: string
    duplicata?: string
    motivo?: string
    valor?: number
    dataParaDescontar?: string
  } | null

  const loja = body?.loja
  const codFornecedor = body?.codFornecedor?.trim()
  const nomeMotoboy = body?.nomeMotoboy?.trim()
  const duplicata = body?.duplicata?.trim()
  const motivo = body?.motivo?.trim()
  const valor = body?.valor
  const dataParaDescontar = body?.dataParaDescontar

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

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('motoboy_descontos')
    .insert({
      loja,
      cod_fornecedor: codFornecedor,
      nome_motoboy: nomeMotoboy,
      duplicata,
      motivo,
      valor,
      data_para_descontar: dataParaDescontar,
      status: 'pendente',
      criado_por: user.id,
      atualizado_por: user.id,
    })
    .select('id, loja, cod_fornecedor, nome_motoboy, duplicata, motivo, valor, data_para_descontar, status, descontado_em, criado_em')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logToolUsage(supabase, user.id, 'desconto-motoboys', 0)
  await logActivity(user.id, 'tool_run', `Registrou desconto de ${formatBRL(valor)} para ${nomeMotoboy} (${loja})`)

  return NextResponse.json({ data })
}
