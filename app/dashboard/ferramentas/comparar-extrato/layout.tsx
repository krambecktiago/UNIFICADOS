import type { Metadata } from 'next'
import { requireToolAccess } from '@/lib/supabase/tool-access'
import { logToolVisit } from '@/lib/supabase/tool-usage'

export const metadata: Metadata = {
  title: 'Conciliação Bancária',
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireToolAccess('comparar-extrato')
  await logToolVisit('comparar-extrato')
  return <>{children}</>
}
