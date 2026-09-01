import type { Metadata } from 'next'
import { requireToolAccess } from '@/lib/supabase/tool-access'
import { logToolVisit } from '@/lib/supabase/tool-usage'

export const metadata: Metadata = {
  title: 'Registro de Entregas',
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireToolAccess('registro-entregas')
  await logToolVisit('registro-entregas')
  return <>{children}</>
}
