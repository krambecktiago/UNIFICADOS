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

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const body = await request.json() as { full_name?: string; email?: string; password?: string }
  const fullName = body.full_name?.trim()
  const email = body.email?.trim()
  const password = body.password

  if (!fullName || !email || !password) {
    return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Senha deve ter no mínimo 8 caracteres' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  return NextResponse.json({
    id: created.user.id,
    email: created.user.email ?? email,
    full_name: fullName,
    role: 'user' as const,
    tools: [] as string[],
    created_at: created.user.created_at,
  })
}

export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

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
