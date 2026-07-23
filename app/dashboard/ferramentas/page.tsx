import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { getAccessibleTools } from '@/lib/tools/catalog'

export default async function FerramentasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'

  const tools = await getAccessibleTools(supabase, user!.id, isAdmin)

  return (
    <div className="min-h-screen">
      <PageHeader title="Ferramentas" subtitle="Selecione uma ferramenta para processar seus arquivos" />

      <div className="px-8 py-8">
        {tools.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Nenhuma ferramenta disponível</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Entre em contato com o administrador para solicitar acesso.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tools.map((tool, i) => (
              <Link
                key={tool.href}
                href={tool.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white dark:bg-gray-900 rounded-xl p-6 hover:shadow-xl hover:-translate-y-0.5 transition-all border border-gray-200 dark:border-gray-800 animate-fade-in-up"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white"
                    style={{ backgroundColor: tool.accent }}
                  >
                    {tool.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-navy transition-colors leading-snug">
                        {tool.title}
                      </h3>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-brand-navy transition-colors shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{tool.description}</p>
                    <span
                      className="inline-block mt-3 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                      style={{ color: tool.accent, borderColor: tool.accent + '33', backgroundColor: tool.accent + '0d' }}
                    >
                      {tool.inputs}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
