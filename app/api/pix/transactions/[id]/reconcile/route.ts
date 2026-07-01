export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPixAccess } from '@/lib/pix/access'
import { reconcileManual, ToleranceExceededError } from '@/lib/pix/manual-reconciliation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Reconfirma no próprio handler — o requireToolAccess do layout só protege
  // a renderização da página, não esta rota de API.
  if (!(await hasPixAccess(supabase, user.id))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json() as { erpTituloId?: string; force?: boolean }

  if (!body.erpTituloId?.trim()) {
    return NextResponse.json({ error: 'ID do título é obrigatório' }, { status: 400 })
  }

  try {
    await reconcileManual(id, body.erpTituloId.trim(), user.email ?? user.id, !!body.force)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ToleranceExceededError) {
      return NextResponse.json({ error: err.message, toleranceExceeded: true }, { status: 409 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
