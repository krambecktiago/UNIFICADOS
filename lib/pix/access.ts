import type { SupabaseClient } from '@supabase/supabase-js'

// Mesma lógica de requireToolAccess('pix'), mas retorna boolean em vez de
// redirecionar — para uso em rotas de API que precisam responder JSON 403.
export async function hasPixAccess(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.role === 'admin') return true

  const { data: tool } = await supabase
    .from('tools')
    .select('id')
    .eq('slug', 'pix')
    .eq('active', true)
    .maybeSingle()

  if (!tool) return false

  const { data: access } = await supabase
    .from('user_tool_access')
    .select('user_id')
    .eq('user_id', userId)
    .eq('tool_id', tool.id)
    .maybeSingle()

  return !!access
}
