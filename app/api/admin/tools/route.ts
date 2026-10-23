export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ALL_TOOLS } from '@/lib/tools/catalog'

const SCREEN_SLUGS = ['dashboard', 'configuracoes']
const VALID_SLUGS = new Set([...ALL_TOOLS.map(t => t.slug), ...SCREEN_SLUGS])

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

  // Limpa ferramentas obsoletas que não constam mais em ALL_TOOLS nem em SCREEN_SLUGS
  const orphanedTools = (data ?? []).filter(t => !VALID_SLUGS.has(t.slug))
  if (orphanedTools.length > 0) {
    const orphanedSlugs = orphanedTools.map(t => t.slug)
    const orphanedIds = orphanedTools.map(t => t.id)

    await Promise.allSettled([
      adminClient.from('user_tool_access').delete().in('tool_id', orphanedIds),
      adminClient.from('tool_usage_logs').delete().in('tool_slug', orphanedSlugs),
      adminClient.from('user_tool_settings').delete().in('tool_slug', orphanedSlugs),
      adminClient.from('tools').delete().in('id', orphanedIds),
    ])
  }

  const validTools = (data ?? []).filter(t => VALID_SLUGS.has(t.slug))
  return NextResponse.json(validTools)
}

