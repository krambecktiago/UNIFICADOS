export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPixAccess } from '@/lib/pix/access'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!(await hasPixAccess(supabase, user.id))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('pix_transactions')
    .select('*')
    .order('data_hora_pagamento', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
