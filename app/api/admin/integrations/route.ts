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

export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('integrations')
    .select('id, slug, name, type, value, description, updated_at')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const body = await request.json() as {
    slug?: string
    name?: string
    type?: string
    value?: string
    description?: string
  }
  const slug = body.slug?.trim()
  const name = body.name?.trim()
  const type = body.type?.trim() || 'webhook'
  const value = body.value?.trim() ?? ''
  const description = body.description?.trim() || null

  if (!slug || !name) {
    return NextResponse.json({ error: 'Identificador (slug) e nome são obrigatórios' }, { status: 400 })
  }
  if (!['webhook', 'api_key', 'other'].includes(type)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('integrations')
    .insert({ slug, name, type, value, description })
    .select('id, slug, name, type, value, description, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
