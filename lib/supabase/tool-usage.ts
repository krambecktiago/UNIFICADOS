import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Registra uma execução de ferramenta para alimentar os cards de
// "Arquivos analisados" e "Ferramentas mais usadas" do Dashboard.
// Falha silenciosamente — não deve impedir a resposta ao usuário.
export async function logToolUsage(
  supabase: SupabaseServerClient,
  userId: string,
  toolSlug: string,
  filesCount: number
) {
  const { error } = await supabase
    .from('tool_usage_logs')
    .insert({ user_id: userId, tool_slug: toolSlug, files_count: filesCount })

  if (error) console.error('Erro ao registrar uso da ferramenta:', error)
}

// Registra a simples entrada na ferramenta (padrão de contagem usado por
// "Distribuição por ferramenta" e "Usuários mais ativos" do Dashboard).
// Chamar no layout.tsx de cada ferramenta, ao lado de requireToolAccess —
// assim toda ferramenta nova já entra na contagem sem precisar de código
// extra em cada rota de processamento.
export async function logToolVisit(toolSlug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await logToolUsage(supabase, user.id, toolSlug, 0)
}
