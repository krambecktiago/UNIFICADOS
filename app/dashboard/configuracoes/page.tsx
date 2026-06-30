import { createClient } from '@/lib/supabase/server'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Configurações</h2>
      <p className="text-sm text-gray-500 mb-8">Gerencie sua conta</p>

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        <div className="px-6 py-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Conta</p>
          <div className="space-y-3">
            <InfoRow label="Email" value={user?.email ?? '—'} />
            <InfoRow label="ID" value={user?.id ?? '—'} mono />
            <InfoRow label="Provedor" value={user?.app_metadata?.provider ?? 'email'} />
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm text-gray-900 ${mono ? 'font-mono text-xs' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  )
}
