import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/sidebar'
import { AssistantWidget } from '@/components/ai-assistant-widget'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar isAdmin={isAdmin} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <AssistantWidget />
    </div>
  )
}
