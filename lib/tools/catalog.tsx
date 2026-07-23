import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export const ALL_TOOLS = [
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
  {
    href: '/dashboard/ferramentas/rede-extrato',
    slug: 'rede-extrato',
    title: 'Extrato Rede',
    description: 'Consulta o extrato de vendas do lojista direto na API da Rede (sandbox)',
    inputs: 'API',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3M3.75 4.5h16.5a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5z" />
      </svg>
    ),
    accent: '#dc2626',
  },
]

export type ToolCatalogEntry = (typeof ALL_TOOLS)[number]

// Reaproveitada pelo grid de "/dashboard/ferramentas" e pelos atalhos do
// Dashboard — mesma regra de acesso nos dois lugares, uma única fonte.
export async function getAccessibleTools(
  supabase: SupabaseServerClient,
  userId: string,
  isAdmin: boolean
): Promise<ToolCatalogEntry[]> {
  const accessibleSlugs = new Set<string>()

  if (isAdmin) {
    // Admin vê todas as ferramentas, mas uma ferramenta desativada some do
    // painel igual para todo mundo — pode ser reativada em /dashboard/admin,
    // ou acessada direto pela URL (requireToolAccess libera admin mesmo inativa).
    const { data: activeTools } = await supabase.from('tools').select('slug').eq('active', true)
    const activeSlugs = new Set((activeTools ?? []).map(t => t.slug))
    ALL_TOOLS.forEach(t => { if (activeSlugs.has(t.slug)) accessibleSlugs.add(t.slug) })
  } else {
    const { data: accessRows } = await supabase
      .from('user_tool_access')
      .select('tool_id')
      .eq('user_id', userId)

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

  return ALL_TOOLS.filter(t => accessibleSlugs.has(t.slug))
}
