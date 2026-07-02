import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const ALL_TOOLS = [
  {
    href: '/dashboard/ferramentas/duplicatas',
    slug: 'duplicatas',
    title: 'Conferir Duplicatas',
    description: 'Compara retorno bancário com fluxo de caixa do ERP',
    inputs: 'XLSX + TXT',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    accent: '#0d1e45',
  },
  {
    href: '/dashboard/ferramentas/seguro-vida',
    slug: 'seguro-vida',
    title: 'Seguro de Vida',
    description: 'Cruza PDF do seguro com planilha de funcionários',
    inputs: 'PDF + XLSX',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    accent: '#7c3aed',
  },
  {
    href: '/dashboard/ferramentas/contas-pagar',
    slug: 'contas-pagar',
    title: 'Contas a Pagar',
    description: 'Envia resumo diário de pagamentos para o Discord',
    inputs: 'Formulário',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    accent: '#059669',
  },
  {
    href: '/dashboard/ferramentas/comparador-dda',
    slug: 'comparador-dda',
    title: 'Comparador DDA',
    description: 'Cruza boletos DDA com duplicatas de Contas a Pagar',
    inputs: 'TXT + CSV',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
      </svg>
    ),
    accent: '#4f46e5',
  },
  {
    href: '/dashboard/ferramentas/conciliacao-cartao',
    slug: 'conciliacao-cartao',
    title: 'Conciliação Cartão',
    description: 'Cruza vendas no cartão com duplicatas em aberto',
    inputs: 'CSV + TXT',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
    accent: '#c8102e',
  },
  {
    href: '/dashboard/ferramentas/comparar-extrato',
    slug: 'comparar-extrato',
    title: 'Conciliação Bancária',
    description: 'Cruza extrato ERP com extrato Viacredi e identifica divergências',
    inputs: 'TXT + CSV',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    accent: '#0369a1',
  },
  {
    href: '/dashboard/ferramentas/pix',
    slug: 'pix',
    title: 'Conciliação PIX',
    description: 'Concilia pagamentos PIX recebidos (Bradesco) com títulos abertos no ERP JJW',
    inputs: 'Automático',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.36-6.36l-2.12 2.12M8.76 15.24l-2.12 2.12m0-10.72l2.12 2.12m8.48 8.48l-2.12-2.12" />
      </svg>
    ),
    accent: '#32bcad',
  },
  {
    href: '/dashboard/ferramentas/conciliacao-recibos',
    slug: 'conciliacao-recibos',
    title: 'Conciliação de Recibos',
    description: 'Confere vendas no cartão (Rede) x recibos emitidos pelo sistema, por NSU + Autorização',
    inputs: 'XLSX + XLSX',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m-5.25-.75h.008v.008H9.75V7.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.125h.008v.008h-.008v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accent: '#ea580c',
  },
]

export default async function FerramentasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'

  let accessibleSlugs = new Set<string>()
  if (isAdmin) {
    ALL_TOOLS.forEach(t => accessibleSlugs.add(t.slug))
  } else {
    const { data: accessRows } = await supabase
      .from('user_tool_access')
      .select('tool_id')
      .eq('user_id', user!.id)

    const toolIds = (accessRows ?? []).map(a => a.tool_id)
    if (toolIds.length > 0) {
      const { data: toolRows } = await supabase
        .from('tools')
        .select('slug')
        .in('id', toolIds)
        .eq('active', true)
      ;(toolRows ?? []).forEach(t => accessibleSlugs.add(t.slug))
    }
  }

  const tools = ALL_TOOLS.filter(t => accessibleSlugs.has(t.slug))

  return (
    <div className="min-h-screen">
      <div className="h-[68px] bg-white border-b border-gray-200 px-8 flex items-center">
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Ferramentas</h1>
          <p className="text-xs text-gray-400 leading-tight mt-0.5">Selecione uma ferramenta para processar seus arquivos</p>
        </div>
      </div>

      <div className="px-8 py-8">
        {tools.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">Nenhuma ferramenta disponível</p>
            <p className="text-xs text-gray-400 mt-1">Entre em contato com o administrador para solicitar acesso.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group bg-white rounded-xl p-6 hover:shadow-xl transition-all border border-gray-200"
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
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#0d1e45] transition-colors leading-snug">
                        {tool.title}
                      </h3>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300 group-hover:text-[#0d1e45] transition-colors shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{tool.description}</p>
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
