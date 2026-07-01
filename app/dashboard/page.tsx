import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const name = user?.user_metadata?.full_name ?? user?.email ?? 'Usuário'
  const firstName = name.split(' ')[0]
  const lastLogin = user?.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : '—'

  return (
    <div className="min-h-screen">

      <div className="h-[68px] bg-white border-b border-gray-200 dark:bg-[#060f26] dark:border-white/10 px-8 flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-white leading-tight">Bom dia, {firstName}</p>
          <p className="text-xs text-gray-400 dark:text-white/40 leading-tight mt-0.5">Último acesso: {lastLogin}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-[#c8102e] flex items-center justify-center text-white text-sm font-bold shrink-0">
          {firstName.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="px-8 py-8 max-w-4xl space-y-8">

        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-white/30 mb-4">Acesso Rápido</p>
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
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-white/30 mb-4">Plataforma</p>
          <div className="bg-white dark:bg-[#0d1e45]/30 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-white/10 shadow-sm border border-gray-200 dark:shadow-lg dark:border-white/10">
            <InfoRow label="Versão" value="1.0.0" />
            <InfoRow label="Empresa" value="Krambeck Autopeças e Tintas" />
            <InfoRow label="Rede" value="Rede Ancora" />
            <InfoRow label="Suporte" value="tiago@krambeck.com.br" />
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
      className="group bg-white dark:bg-[#0d1e45]/30 rounded-xl p-5 flex items-center gap-4 hover:shadow-xl transition-all border border-gray-200 dark:border-white/10"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white transition-colors">{label}</p>
        <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5 truncate">{description}</p>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300 dark:text-white/30 ml-auto shrink-0 group-hover:text-[#0d1e45] dark:group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 h-12">
      <span className="text-sm text-gray-500 dark:text-white/40">{label}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-white/80">{value}</span>
    </div>
  )
}
