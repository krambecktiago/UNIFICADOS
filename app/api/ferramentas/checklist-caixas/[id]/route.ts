export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logToolUsage } from '@/lib/supabase/tool-usage'
import { logActivity } from '@/lib/supabase/activity-log'

const SELECT_FIELDS = 'id, nome_avaliado, loja, tipo, itens, finalizada, criado_em, atualizado_em'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null) as { itens?: unknown; finalizada?: boolean } | null
  if (!body || typeof body.itens !== 'object' || body.itens === null) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const update: Record<string, unknown> = { itens: body.itens, atualizado_em: new Date().toISOString() }
  if (typeof body.finalizada === 'boolean') update.finalizada = body.finalizada

  // RLS (auth.uid() = avaliador_id) garante que só o próprio dono atualiza —
  // se o id não for dele, .single() falha por não encontrar linha nenhuma.
  const { data, error } = await supabase
    .from('caixa_avaliacoes')
    .update(update)
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.finalizada) {
    await logToolUsage(supabase, user.id, 'checklist-caixas', 0)
    await logActivity(user.id, 'tool_run', `Finalizou avaliação de ${data.nome_avaliado}`)
  }

  return NextResponse.json({ data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase.from('caixa_avaliacoes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
