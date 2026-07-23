import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireToolAccess } from '@/lib/supabase/tool-access'
import { formatDateTime, formatDayLabel, toDateKey } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { KpiCard } from '@/components/ui/kpi-card'
import { AboutCompanyCard } from '@/components/dashboard/about-company-card'
import { DailyUsageChart, ToolDistributionChart } from '@/components/dashboard/usage-charts'
import { UserToolUsageList, type UserToolBreakdown } from '@/components/dashboard/user-tool-usage'
import { getAccessibleTools } from '@/lib/tools/catalog'

// Telas (não ferramentas de processamento) que reaproveitam a tabela "tools"
// só para controle de acesso — não entram na distribuição de uso por ferramenta.
const SCREEN_SLUGS = ['dashboard', 'configuracoes']

const INTEGRATION_LABELS: Record<string, string> = {
  'rede-producao': 'Rede — API Produção',
  'discord-contas-pagar': 'Discord — Contas a Pagar',
}

export default async function DashboardPage() {
  await requireToolAccess('dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user!.id)
    .maybeSingle()

  const name = profile?.full_name ?? user?.email ?? 'Usuário'
  const firstName = name.split(' ')[0]
  const lastLogin = user?.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : '—'
  const isAdmin = profile?.role === 'admin'

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

  const toolNameBySlug = new Map((toolRows ?? []).map(t => [t.slug, t.name]))

  const toolDistribution = (toolRows ?? [])
    .filter(t => !SCREEN_SLUGS.includes(t.slug))
    .map(t => ({
      slug: t.slug,
      label: t.name,
      count: usageByTool.get(t.slug) ?? 0,
      percent: totalExecutions > 0 ? ((usageByTool.get(t.slug) ?? 0) / totalExecutions) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)

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

  // Últimos 7 dias (índices 23-29) vs os 7 dias anteriores (índices 16-22),
  // para mostrar a tendência semanal de execuções no KPI.
  const last7Count = dailyUsage.slice(23, 30).reduce((sum, d) => sum + d.count, 0)
  const prev7Count = dailyUsage.slice(16, 23).reduce((sum, d) => sum + d.count, 0)
  const weeklyDeltaLabel = prev7Count === 0
    ? (last7Count > 0 ? '↑ novo esta semana' : 'sem uso na semana anterior')
    : (() => {
        const delta = Math.round(((last7Count - prev7Count) / prev7Count) * 100)
        if (delta === 0) return 'estável vs. semana anterior'
        return `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)}% vs. semana anterior`
      })()

  // Atividade do próprio usuário nos últimos 30 dias + última ferramenta usada.
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29)
  const myLogs = (usageLogs ?? []).filter(log => log.user_id === user!.id)
  const myUsage30d = myLogs.filter(log => new Date(log.created_at) >= thirtyDaysAgo).length
  const myLastLog = [...myLogs].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0]
  const myLastToolLabel = myLastLog ? (toolNameBySlug.get(myLastLog.tool_slug) ?? myLastLog.tool_slug) : null

  // Ferramentas acessíveis ao usuário, para o grid de atalhos individuais.
  const accessibleTools = await getAccessibleTools(supabase, user!.id, isAdmin)

  // Uso por usuário e ferramenta (só admin) — todos os usuários cadastrados,
  // mesmo quem nunca usou nada, com o detalhamento por ferramenta.
  let userToolBreakdown: UserToolBreakdown[] = []
  if (isAdmin) {
    const usageByUserTool = new Map<string, Map<string, number>>()
    for (const log of usageLogs ?? []) {
      if (!usageByUserTool.has(log.user_id)) usageByUserTool.set(log.user_id, new Map())
      const toolMap = usageByUserTool.get(log.user_id)!
      toolMap.set(log.tool_slug, (toolMap.get(log.tool_slug) ?? 0) + 1)
    }

    const adminClient = createAdminClient()
    const [{ data: allProfiles }, { data: authUsers }] = await Promise.all([
      adminClient.from('profiles').select('id, full_name'),
      adminClient.auth.admin.listUsers({ perPage: 1000 }),
    ])
    const lastSignInMap = new Map((authUsers?.users ?? []).map(u => [u.id, u.last_sign_in_at]))

    userToolBreakdown = (allProfiles ?? [])
      .map(p => {
        const toolMap = usageByUserTool.get(p.id) ?? new Map<string, number>()
        const tools = toolDistribution
          .map(t => ({ slug: t.slug, label: t.label, count: toolMap.get(t.slug) ?? 0 }))
          .filter(t => t.count > 0)
          .sort((a, b) => b.count - a.count)
        const total = tools.reduce((sum, t) => sum + t.count, 0)
        const lastOnline = lastSignInMap.get(p.id) ?? null
        return { id: p.id, name: p.full_name || 'Usuário', total, tools, lastOnline }
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'))
  }

  // Card de saúde das integrações (só admin) — mostra apenas se está
  // configurada ou não, sem chamar a API da Rede nem disparar o webhook do
  // Discord (isso enviaria uma mensagem real no canal a cada carregamento).
  let integrations: { slug: string; name: string; configured: boolean; updatedAt: string }[] = []
  if (isAdmin) {
    const { data: integrationRows } = await supabase
      .from('integrations')
      .select('slug, name, value, updated_at')
    integrations = (integrationRows ?? []).map(i => ({
      slug: i.slug,
      name: INTEGRATION_LABELS[i.slug] ?? i.name,
      configured: !!i.value,
      updatedAt: i.updated_at,
    }))
  }

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

      <div className="px-8 py-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
      <div className="space-y-8">

        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-4">Acesso Rápido</p>
          {accessibleTools.length === 0 ? (
            <Card padding="5">
              <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma ferramenta liberada para o seu usuário ainda.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {accessibleTools.map((tool, i) => {
                const count = usageByTool.get(tool.slug) ?? 0
                return (
                  <Link
                    key={tool.slug}
                    href={tool.href}
                    className="group bg-white dark:bg-gray-900 rounded-xl p-5 flex items-center gap-4 hover:shadow-xl hover:-translate-y-0.5 transition-all border border-gray-200 dark:border-gray-800 animate-fade-in-up"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
                      style={{ backgroundColor: tool.accent }}
                    >
                      {tool.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{tool.title}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {count > 0 ? `Usado ${count}x` : 'Nunca usado'}
                      </p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 group-hover:text-brand-navy transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-4">Uso da Plataforma</p>
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

            <KpiCard
              label="Execuções (7 dias)"
              value={last7Count}
              sub={weeklyDeltaLabel}
              accent="var(--color-brand-red)"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
                </svg>
              }
            />

            <KpiCard
              label="Sua atividade (30 dias)"
              value={myUsage30d}
              sub={myLastToolLabel ? `Última: ${myLastToolLabel}` : 'Nenhum uso ainda'}
              accent="#7c3aed"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              }
            />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-4">Distribuição por ferramenta</p>
          <Card padding="5">
            {totalExecutions === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum uso registrado ainda.</p>
            ) : (
              <ToolDistributionChart data={toolDistribution} />
            )}
          </Card>
        </section>

        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-4">Uso nos últimos 30 dias</p>
          <Card padding="5">
            {totalExecutions === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum uso registrado ainda.</p>
            ) : (
              <DailyUsageChart data={dailyUsage} />
            )}
          </Card>
        </section>

        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-4">Usuários mais ativos</p>
          <Card padding="5">
            {topUsers.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum uso registrado ainda.</p>
            ) : (
              <div className="space-y-3">
                {topUsers.map((topUser, index) => (
                  <div key={topUser.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 w-4 shrink-0">{index + 1}º</span>
                    <div className="w-7 h-7 rounded-full bg-brand-navy flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {topUser.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">
                      {topUser.name}{topUser.id === user!.id ? ' (você)' : ''}
                    </span>
                    <div className="h-1.5 w-24 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden hidden sm:block">
                      <div
                        className="h-full bg-brand-navy rounded-full"
                        style={{ width: `${(topUser.count / maxUserCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-gray-400 dark:text-gray-500 text-xs w-10 text-right shrink-0">{topUser.count}x</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        {isAdmin && (
          <section>
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-4">Uso por usuário e ferramenta</p>
            <Card padding="5">
              {userToolBreakdown.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum usuário cadastrado ainda.</p>
              ) : (
                <UserToolUsageList users={userToolBreakdown} currentUserId={user!.id} />
              )}
            </Card>
          </section>
        )}

      </div>

      <aside className="space-y-4 lg:sticky lg:top-8">
        <AboutCompanyCard />

        {isAdmin && (
          <Card padding="6">
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-3">Saúde das integrações</p>
            <ul className="space-y-3">
              {integrations.map(integration => (
                <li key={integration.slug} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{integration.name}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      integration.configured
                        ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950'
                        : 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${integration.configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {integration.configured ? 'Configurado' : 'Pendente'}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/dashboard/admin/conexoes" className="inline-block mt-4 text-xs font-semibold text-brand-navy dark:text-gray-300 hover:underline">
              Gerenciar conexões →
            </Link>
          </Card>
        )}
      </aside>

      </div>
    </div>
  )
}
