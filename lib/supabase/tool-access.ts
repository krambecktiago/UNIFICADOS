import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getSessionProfile } from '@/lib/supabase/session'
import { redirect } from 'next/navigation'

export async function requireToolAccess(slug: string) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const profile = await getSessionProfile()
  if (profile?.role === 'admin') return

  const supabase = await createClient()

  const { data: tool } = await supabase
    .from('tools')
    .select('id')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (!tool) redirect('/dashboard/ferramentas')

  const { data: access } = await supabase
    .from('user_tool_access')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('tool_id', tool.id)
    .maybeSingle()

  if (!access) redirect('/dashboard/ferramentas')
}
