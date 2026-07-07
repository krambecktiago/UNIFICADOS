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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const { id } = await params
  const adminClient = createAdminClient()
  const { data: integration, error } = await adminClient
    .from('integrations')
    .select('name, type, value')
    .eq('id', id)
    .maybeSingle()

  if (error || !integration) {
    return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 })
  }
  if (integration.type !== 'webhook') {
    return NextResponse.json({ error: 'Teste disponível apenas para conexões do tipo webhook' }, { status: 400 })
  }
  if (!integration.value) {
    return NextResponse.json({ error: 'Preencha a URL do webhook antes de testar' }, { status: 400 })
  }

  try {
    const res = await fetch(integration.value, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🔔 **Teste de conexão** — "${integration.name}" configurado com sucesso.`,
        username: 'Ferramentas Krambeck',
      }),
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Webhook respondeu com erro (${res.status})` }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Falha ao conectar com o webhook' }, { status: 400 })
  }
}
