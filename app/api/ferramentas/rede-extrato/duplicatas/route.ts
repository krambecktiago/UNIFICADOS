export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchJjwDuplicatasAberto } from '@/lib/jjw/client'
import { getRedeEstablishments } from '@/lib/rede/client'

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

  // Não depende da consulta de duplicatas abaixo — preenche o filtro de
  // estabelecimento mesmo se ela falhar, mesmo padrão da rota de vendas.
  const establishments = await getRedeEstablishments().catch(() => [])

  try {
    const duplicatas = await fetchJjwDuplicatasAberto(startDate, endDate, companyNumbers)
    return NextResponse.json({ duplicatas, establishments }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Erro ao consultar duplicatas do JJW.'
    return NextResponse.json({ error: message, establishments }, { status: 502 })
  }
}
