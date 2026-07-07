import type { Metadata } from 'next'
import { requireToolAccess } from '@/lib/supabase/tool-access'
import { logToolVisit } from '@/lib/supabase/tool-usage'

export const metadata: Metadata = {
  title: 'Seguro de Vida',
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireToolAccess('seguro-vida')
  await logToolVisit('seguro-vida')
  return <>{children}</>
}
