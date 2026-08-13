import type { Metadata } from 'next'
import { requireToolAccess } from '@/lib/supabase/tool-access'
import { logToolVisit } from '@/lib/supabase/tool-usage'

export const metadata: Metadata = {
  title: 'Desconto Motoboys',
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireToolAccess('desconto-motoboys')
  await logToolVisit('desconto-motoboys')
  return <>{children}</>
}
