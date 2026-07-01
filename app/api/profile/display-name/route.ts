import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name } = await request.json()
  const trimmed = String(name ?? '').trim()

  if (!trimmed) {
    return NextResponse.json({ error: 'Informe um nome.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    console.error('Erro ao salvar nome de exibição:', error)
    return NextResponse.json({ error: 'Erro ao salvar o nome.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
