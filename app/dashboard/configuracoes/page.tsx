import { createClient } from '@/lib/supabase/server'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen">
      <div className="h-[68px] bg-white border-b border-gray-200 dark:bg-[#060f26] dark:border-white/10 px-8 flex items-center">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Configurações</h2>
          <p className="text-xs text-gray-400 dark:text-white/40 leading-tight mt-0.5">Gerencie sua conta</p>
        </div>
      </div>

      <div className="p-8 max-w-2xl">
        <div className="bg-white rounded-xl shadow-sm dark:shadow-lg overflow-hidden divide-y divide-gray-100 border border-gray-200 dark:border-white/10">
          <div className="px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Conta</p>
            <div className="space-y-3">
              <InfoRow label="Email" value={user?.email ?? '—'} />
              <InfoRow label="ID" value={user?.id ?? '—'} mono />
              <InfoRow label="Provedor" value={user?.app_metadata?.provider ?? 'email'} />
            </div>
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
