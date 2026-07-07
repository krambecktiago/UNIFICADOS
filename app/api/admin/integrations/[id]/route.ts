export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }

  const { data: selfProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (selfProfile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  }

  return { error: null }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const { id } = await params
  const body = await request.json() as {
    name?: string
    type?: string
    value?: string
    description?: string | null
  }

  const update: Record<string, string | null> = {}
  if (typeof body.name === 'string') update.name = body.name.trim()
  if (typeof body.type === 'string') {
    if (!['webhook', 'api_key', 'other'].includes(body.type)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }
    update.type = body.type
  }
  if (typeof body.value === 'string') update.value = body.value.trim()
  if (body.description !== undefined) update.description = body.description?.trim() || null

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }
  update.updated_at = new Date().toISOString()

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('integrations')
    .update(update)
    .eq('id', id)
    .select('id, slug, name, type, value, description, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const { id } = await params
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('integrations').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
