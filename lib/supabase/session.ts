import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// `auth.getUser()` valida o token contra o servidor de Auth do Supabase (não
// é leitura local de cookie) — um round-trip de rede de verdade. Sem esse
// cache, layout raiz + requireToolAccess + logToolVisit + a própria página
// chamavam isso de novo cada um, 3-4x por navegação. `cache()` do React
// memoiza por request (renovado a cada requisição), então essas funções
// passam a rodar só uma vez por navegação, não importa quantos lugares as
// chamem.
export const getSessionUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getSessionProfile = cache(async () => {
  const user = await getSessionUser()
  if (!user) return null
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, company_number')
    .eq('id', user.id)
    .maybeSingle()
  return profile
})
