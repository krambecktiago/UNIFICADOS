import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/ui/page-header'
import { ActivityLogList, type ActivityEntry } from '@/components/dashboard/activity-log-list'

// Mostra só as ações mais recentes — um audit trail completo pede
// paginação de verdade, mas pra "ver o que as pessoas estão fazendo" as
// últimas centenas já cobrem bem o caso de uso.
const MAX_ENTRIES = 500

export default async function AtividadesPage() {
  const adminClient = createAdminClient()

  const [{ data: logs }, { data: profiles }] = await Promise.all([
    adminClient
      .from('activity_logs')
      .select('id, user_id, action, description, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_ENTRIES),
    adminClient.from('profiles').select('id, full_name'),
  ])

  const nameMap = new Map((profiles ?? []).map(p => [p.id, p.full_name]))

  const entries: ActivityEntry[] = (logs ?? []).map(l => ({
    id: l.id,
    userName: l.user_id ? (nameMap.get(l.user_id) || 'Usuário removido') : 'Sistema',
    action: l.action,
    description: l.description,
    createdAt: l.created_at,
  }))

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Log de Atividades"
        subtitle="Ações principais realizadas na plataforma: execuções de ferramenta, exportações e mudanças administrativas."
      />

      <div className="px-8 py-8 max-w-5xl mx-auto">
        <ActivityLogList entries={entries} />
      </div>
    </div>
  )
}
