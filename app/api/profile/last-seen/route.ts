import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Heartbeat chamado pelo <PresenceHeartbeat /> enquanto o usuário está com o
// dashboard aberto — alimenta profiles.last_seen_at pra mostrar presença
// real (diferente de auth.users.last_sign_in_at, que só muda em login novo).
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { error } = await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    console.error('Erro ao registrar last_seen_at:', error)
    return NextResponse.json({ error: 'Erro ao registrar presença.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
