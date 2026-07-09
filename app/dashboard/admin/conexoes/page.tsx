'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

interface Integration {
  id: string
  slug: string
  name: string
  type: 'webhook' | 'api_key' | 'other'
  value: string
  description: string | null
  updated_at: string
}

const TYPE_LABELS: Record<Integration['type'], string> = {
  webhook: 'Webhook',
  api_key: 'API Key',
  other: 'Outro',
}

function mask(value: string): string {
  if (!value) return '— não configurado —'
  if (value.length <= 8) return '•'.repeat(value.length)
  return value.slice(0, 6) + '•'.repeat(Math.min(value.length - 10, 24)) + value.slice(-4)
}

export default function ConexoesPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ name: string; value: string; description: string }>({ name: '', value: '', description: '' })
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<Integration['type']>('webhook')
  const [newValue, setNewValue] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  function load() {
    setLoading(true)
    fetch('/api/admin/integrations')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setIntegrations(data)
        else setError(data.error ?? 'Erro ao carregar conexões')
      })
      .catch(() => setError('Erro de rede'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function toggleReveal(id: string) {
    setRevealed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startEdit(integration: Integration) {
    setEditingId(integration.id)
    setDraft({ name: integration.name, value: integration.value, description: integration.description ?? '' })
    setTestMsg(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(id: string) {
    setSaving(id)
    try {
      const res = await fetch(`/api/admin/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft.name, value: draft.value, description: draft.description }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Erro ao salvar')
        return
      }
      setIntegrations(prev => prev.map(i => i.id === id ? data : i))
      setEditingId(null)
    } catch {
      alert('Erro de rede')
    } finally {
      setSaving(null)
    }
  }

  async function deleteIntegration(integration: Integration) {
    if (!confirm(`Excluir a conexão "${integration.name}"? Ferramentas que dependem dela deixarão de funcionar.`)) return
    setSaving(integration.id)
    try {
      const res = await fetch(`/api/admin/integrations/${integration.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Erro ao excluir')
        return
      }
      setIntegrations(prev => prev.filter(i => i.id !== integration.id))
    } catch {
      alert('Erro de rede')
    } finally {
      setSaving(null)
    }
  }

  async function testIntegration(integration: Integration) {
    setTesting(integration.id)
    setTestMsg(null)
    try {
      const res = await fetch(`/api/admin/integrations/${integration.id}/test`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setTestMsg({ id: integration.id, type: 'error', text: data.error ?? 'Erro ao testar' })
        return
      }
      setTestMsg({ id: integration.id, type: 'success', text: 'Teste enviado com sucesso.' })
    } catch {
      setTestMsg({ id: integration.id, type: 'error', text: 'Erro de rede' })
    } finally {
      setTesting(null)
    }
  }

  function openCreateForm() {
    setShowCreateForm(true)
    setNewSlug('')
    setNewName('')
    setNewType('webhook')
    setNewValue('')
    setNewDescription('')
    setCreateError('')
  }

  async function createIntegration(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: newSlug, name: newName, type: newType, value: newValue, description: newDescription }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error ?? 'Erro ao criar conexão')
        return
      }
      setIntegrations(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setShowCreateForm(false)
    } catch {
      setCreateError('Erro de rede')
    } finally {
      setCreating(false)
    }
  }

  const inputBase = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700'

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Conexões"
        subtitle="Credenciais de API e webhooks usados pelas ferramentas, centralizadas em um só lugar."
        right={
          <div className="flex items-center gap-3">
            {!loading && !error && (
              <Badge tone="navy">
                {integrations.length} {integrations.length === 1 ? 'conexão' : 'conexões'}
              </Badge>
            )}
            <button
              onClick={openCreateForm}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-navy text-white hover:bg-brand-navy-hover transition-colors flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Nova conexão
            </button>
          </div>
        }
      />

      <div className="px-8 py-8">
        {showCreateForm && (
          <form onSubmit={createIntegration} className="mb-6 bg-white rounded-xl p-6 border border-gray-200 animate-fade-in-up space-y-4 dark:bg-gray-900 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nova conexão</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1 dark:text-gray-500">Identificador (slug)</label>
                <input
                  type="text"
                  required
                  value={newSlug}
                  onChange={e => setNewSlug(e.target.value)}
                  className={inputBase}
                  placeholder="ex: discord-alertas"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1 dark:text-gray-500">Nome</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className={inputBase}
                  placeholder="ex: Discord — Alertas"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1 dark:text-gray-500">Tipo</label>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value as Integration['type'])}
                  className={inputBase}
                >
                  <option value="webhook">Webhook</option>
                  <option value="api_key">API Key</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1 dark:text-gray-500">Valor</label>
                <input
                  type="text"
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  className={inputBase}
                  placeholder="URL do webhook ou chave"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1 dark:text-gray-500">Descrição (opcional)</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className={inputBase}
                  placeholder="Onde essa conexão é usada"
                />
              </div>
            </div>

            {createError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:text-red-400 dark:bg-red-950/40 dark:border-red-900">{createError}</p>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" loading={creating}>
                {creating ? 'Criando...' : 'Criar conexão'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreateForm(false)} disabled={creating}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {loading && (
          <div className="flex items-center gap-3 text-sm text-gray-400 dark:text-gray-500">
            <Spinner size="md" />
            Carregando conexões...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && integrations.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma conexão cadastrada.</p>
        )}

        <div className="space-y-4">
          {integrations.map(integration => {
            const isSaving = saving === integration.id
            const isEditing = editingId === integration.id
            const isRevealed = revealed.has(integration.id)
            return (
              <Card key={integration.id} padding="6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{integration.name}</p>
                      <Badge tone="gray">{TYPE_LABELS[integration.type]}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 font-mono mt-0.5 dark:text-gray-500">{integration.slug}</p>
                    {integration.description && (
                      <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{integration.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button type="button" variant="secondary" onClick={() => testIntegration(integration)} loading={testing === integration.id}>
                      {testing === integration.id ? 'Testando…' : 'Testar'}
                    </Button>
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(integration)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        Editar
                      </button>
                    )}
                    <button
                      onClick={() => deleteIntegration(integration)}
                      disabled={isSaving}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                {testMsg?.id === integration.id && (
                  <p className={`mt-3 text-sm ${testMsg.type === 'success' ? 'text-green-700 font-medium dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {testMsg.text}
                  </p>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1 dark:text-gray-500">Nome</label>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                          className={inputBase}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1 dark:text-gray-500">Valor</label>
                        <input
                          type="text"
                          value={draft.value}
                          onChange={e => setDraft(d => ({ ...d, value: e.target.value }))}
                          className={inputBase + ' font-mono'}
                          placeholder="URL do webhook ou chave"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1 dark:text-gray-500">Descrição</label>
                        <input
                          type="text"
                          value={draft.description}
                          onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                          className={inputBase}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" onClick={() => saveEdit(integration.id)} loading={isSaving}>
                          {isSaving ? 'Salvando…' : 'Salvar'}
                        </Button>
                        <Button type="button" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono text-gray-700 truncate dark:text-gray-300">
                        {isRevealed ? (integration.value || '— não configurado —') : mask(integration.value)}
                      </p>
                      {integration.value && (
                        <button
                          onClick={() => toggleReveal(integration.id)}
                          className="text-gray-400 hover:text-gray-600 shrink-0 dark:text-gray-500 dark:hover:text-gray-300"
                          title={isRevealed ? 'Ocultar' : 'Revelar'}
                        >
                          {isRevealed ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
