import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/sidebar'
import { BackgroundDecor } from '@/components/decorative-icons'

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
    <div className="flex min-h-screen bg-gray-100 dark:bg-[#09173a]">
      <Sidebar isAdmin={isAdmin} />
      <div className="relative flex-1 overflow-auto">
        <BackgroundDecor position="fixed" />
        <main className="relative z-10">
          {children}
        </main>
      </div>
    </div>
  )
}
