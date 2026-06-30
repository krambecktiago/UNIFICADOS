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
    <div className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Bom dia, {firstName}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Último acesso: {lastLogin}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#0d1e45] flex items-center justify-center text-white text-sm font-bold">
              {firstName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 max-w-5xl">

        {/* Acesso rápido */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Acesso Rápido</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/dashboard/ferramentas"
              className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-[#0d1e45] hover:shadow-sm transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#0d1e45' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0d1e45] transition-colors">Ferramentas</p>
                <p className="text-xs text-gray-400 mt-0.5">Acesse as ferramentas disponíveis</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300 ml-auto group-hover:text-[#0d1e45] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/dashboard/ia"
              className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-[#0d1e45] hover:shadow-sm transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0d1e45] transition-colors">Análise IA</p>
                <p className="text-xs text-gray-400 mt-0.5">Gere análises com inteligência artificial</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300 ml-auto group-hover:text-[#0d1e45] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Informações da plataforma */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Plataforma</h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            <InfoRow label="Versão" value="1.0.0" />
            <InfoRow label="Empresa" value="Krambeck Autopeças e Tintas" />
            <InfoRow label="Rede" value="Rede Ancora" />
            <InfoRow label="Suporte" value="tiago@krambeck.com.br" />
          </div>
        </div>

      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  )
}
