import type { Metadata } from 'next'
import { requireToolAccess } from '@/lib/supabase/tool-access'
import { logToolVisit } from '@/lib/supabase/tool-usage'

export const metadata: Metadata = {
  title: 'Checklist Equipe de Caixas',
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireToolAccess('checklist-caixas')
  await logToolVisit('checklist-caixas')
  return <>{children}</>
}
