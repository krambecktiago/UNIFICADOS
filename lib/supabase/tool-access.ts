import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function requireToolAccess(slug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role === 'admin') return

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
