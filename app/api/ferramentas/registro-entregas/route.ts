export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logToolUsage } from '@/lib/supabase/tool-usage'
import { logActivity } from '@/lib/supabase/activity-log'

const SELECT_FIELDS = 'id, data, categoria, titulo, detalhe, impacto, criado_em'
const CATEGORIAS = ['automacao', 'melhoria', 'problema', 'projeto', 'treinamento', 'outro'] as const

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const requestedUserId = request.nextUrl.searchParams.get('userId')
  let targetUserId = user.id

  if (requestedUserId && requestedUserId !== user.id) {
    const { data: selfProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (selfProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    targetUserId = requestedUserId
  }

  // Filtra explicitamente por user_id mesmo pra admin — a policy de RLS
  // libera admin ver TODAS as linhas, então sem esse filtro o endpoint
  // devolveria os registros de todo mundo misturados por padrão.
  const { data, error } = await supabase
    .from('registro_entregas')
    .select(SELECT_FIELDS)
    .eq('user_id', targetUserId)
    .order('data', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null) as {
    data?: string
    categoria?: string
    titulo?: string
    detalhe?: string
    impacto?: string
  } | null

  const entryDate = body?.data
  const categoria = body?.categoria
  const titulo = body?.titulo?.trim()
  const detalhe = body?.detalhe?.trim() || null
  const impacto = body?.impacto?.trim() || null

  if (!entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return NextResponse.json({ error: 'Data inválida.' }, { status: 400 })
  }
  if (!categoria || !CATEGORIAS.includes(categoria as typeof CATEGORIAS[number])) {
    return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
  }
  if (!titulo) {
    return NextResponse.json({ error: 'Descreva o que você fez.' }, { status: 400 })
  }

  // user_id sempre o do próprio usuário logado — não vem do body, então nem
  // admin consegue registrar uma entrega em nome de outra pessoa por aqui.
  const { data, error } = await supabase
    .from('registro_entregas')
    .insert({ user_id: user.id, data: entryDate, categoria, titulo, detalhe, impacto })
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logToolUsage(supabase, user.id, 'registro-entregas', 0)
  await logActivity(user.id, 'tool_run', `Registrou uma entrega: ${titulo}`)

  return NextResponse.json({ data })
}
