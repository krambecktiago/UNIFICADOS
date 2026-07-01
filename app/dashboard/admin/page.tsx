'use client'

import { useEffect, useState } from 'react'

interface AdminUser {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'user'
  tools: string[]
  created_at: string
}

const ALL_TOOLS = [
  { slug: 'duplicatas', label: 'Duplicatas' },
  { slug: 'seguro-vida', label: 'Seguro de Vida' },
  { slug: 'contas-pagar', label: 'Contas a Pagar' },
  { slug: 'comparador-dda', label: 'Comp. DDA' },
  { slug: 'conciliacao-cartao', label: 'Conc. Cartão' },
  { slug: 'comparar-extrato', label: 'Conc. Bancária' },
]

const ALL_SCREENS = [
  { slug: 'dashboard', label: 'Dashboard' },
  { slug: 'ia', label: 'Análise IA' },
  { slug: 'configuracoes', label: 'Configurações' },
]

function initials(user: AdminUser): string {
  if (user.full_name) {
    const parts = user.full_name.trim().split(' ')
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return user.email[0].toUpperCase()
}

function displayName(user: AdminUser): string {
  return user.full_name || user.email.split('@')[0]
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setUsers(data)
        else setError(data.error ?? 'Erro ao carregar usuários')
      })
      .catch(() => setError('Erro de rede'))
      .finally(() => setLoading(false))
  }, [])

  async function patchUser(userId: string, body: Partial<{ role: string; tools: string[] }>) {
    setSaving(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? 'Erro ao salvar')
        return false
      }
      return true
    } catch {
      alert('Erro de rede')
      return false
    } finally {
      setSaving(null)
    }
  }

  async function toggleTool(user: AdminUser, slug: string) {
    const hasTool = user.tools.includes(slug)
    const newTools = hasTool
      ? user.tools.filter(s => s !== slug)
      : [...user.tools, slug]

    // optimistic update
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, tools: newTools } : u))

    const ok = await patchUser(user.id, { tools: newTools })
    if (!ok) {
      // rollback
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, tools: user.tools } : u))
    }
  }

  async function toggleRole(user: AdminUser) {
    const newRole = user.role === 'admin' ? 'user' : 'admin'

    // optimistic update
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))

    const ok = await patchUser(user.id, { role: newRole })
    if (!ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: user.role } : u))
    }
  }

  return (
    <div className="min-h-screen">
      {/* Cabeçalho */}
      <div className="h-[68px] bg-white border-b border-gray-200 px-8 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Administração</h1>
          <p className="text-xs text-gray-400 leading-tight mt-0.5">Gerencie usuários e acessos às ferramentas</p>
        </div>
        {!loading && !error && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0d1e45]/10 text-[#0d1e45]">
            {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
          </span>
        )}
      </div>

      <div className="px-8 py-8">
        {loading && (
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Carregando usuários...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <p className="text-sm text-gray-400">Nenhum usuário encontrado.</p>
        )}

        <div className="space-y-4">
          {users.map(user => {
            const isSaving = saving === user.id
            return (
              <div
                key={user.id}
                className="bg-white rounded-xl p-6 transition-all border border-gray-200 shadow-sm"
              >
                {/* Linha superior: avatar + info + role + ação */}
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: user.role === 'admin' ? '#0d1e45' : '#6b7280' }}
                  >
                    {initials(user)}
                  </div>

                  {/* Nome + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName(user)}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>

                  {/* Badge role + botão */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        user.role === 'admin'
                          ? 'bg-[#0d1e45]/10 text-[#0d1e45]'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {user.role === 'admin' ? 'Admin' : 'Usuário'}
                    </span>
                    <button
                      onClick={() => toggleRole(user)}
                      disabled={isSaving}
                      className={`text-xs font-medium px-3 py-1 rounded-lg border transition-colors disabled:opacity-40 ${
                        user.role === 'admin'
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-[#0d1e45]/20 text-[#0d1e45] hover:bg-[#0d1e45]/5'
                      }`}
                    >
                      {user.role === 'admin' ? 'Rebaixar' : 'Promover'}
                    </button>
                  </div>
                </div>

                {/* Chips de telas liberadas */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-2">
                    Telas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SCREENS.map(screen => {
                      const active = user.tools.includes(screen.slug)
                      return (
                        <button
                          key={screen.slug}
                          onClick={() => toggleTool(user, screen.slug)}
                          disabled={isSaving}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all disabled:opacity-40 ${
                            active
                              ? 'bg-[#0d1e45] text-white border-[#0d1e45]'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-gray-300'}`} />
                          {screen.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Chips de ferramentas */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-2">
                    Ferramentas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_TOOLS.map(tool => {
                      const active = user.tools.includes(tool.slug)
                      return (
                        <button
                          key={tool.slug}
                          onClick={() => toggleTool(user, tool.slug)}
                          disabled={isSaving}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all disabled:opacity-40 ${
                            active
                              ? 'bg-[#0d1e45] text-white border-[#0d1e45]'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-gray-300'}`} />
                          {tool.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {isSaving && (
                  <p className="mt-2 text-[11px] text-gray-400 flex items-center gap-1.5">
                    <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Salvando...
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
