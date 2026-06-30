import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const name = user?.user_metadata?.full_name ?? user?.email ?? 'Usuário'
  const lastLogin = user?.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : '—'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Olá, {name.split(' ')[0]} 👋
        </h2>
        <p className="text-sm text-gray-500 mt-1">Último acesso: {lastLogin}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard title="Ferramentas ativas" value="—" description="em breve" />
        <StatCard title="Análises IA" value="—" description="este mês" />
        <StatCard title="Usuários" value="—" description="na plataforma" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Início rápido</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <QuickAction href="/dashboard/ferramentas" icon="⚙" label="Acessar Ferramentas" />
          <QuickAction href="/dashboard/ia" icon="✦" label="Nova Análise IA" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </div>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">{label}</span>
    </a>
  )
}
