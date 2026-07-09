import { createClient } from '@/lib/supabase/server'
import { ChangePasswordForm } from '@/components/change-password-form'
import { PageHeader } from '@/components/ui/page-header'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen">
      <PageHeader title="Configurações" subtitle="Gerencie sua conta" />

      <div className="p-8 max-w-2xl">
        <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100 border border-gray-200 animate-fade-in-up dark:bg-gray-900 dark:divide-gray-800 dark:border-gray-800">
          <div className="px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 dark:text-gray-500">Conta</p>
            <div className="space-y-3">
              <InfoRow label="Email" value={user?.email ?? '—'} />
              <InfoRow label="ID" value={user?.id ?? '—'} mono />
              <InfoRow label="Provedor" value={user?.app_metadata?.provider ?? 'email'} />
            </div>
          </div>

          {user?.email && <ChangePasswordForm email={user.email} />}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm text-gray-900 dark:text-gray-100 ${mono ? 'font-mono text-xs' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  )
}
