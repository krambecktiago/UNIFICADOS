import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireToolAccess } from '@/lib/supabase/tool-access'
import { formatDateTime, formatDayLabel, toDateKey } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { KpiCard } from '@/components/ui/kpi-card'

// Telas (não ferramentas de processamento) que reaproveitam a tabela "tools"
// só para controle de acesso — não entram na distribuição de uso por ferramenta.
const SCREEN_SLUGS = ['dashboard', 'configuracoes']

export default async function DashboardPage() {
  await requireToolAccess('dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .maybeSingle()

  const name = profile?.full_name ?? user?.email ?? 'Usuário'
  const firstName = name.split(' ')[0]
  const lastLogin = user?.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : '—'

  const { data: usageLogs } = await supabase
    .from('tool_usage_logs')
    .select('tool_slug, files_count, user_id, created_at')

  const totalFiles = (usageLogs ?? []).reduce((sum, log) => sum + log.files_count, 0)
  const totalExecutions = (usageLogs ?? []).length

  const usageByTool = new Map<string, number>()
  const usageByUser = new Map<string, number>()
  const usageByDay = new Map<string, number>()
  for (const log of usageLogs ?? []) {
    usageByTool.set(log.tool_slug, (usageByTool.get(log.tool_slug) ?? 0) + 1)
    usageByUser.set(log.user_id, (usageByUser.get(log.user_id) ?? 0) + 1)
    const dayKey = toDateKey(log.created_at)
    usageByDay.set(dayKey, (usageByDay.get(dayKey) ?? 0) + 1)
  }

  // Busca as ferramentas direto da tabela "tools" — assim, toda ferramenta
  // nova cadastrada aparece aqui automaticamente, sem precisar editar código.
  const { data: toolRows } = await supabase
    .from('tools')
    .select('slug, name')
    .eq('active', true)

  const toolDistribution = (toolRows ?? [])
    .filter(t => !SCREEN_SLUGS.includes(t.slug))
    .map(t => ({
      slug: t.slug,
      label: t.name,
      count: usageByTool.get(t.slug) ?? 0,
      percent: totalExecutions > 0 ? ((usageByTool.get(t.slug) ?? 0) / totalExecutions) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
  const maxToolCount = Math.max(1, ...toolDistribution.map(t => t.count))

  const topUserEntries = [...usageByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  let topUsers: { id: string; name: string; count: number }[] = []
  if (topUserEntries.length > 0) {
    const adminClient = createAdminClient()
    const { data: rankedProfiles } = await adminClient
      .from('profiles')
      .select('id, full_name')
      .in('id', topUserEntries.map(([id]) => id))
    const nameMap = new Map((rankedProfiles ?? []).map(p => [p.id, p.full_name]))
    topUsers = topUserEntries.map(([id, count]) => ({
      id,
      count,
      name: nameMap.get(id) || 'Usuário',
    }))
  }
  const maxUserCount = topUsers[0]?.count ?? 0

  const dailyUsage = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (29 - i))
    const key = toDateKey(d)
    return { key, label: formatDayLabel(d), count: usageByDay.get(key) ?? 0 }
  })
  const maxDailyCount = Math.max(1, ...dailyUsage.map(d => d.count))

  return (
    <div className="min-h-screen">

      <PageHeader
        title="Dashboard"
        subtitle={`Último acesso: ${lastLogin}`}
        right={
          <div className="w-9 h-9 rounded-full bg-brand-red flex items-center justify-center text-white text-sm font-bold shrink-0">
            {firstName.charAt(0).toUpperCase()}
          </div>
        }
      />

      <div className="px-8 py-8 max-w-4xl space-y-8">

        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-4">Acesso Rápido</p>
          <div className="grid grid-cols-1 gap-4">
            <QuickCard
              href="/dashboard/ferramentas"
              label="Ferramentas"
              description="Acesse as ferramentas disponíveis"
              iconBg="var(--color-brand-navy)"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
              }
            />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-4">Uso da Plataforma</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Arquivos analisados"
              value={totalFiles}
              accent="var(--color-brand-navy)"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              }
            />

            <Card padding="5" className="sm:col-span-2">
              <p className="text-xs font-semibold text-gray-500 mb-4">Distribuição por ferramenta</p>
              {totalExecutions === 0 ? (
                <p className="text-sm text-gray-400">Nenhum uso registrado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {toolDistribution.map(tool => (
                    <div key={tool.slug}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{tool.label}</span>
                        <span className="text-gray-400 text-xs">{tool.count}x · {tool.percent.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-navy rounded-full"
                          style={{ width: `${(tool.count / maxToolCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-4">Uso nos últimos 30 dias</p>
          <Card padding="5">
            {totalExecutions === 0 ? (
              <p className="text-sm text-gray-400">Nenhum uso registrado ainda.</p>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {dailyUsage.map(day => (
                  <div key={day.key} className="flex-1 h-full flex flex-col justify-end group relative">
                    <div
                      className="w-full bg-brand-navy rounded-sm group-hover:bg-brand-red transition-colors min-h-[2px]"
                      style={{ height: `${(day.count / maxDailyCount) * 100}%` }}
                      title={`${day.label}: ${day.count} uso${day.count === 1 ? '' : 's'}`}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>{dailyUsage[0]?.label}</span>
              <span>{dailyUsage[dailyUsage.length - 1]?.label}</span>
            </div>
          </Card>
        </section>

        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-4">Usuários mais ativos</p>
          <Card padding="5">
            {topUsers.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum uso registrado ainda.</p>
            ) : (
              <div className="space-y-3">
                {topUsers.map((topUser, index) => (
                  <div key={topUser.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-4 shrink-0">{index + 1}º</span>
                    <div className="w-7 h-7 rounded-full bg-brand-navy flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {topUser.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                      {topUser.name}{topUser.id === user!.id ? ' (você)' : ''}
                    </span>
                    <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                      <div
                        className="h-full bg-brand-navy rounded-full"
                        style={{ width: `${(topUser.count / maxUserCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs w-10 text-right shrink-0">{topUser.count}x</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

      </div>
    </div>
  )
}

function QuickCard({
  href, label, description, iconBg, icon,
}: {
  href: string
  label: string
  description: string
  iconBg: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-xl p-5 flex items-center gap-4 hover:shadow-xl hover:-translate-y-0.5 transition-all border border-gray-200 animate-fade-in-up"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 transition-colors">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{description}</p>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300 ml-auto shrink-0 group-hover:text-brand-navy transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
