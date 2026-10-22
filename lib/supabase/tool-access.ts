import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getSessionProfile } from '@/lib/supabase/session'
import { redirect } from 'next/navigation'

const checkAccess = cache(async (userId: string, slug: string): Promise<boolean> => {
  const supabase = await createClient()

  const { data: tool } = await supabase
    .from('tools')
    .select('id')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()

  if (!tool) return false

  const { data: access } = await supabase
    .from('user_tool_access')
    .select('user_id')
    .eq('user_id', userId)
    .eq('tool_id', tool.id)
    .maybeSingle()

  return !!access
})

export async function requireToolAccess(slug: string) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const isInactive = user.app_metadata?.role === 'inactive' || !!(user as any).banned_until
  if (isInactive) redirect('/login?error=inactive')

  const profile = await getSessionProfile()
  if (profile?.role === 'inactive') redirect('/login?error=inactive')
  if (profile?.role === 'admin') return

  const hasAccess = await checkAccess(user.id, slug)
  if (!hasAccess) redirect('/dashboard/ferramentas')
}
