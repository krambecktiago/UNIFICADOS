import { requireToolAccess } from '@/lib/supabase/tool-access'
import { logToolVisit } from '@/lib/supabase/tool-usage'

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireToolAccess('seguro-vida')
  await logToolVisit('seguro-vida')
  return <>{children}</>
}
