export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
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

// RLS de "tools" só libera SELECT de linhas com active = true — precisa do
// client admin (bypassa RLS) para o painel também listar as inativas.
export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('tools')
    .select('id, slug, name, active')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
