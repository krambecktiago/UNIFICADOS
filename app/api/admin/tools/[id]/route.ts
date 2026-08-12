export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/supabase/activity-log'

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
  const body = await request.json() as { active?: boolean }
  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: '"active" deve ser boolean' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data: tool, error } = await adminClient
    .from('tools')
    .update({ active: body.active })
    .eq('id', id)
    .select('name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(user.id, 'admin_tool_toggle', `${body.active ? 'Ativou' : 'Desativou'} a ferramenta ${tool?.name ?? id}`)

  return NextResponse.json({ ok: true })
}
