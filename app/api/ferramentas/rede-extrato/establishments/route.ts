export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRedeEstablishments } from '@/lib/rede/client'

// Só a lista de PVs configurados (matriz + filiais) — sem consultar vendas
// nem duplicatas. Usada pra popular o filtro de estabelecimento assim que a
// página abre, antes de qualquer busca.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const establishments = await getRedeEstablishments()
    return NextResponse.json({ establishments }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Erro ao consultar estabelecimentos da Rede.'
    return NextResponse.json({ error: message, establishments: [] }, { status: 502 })
  }
}
