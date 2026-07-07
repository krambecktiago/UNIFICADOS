'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

interface AdminUser {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'user'
  tools: string[]
  created_at: string
}

interface ToolOption {
  slug: string
  label: string
}

interface ManagedTool {
  id: string
  slug: string
  name: string
  active: boolean
}

// Telas (não ferramentas de processamento) que reaproveitam a tabela "tools"
// só para controle de acesso — mesmo critério usado no Dashboard.
const SCREEN_SLUGS = ['dashboard', 'configuracoes']

const ALL_SCREENS = [
  { slug: 'dashboard', label: 'Dashboard' },
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

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null)
  const [allTools, setAllTools] = useState<ToolOption[]>([])
  const [manageTools, setManageTools] = useState<ManagedTool[]>([])
  const [toolsError, setToolsError] = useState('')
  const [savingToolId, setSavingToolId] = useState<string | null>(null)

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

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('tools')
      .select('slug, name')
      .eq('active', true)
      .then(({ data }) => {
        const tools = (data ?? [])
          .filter(t => !SCREEN_SLUGS.includes(t.slug))
          .map(t => ({ slug: t.slug, label: t.name }))
        setAllTools(tools)
      })
  }, [])

  useEffect(() => {
    fetch('/api/admin/tools')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setManageTools(data.filter(t => !SCREEN_SLUGS.includes(t.slug)))
        else setToolsError(data.error ?? 'Erro ao carregar ferramentas')
      })
      .catch(() => setToolsError('Erro de rede'))
  }, [])

  async function toggleToolActive(tool: ManagedTool) {
    const newActive = !tool.active
    setSavingToolId(tool.id)
    setManageTools(prev => prev.map(t => t.id === tool.id ? { ...t, active: newActive } : t))

    try {
      const res = await fetch(`/api/admin/tools/${tool.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? 'Erro ao salvar')
        setManageTools(prev => prev.map(t => t.id === tool.id ? { ...t, active: tool.active } : t))
        return
      }
      if (!newActive) setAllTools(prev => prev.filter(t => t.slug !== tool.slug))
      else setAllTools(prev => [...prev, { slug: tool.slug, label: tool.name }])
    } catch {
      alert('Erro de rede')
      setManageTools(prev => prev.map(t => t.id === tool.id ? { ...t, active: tool.active } : t))
    } finally {
      setSavingToolId(null)
    }
  }

  async function patchUser(userId: string, body: Partial<{ role: string; tools: string[]; full_name: string }>) {
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

  function openCreateForm() {
    setShowCreateForm(true)
    setNewName('')
    setNewEmail('')
    setNewPassword(generatePassword())
    setCreateError('')
  }

  function closeCreateForm() {
    setShowCreateForm(false)
    setCreateError('')
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: newName, email: newEmail, password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error ?? 'Erro ao criar usuário')
        return
      }
      setUsers(prev => [...prev, data].sort((a, b) => a.email.localeCompare(b.email)))
      setCreatedCredentials({ email: newEmail, password: newPassword })
      setShowCreateForm(false)
    } catch {
      setCreateError('Erro de rede')
    } finally {
      setCreating(false)
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

  function startEdit(user: AdminUser) {
    setEditingId(user.id)
    setDraftName(user.full_name ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
    setDraftName('')
  }

  async function saveName(user: AdminUser) {
    const newName = draftName.trim()
    if (!newName || newName === user.full_name) {
      cancelEdit()
      return
    }

    const previousName = user.full_name
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, full_name: newName } : u))
    setEditingId(null)

    const ok = await patchUser(user.id, { full_name: newName })
    if (!ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, full_name: previousName } : u))
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
      <PageHeader
        title="Administração"
        subtitle="Gerencie usuários e acessos às ferramentas"
        right={
          <div className="flex items-center gap-3">
            {!loading && !error && (
              <Badge tone="navy">
                {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
              </Badge>
            )}
            <button
              onClick={openCreateForm}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-navy text-white hover:bg-brand-navy-hover transition-colors flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Novo usuário
            </button>
          </div>
        }
      />

      <div className="px-8 py-8">
        {createdCredentials && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
            <div className="text-sm text-green-800">
              <p className="font-semibold">Usuário criado com sucesso.</p>
              <p className="mt-0.5">
                Email: <strong>{createdCredentials.email}</strong> · Senha provisória: <strong>{createdCredentials.password}</strong>
              </p>
              <p className="text-xs text-green-700 mt-1">Compartilhe essa senha com o usuário — ela não será exibida novamente.</p>
            </div>
            <button onClick={() => setCreatedCredentials(null)} className="text-green-700 hover:opacity-70 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {showCreateForm && (
          <form onSubmit={createUser} className="mb-6 bg-white rounded-xl p-6 border border-gray-200 animate-fade-in-up space-y-4">
            <p className="text-sm font-semibold text-gray-900">Novo usuário</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Nome completo</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                  placeholder="Nome do usuário"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                  placeholder="email@krambeck.com.br"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Senha provisória</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                  />
                  <button
                    type="button"
                    onClick={() => setNewPassword(generatePassword())}
                    title="Gerar nova senha"
                    className="px-2.5 border border-gray-200 rounded-lg text-gray-500 bg-white hover:bg-gray-50 shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                  </button>
                </div>
              </div>
            </div>

            {createError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" loading={creating}>
                {creating ? 'Criando...' : 'Criar usuário'}
              </Button>
              <Button type="button" variant="ghost" onClick={closeCreateForm} disabled={creating}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        <Card padding="6" className="mb-6">
          <p className="text-sm font-semibold text-gray-900 mb-1">Ferramentas do sistema</p>
          <p className="text-xs text-gray-400 mb-4">Uma ferramenta inativa some do painel de todos os usuários com acesso a ela, mesmo que já tenha sido liberada.</p>

          {toolsError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{toolsError}</p>
          )}

          {!toolsError && manageTools.length === 0 && (
            <p className="text-sm text-gray-400">Nenhuma ferramenta cadastrada.</p>
          )}

          <div className="flex flex-wrap gap-2">
            {manageTools.map(tool => (
              <button
                key={tool.id}
                onClick={() => toggleToolActive(tool)}
                disabled={savingToolId === tool.id}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all disabled:opacity-40 ${
                  tool.active
                    ? 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}
                title={tool.active ? 'Clique para desativar' : 'Clique para reativar'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${tool.active ? 'bg-green-500' : 'bg-red-400'}`} />
                {tool.name}
                <span className="text-[10px] font-bold uppercase tracking-wide opacity-60">
                  {tool.active ? 'Ativa' : 'Inativa'}
                </span>
              </button>
            ))}
          </div>
        </Card>

        {loading && (
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <Spinner size="md" />
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
              <Card
                key={user.id}
                padding="6"
              >
                {/* Linha superior: avatar + info + role + ação */}
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: user.role === 'admin' ? 'var(--color-brand-navy)' : '#6b7280' }}
                  >
                    {initials(user)}
                  </div>

                  {/* Nome + email */}
                  <div className="flex-1 min-w-0">
                    {editingId === user.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          type="text"
                          value={draftName}
                          onChange={e => setDraftName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveName(user)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          className="text-sm font-semibold text-gray-900 border border-brand-navy/30 rounded-md px-2 py-0.5 w-full max-w-[220px] focus:outline-none focus:ring-1 focus:ring-brand-navy/40"
                        />
                        <button
                          onClick={() => saveName(user)}
                          className="text-brand-navy hover:opacity-70 shrink-0"
                          title="Salvar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" /></svg>
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-gray-400 hover:opacity-70 shrink-0"
                          title="Cancelar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(user)}
                        className="group flex items-center gap-1.5 text-left"
                        title="Editar nome"
                      >
                        <p className="text-sm font-semibold text-gray-900 truncate">{displayName(user)}</p>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.5-9.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 8.5-8.5z" /></svg>
                      </button>
                    )}
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>

                  {/* Badge role + botão */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={user.role === 'admin' ? 'navy' : 'gray'}>
                      {user.role === 'admin' ? 'Admin' : 'Usuário'}
                    </Badge>
                    <button
                      onClick={() => toggleRole(user)}
                      disabled={isSaving}
                      className={`text-xs font-medium px-3 py-1 rounded-lg border transition-colors disabled:opacity-40 ${
                        user.role === 'admin'
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-brand-navy/20 text-brand-navy hover:bg-brand-navy/5'
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
                              ? 'bg-brand-navy text-white border-brand-navy'
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
                    {allTools.map(tool => {
                      const active = user.tools.includes(tool.slug)
                      return (
                        <button
                          key={tool.slug}
                          onClick={() => toggleTool(user, tool.slug)}
                          disabled={isSaving}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all disabled:opacity-40 ${
                            active
                              ? 'bg-brand-navy text-white border-brand-navy'
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
                    <Spinner size="sm" />
                    Salvando...
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
