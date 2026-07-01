export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPixAccess } from '@/lib/pix/access'
import { ignorePix } from '@/lib/pix/manual-reconciliation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!(await hasPixAccess(supabase, user.id))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({})) as { motivo?: string }
  const motivo = body.motivo?.trim() || 'Ignorado manualmente'

  try {
    await ignorePix(id, user.email ?? user.id, motivo)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
