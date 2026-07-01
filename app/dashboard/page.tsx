import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireToolAccess } from '@/lib/supabase/tool-access'
import { formatDateTime } from '@/lib/utils'

const TOOL_LABELS: Record<string, string> = {
  duplicatas: 'Conferir Duplicatas',
  'seguro-vida': 'Seguro de Vida',
  'contas-pagar': 'Contas a Pagar',
  'comparador-dda': 'Comparador DDA',
  'conciliacao-cartao': 'Conciliação Cartão',
  'comparar-extrato': 'Conciliação Bancária',
}

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
    .select('tool_slug, files_count')

  const totalFiles = (usageLogs ?? []).reduce((sum, log) => sum + log.files_count, 0)

  const usageByTool = new Map<string, number>()
  for (const log of usageLogs ?? []) {
    usageByTool.set(log.tool_slug, (usageByTool.get(log.tool_slug) ?? 0) + 1)
  }
  const topTools = [...usageByTool.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const maxUsage = topTools[0]?.[1] ?? 0

  return (
    <div className="min-h-screen">

      <div className="h-[68px] bg-white border-b border-gray-200 px-8 flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-gray-900 leading-tight">Bom dia, {firstName}</p>
          <p className="text-xs text-gray-400 leading-tight mt-0.5">Último acesso: {lastLogin}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-[#c8102e] flex items-center justify-center text-white text-sm font-bold shrink-0">
          {firstName.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="px-8 py-8 max-w-4xl space-y-8">

        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-4">Acesso Rápido</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuickCard
              href="/dashboard/ferramentas"
              label="Ferramentas"
              description="Acesse as ferramentas disponíveis"
              iconBg="#0d1e45"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
              }
            />
            <QuickCard
              href="/dashboard/ia"
              label="Análise IA"
              description="Gere análises com inteligência artificial"
              iconBg="#c8102e"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              }
            />
          </div>
        </section>

        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-4">Uso da Plataforma</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-200 flex flex-col justify-between">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#0d1e45] text-white mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalFiles}</p>
                <p className="text-xs text-gray-400 mt-0.5">Arquivos analisados</p>
              </div>
            </div>

            <div className="sm:col-span-2 bg-white rounded-xl p-5 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 mb-4">Ferramentas mais usadas</p>
              {topTools.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum uso registrado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {topTools.map(([slug, count]) => (
                    <div key={slug}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{TOOL_LABELS[slug] ?? slug}</span>
                        <span className="text-gray-400 text-xs">{count}x</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0d1e45] rounded-full"
                          style={{ width: `${maxUsage > 0 ? (count / maxUsage) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
      className="group bg-white rounded-xl p-5 flex items-center gap-4 hover:shadow-xl transition-all border border-gray-200"
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
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300 ml-auto shrink-0 group-hover:text-[#0d1e45] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
