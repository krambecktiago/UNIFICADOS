import { createAdminClient } from '@/lib/supabase/admin'

// Log de atividades pra leitura humana no painel de Admin — complementa o
// tool_usage_logs (que só existe pra alimentar os KPIs agregados do
// Dashboard). Cobre só as ações principais: execução de ferramenta,
// exportação de arquivo e mudanças administrativas. Falha silenciosamente,
// igual ao tool_usage_logs — nunca deve impedir a resposta ao usuário.
export async function logActivity(userId: string | null, action: string, description: string) {
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('activity_logs').insert({ user_id: userId, action, description })
  if (error) console.error('Erro ao registrar atividade:', error)
}
