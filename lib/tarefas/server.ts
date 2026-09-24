import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const TOOL_SLUG = 'tarefas'

export const SELECT_FIELDS = 'id, titulo, observacao, status, explicacao_conclusao, criado_por, atribuido_para, concluido_em, criado_em, atualizado_em'

export type TarefaAcao = 'criada' | 'editada' | 'concluida' | 'reaberta' | 'excluida'

export interface TarefaRow {
  id: string
  titulo: string
  observacao: string | null
  status: 'pendente' | 'concluida'
  explicacao_conclusao: string | null
  criado_por: string | null
  atribuido_para: string
  concluido_em: string | null
  criado_em: string
  atualizado_em: string
}

export interface TarefaUser {
  id: string
  name: string
}

// Usuário logado + se é admin + se tem a ferramenta liberada. As rotas de
// API não passam pelo requireToolAccess do layout, então a checagem de
// acesso precisa ser refeita aqui — senão qualquer usuário autenticado
// criaria tarefa chamando a API direto.
export async function getTarefasSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, isAdmin: false, hasAccess: false }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const isAdmin = profile?.role === 'admin'
  if (isAdmin) return { supabase, user, isAdmin, hasAccess: true }

  const eligible = await getEligibleUserIds()
  return { supabase, user, isAdmin, hasAccess: eligible.has(user.id) }
}

// Quem pode receber tarefa: usuários com a ferramenta liberada (ativa) +
// admins, que enxergam todas as ferramentas.
export async function getEligibleUserIds(): Promise<Set<string>> {
  const adminClient = createAdminClient()
  const [{ data: tool }, { data: admins }] = await Promise.all([
    adminClient.from('tools').select('id').eq('slug', TOOL_SLUG).eq('active', true).maybeSingle(),
    adminClient.from('profiles').select('id').eq('role', 'admin'),
  ])

  const ids = new Set((admins ?? []).map(a => a.id))
  if (tool) {
    const { data: access } = await adminClient.from('user_tool_access').select('user_id').eq('tool_id', tool.id)
    ;(access ?? []).forEach(a => ids.add(a.user_id))
  }
  return ids
}

// profiles só é legível pelo próprio usuário (ou admin) via RLS, então o
// nome de quem criou/recebeu a tarefa vem pelo service role. Cai no email
// quando o perfil não tem nome.
export async function getUserNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const adminClient = createAdminClient()
  const { data: profiles } = await adminClient.from('profiles').select('id, full_name').in('id', unique)

  const names = new Map<string, string>()
  for (const p of profiles ?? []) {
    if (p.full_name) names.set(p.id, p.full_name)
  }

  // listUsers do Auth é pesado e a tela de Tarefas atualiza a cada 10s —
  // só consulta quando algum perfil está sem nome (raro, o onboarding exige).
  const missing = unique.filter(id => !names.has(id))
  if (missing.length > 0) {
    const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    const emailMap = new Map((authData?.users ?? []).map(u => [u.id, u.email ?? '']))
    missing.forEach(id => names.set(id, emailMap.get(id) || 'Usuário removido'))
  }
  return names
}

export async function withNames(rows: TarefaRow[]) {
  const names = await getUserNames(rows.flatMap(r => [r.criado_por ?? '', r.atribuido_para]))
  return rows.map(r => ({
    ...r,
    criado_por_nome: r.criado_por ? (names.get(r.criado_por) ?? 'Usuário removido') : 'Usuário removido',
    atribuido_para_nome: names.get(r.atribuido_para) ?? 'Usuário removido',
  }))
}

// Falha silenciosamente, igual ao logActivity — o log nunca deve impedir
// a resposta ao usuário.
export async function logTarefa(tarefaId: string, tarefaTitulo: string, userId: string, acao: TarefaAcao, detalhe: string | null = null) {
  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('tarefas_log')
    .insert({ tarefa_id: tarefaId, tarefa_titulo: tarefaTitulo, user_id: userId, acao, detalhe })
  if (error) console.error('Erro ao registrar log de tarefa:', error)
}
