export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logToolUsage } from '@/lib/supabase/tool-usage'
import { fetchRedeSales } from '@/lib/rede/client'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const startDate = request.nextUrl.searchParams.get('startDate')
  const endDate = request.nextUrl.searchParams.get('endDate')
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Informe startDate e endDate (yyyy-mm-dd).' }, { status: 400 })
  }

  try {
    const transactions = await fetchRedeSales(startDate, endDate)
    await logToolUsage(supabase, user.id, 'rede-extrato', 0)
    return NextResponse.json({ transactions }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Erro ao consultar a API da Rede.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
