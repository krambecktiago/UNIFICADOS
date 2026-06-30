export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
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

  const adminClient = createAdminClient()

  const [authResult, profilesResult, toolsResult, accessesResult] = await Promise.all([
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
    adminClient.from('profiles').select('id, full_name, role'),
    adminClient.from('tools').select('id, slug').eq('active', true),
    adminClient.from('user_tool_access').select('user_id, tool_id'),
  ])

  const profileMap = new Map(
    (profilesResult.data ?? []).map(p => [p.id, p])
  )
  const toolSlugMap = new Map(
    (toolsResult.data ?? []).map(t => [t.id, t.slug])
  )

  const accessMap: Record<string, string[]> = {}
  for (const a of accessesResult.data ?? []) {
    if (!accessMap[a.user_id]) accessMap[a.user_id] = []
    const slug = toolSlugMap.get(a.tool_id)
    if (slug) accessMap[a.user_id].push(slug)
  }

  const users = (authResult.data?.users ?? []).map(u => ({
    id: u.id,
    email: u.email ?? '',
    full_name: profileMap.get(u.id)?.full_name ?? null,
    role: (profileMap.get(u.id)?.role ?? 'user') as 'admin' | 'user',
    tools: accessMap[u.id] ?? [],
    created_at: u.created_at,
  }))

  users.sort((a, b) => a.email.localeCompare(b.email))

  return NextResponse.json(users)
}
