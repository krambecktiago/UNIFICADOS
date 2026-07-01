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
