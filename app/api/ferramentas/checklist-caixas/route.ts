export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logToolUsage } from '@/lib/supabase/tool-usage'
import { logActivity } from '@/lib/supabase/activity-log'

const SELECT_FIELDS = 'id, nome_avaliado, tipo, itens, finalizada, criado_em, atualizado_em'
const TIPOS = ['weekly', 'monthly'] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // RLS já restringe a auth.uid() = avaliador_id — não precisa filtrar aqui.
  const { data, error } = await supabase
    .from('caixa_avaliacoes')
    .select(SELECT_FIELDS)
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null) as { nomeAvaliado?: string; tipo?: string } | null
  const nomeAvaliado = body?.nomeAvaliado?.trim()
  const tipo = body?.tipo

  if (!nomeAvaliado) return NextResponse.json({ error: 'Informe o nome da pessoa avaliada.' }, { status: 400 })
  if (!tipo || !TIPOS.includes(tipo as typeof TIPOS[number])) {
    return NextResponse.json({ error: 'Tipo de checklist inválido.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('caixa_avaliacoes')
    .insert({ avaliador_id: user.id, nome_avaliado: nomeAvaliado, tipo })
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logToolUsage(supabase, user.id, 'checklist-caixas', 0)
  await logActivity(user.id, 'tool_run', `Iniciou avaliação (${tipo === 'weekly' ? 'semanal' : 'mensal'}) de ${nomeAvaliado}`)

  return NextResponse.json({ data })
}
