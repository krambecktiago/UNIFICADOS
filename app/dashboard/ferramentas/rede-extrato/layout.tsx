import type { Metadata } from 'next'
import { requireToolAccess } from '@/lib/supabase/tool-access'
import { logToolVisit } from '@/lib/supabase/tool-usage'

export const metadata: Metadata = {
  title: 'Extrato Rede',
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireToolAccess('rede-extrato')
  await logToolVisit('rede-extrato')
  return <>{children}</>
}
