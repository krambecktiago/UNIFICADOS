import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Usado por ferramentas client-side pra saber a empresa do usuário logado
// (ex: pré-selecionar o estabelecimento no Extrato Rede).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_number')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({ companyNumber: profile?.company_number ?? null })
}
