export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchJjwDuplicatasAberto } from '@/lib/jjw/client'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const startDate = request.nextUrl.searchParams.get('startDate')
  const endDate = request.nextUrl.searchParams.get('endDate')
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Informe startDate e endDate (yyyy-mm-dd).' }, { status: 400 })
  }
  const companyNumbers = request.nextUrl.searchParams.getAll('companyNumber')

  try {
    const duplicatas = await fetchJjwDuplicatasAberto(startDate, endDate, companyNumbers)
    return NextResponse.json({ duplicatas }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Erro ao consultar duplicatas do JJW.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
