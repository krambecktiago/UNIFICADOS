export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tool = request.nextUrl.searchParams.get('tool')
  if (!tool) return NextResponse.json({ error: 'Parâmetro "tool" obrigatório' }, { status: 400 })

  const { data } = await supabase
    .from('user_tool_settings')
    .select('settings')
    .eq('user_id', user.id)
    .eq('tool_slug', tool)
    .maybeSingle()

  return NextResponse.json({ settings: data?.settings ?? {} })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { tool, settings } = body

  if (!tool || typeof settings !== 'object') {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_tool_settings')
    .upsert(
      { user_id: user.id, tool_slug: tool, settings, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,tool_slug' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
