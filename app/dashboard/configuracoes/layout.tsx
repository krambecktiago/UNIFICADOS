import { requireToolAccess } from '@/lib/supabase/tool-access'

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireToolAccess('configuracoes')
  return <>{children}</>
}
