import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getSessionProfile } from '@/lib/supabase/session'
import { Sidebar } from '@/components/dashboard/sidebar'
import { AssistantWidget } from '@/components/ai-assistant-widget'
import { PresenceHeartbeat } from '@/components/dashboard/presence-heartbeat'
import { getGreeting } from '@/lib/utils'

const GATED_SCREEN_SLUGS = ['dashboard', 'configuracoes']

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const profile = await getSessionProfile()

  if (!profile?.full_name?.trim()) {
    redirect('/onboarding')
  }

  const supabase = await createClient()

  const isAdmin = profile?.role === 'admin'

  let accessibleScreens: string[] = GATED_SCREEN_SLUGS

  if (!isAdmin) {
    const { data: toolRows } = await supabase
      .from('tools')
      .select('id, slug')
      .in('slug', GATED_SCREEN_SLUGS)
      .eq('active', true)

    const { data: accessRows } = await supabase
      .from('user_tool_access')
      .select('tool_id')
      .eq('user_id', user.id)

    const accessibleToolIds = new Set((accessRows ?? []).map(a => a.tool_id))
    accessibleScreens = (toolRows ?? [])
      .filter(t => accessibleToolIds.has(t.id))
      .map(t => t.slug)
  }

  const firstName = (profile?.full_name ?? user.email ?? 'Usuário').split(' ')[0]

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-950">
      <Sidebar isAdmin={isAdmin} accessibleScreens={accessibleScreens} greeting={getGreeting()} userFirstName={firstName} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <AssistantWidget />
      <PresenceHeartbeat />
    </div>
  )
}
