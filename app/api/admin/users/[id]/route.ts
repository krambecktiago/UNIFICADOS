export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
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
  const body = await request.json() as { role?: string; tools?: string[]; full_name?: string }
  const adminClient = createAdminClient()

  if (body.role !== undefined) {
    const { error } = await adminClient
      .from('profiles')
      .update({ role: body.role, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (body.full_name !== undefined) {
    const fullName = body.full_name.trim()
    if (!fullName) {
      return NextResponse.json({ error: 'Nome não pode ser vazio' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (body.tools !== undefined) {
    const { data: toolRows } = await adminClient
      .from('tools')
      .select('id, slug')
      .eq('active', true)

    await adminClient.from('user_tool_access').delete().eq('user_id', id)

    if (body.tools.length > 0 && toolRows) {
      const inserts = toolRows
        .filter(t => body.tools!.includes(t.slug))
        .map(t => ({ user_id: id, tool_id: t.id }))

      if (inserts.length > 0) {
        const { error } = await adminClient.from('user_tool_access').insert(inserts)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
