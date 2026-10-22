import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/session'

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
// Usa after() do Next.js para processar em background após a resposta ser enviada,
// eliminando o atraso de rede e renderizando a ferramenta imediatamente para o usuário.
export async function logToolVisit(toolSlug: string) {
  const user = await getSessionUser()
  if (!user) return
  const userId = user.id

  after(async () => {
    try {
      const admin = createAdminClient()
      const { error } = await admin
        .from('tool_usage_logs')
        .insert({ user_id: userId, tool_slug: toolSlug, files_count: 0 })
      if (error) console.error('Erro ao registrar visita à ferramenta em background:', error)
    } catch (err) {
      console.error('Erro ao registrar visita à ferramenta em background:', err)
    }
  })
}
