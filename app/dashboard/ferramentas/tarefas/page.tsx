'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, TableCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { Tabs, TabPanel, type TabDef } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type View = 'para-mim' | 'criadas' | 'todas' | 'log'
type StatusFilter = 'pendente' | 'concluida' | 'todas'
type Acao = 'criada' | 'editada' | 'concluida' | 'reaberta' | 'excluida'

interface Tarefa {
  id: string
  titulo: string
  observacao: string | null
  status: 'pendente' | 'concluida'
  explicacao_conclusao: string | null
  criado_por: string | null
  criado_por_nome: string
  atribuido_para: string
  atribuido_para_nome: string
  concluido_em: string | null
  criado_em: string
}

interface UsuarioOpcao {
  id: string
  name: string
}

interface LogEntry {
  id: string
  tarefa_id: string
  tarefa_titulo: string
  user_nome: string
  acao: Acao
  detalhe: string | null
  criado_em: string
}

const ACAO_LABEL: Record<Acao, string> = {
  criada: 'Criou',
  editada: 'Editou',
  concluida: 'Concluiu',
  reaberta: 'Reabriu',
  excluida: 'Excluiu',
}

const ACAO_TONE: Record<Acao, BadgeProps['tone']> = {
  criada: 'blue',
  editada: 'gray',
  concluida: 'green',
  reaberta: 'amber',
  excluida: 'red',
}

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'pendente', label: 'Pendentes' },
  { key: 'concluida', label: 'Concluídas' },
  { key: 'todas', label: 'Todas' },
]

const inputBase = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30'
const labelBase = 'block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5'

const EMPTY_FORM = { titulo: '', observacao: '', atribuidoPara: '' }

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function TarefasPage() {
  const [view, setView] = useState<View>('para-mim')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pendente')
  const [me, setMe] = useState<{ id: string; isAdmin: boolean } | null>(null)

  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([])
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Estado por cartão: só um cartão fica em modo "concluir" ou "editar" por vez.
  const [concluindoId, setConcluindoId] = useState<string | null>(null)
  const [explicacao, setExplicacao] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [cardError, setCardError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [log, setLog] = useState<LogEntry[]>([])
  const [loadingLog, setLoadingLog] = useState(false)

  async function loadTarefas() {
    try {
      const res = await fetch('/api/ferramentas/tarefas')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao carregar tarefas.')
      setTarefas(json.data ?? [])
      setMe(json.me ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  async function loadLog() {
    setLoadingLog(true)
    try {
      const res = await fetch('/api/ferramentas/tarefas/log')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao carregar log.')
      setLog(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setLoadingLog(false)
    }
  }

  useEffect(() => {
    loadTarefas()
    fetch('/api/ferramentas/tarefas/usuarios').then(r => r.json()).then(json => setUsuarios(json.data ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (view === 'log') loadLog()
  }, [view])

  function resetCardState() {
    setConcluindoId(null)
    setEditandoId(null)
    setExplicacao('')
    setCardError(null)
  }

  async function criarTarefa() {
    if (!form.atribuidoPara) return setFormError('Escolha para quem é a tarefa.')
    if (!form.titulo.trim()) return setFormError('Informe o título da tarefa.')
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch('/api/ferramentas/tarefas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: form.titulo.trim(), observacao: form.observacao.trim(), atribuidoPara: form.atribuidoPara }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao criar tarefa.')
      setForm(EMPTY_FORM)
      await loadTarefas()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setSaving(false)
    }
  }

  async function patchTarefa(id: string, payload: Record<string, string>) {
    setBusyId(id)
    setCardError(null)
    try {
      const res = await fetch(`/api/ferramentas/tarefas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao atualizar tarefa.')
      resetCardState()
      await loadTarefas()
    } catch (e) {
      setCardError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setBusyId(null)
    }
  }

  async function excluirTarefa(id: string) {
    if (!confirm('Excluir esta tarefa? Ela some para você e para o responsável.')) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/ferramentas/tarefas/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await loadTarefas()
    } catch {
      setError('Não foi possível excluir agora.')
    } finally {
      setBusyId(null)
    }
  }

  const paraMim = tarefas.filter(t => t.atribuido_para === me?.id)
  const criadas = tarefas.filter(t => t.criado_por === me?.id)
  const base = view === 'para-mim' ? paraMim : view === 'criadas' ? criadas : tarefas
  const visiveis = statusFilter === 'todas' ? base : base.filter(t => t.status === statusFilter)

  const pendentes = (list: Tarefa[]) => list.filter(t => t.status === 'pendente').length

  const tabs: TabDef<View>[] = [
    { key: 'para-mim', label: 'Para mim', count: pendentes(paraMim), border: 'border-brand-navy dark:border-blue-400', text: 'text-brand-navy dark:text-blue-400' },
    { key: 'criadas', label: 'Criadas por mim', count: pendentes(criadas), border: 'border-brand-navy dark:border-blue-400', text: 'text-brand-navy dark:text-blue-400' },
    ...(me?.isAdmin ? [
      { key: 'todas' as const, label: 'Todas (admin)', count: pendentes(tarefas), border: 'border-brand-navy dark:border-blue-400', text: 'text-brand-navy dark:text-blue-400' },
      { key: 'log' as const, label: 'Log', count: log.length, border: 'border-brand-navy dark:border-blue-400', text: 'text-brand-navy dark:text-blue-400' },
    ] : []),
  ]

  function renderTarefa(t: Tarefa) {
    const isResponsavel = t.atribuido_para === me?.id
    const isCriador = t.criado_por === me?.id
    const busy = busyId === t.id

    if (editandoId === t.id) {
      return (
        <Card key={t.id} padding="5" className="mb-3">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelBase}>Responsável</label>
              <select value={editForm.atribuidoPara} onChange={e => setEditForm(f => ({ ...f, atribuidoPara: e.target.value }))} className={inputBase}>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelBase}>Título</label>
              <input type="text" value={editForm.titulo} onChange={e => setEditForm(f => ({ ...f, titulo: e.target.value }))} className={inputBase} />
            </div>
            <div>
              <label className={labelBase}>Observação</label>
              <textarea value={editForm.observacao} onChange={e => setEditForm(f => ({ ...f, observacao: e.target.value }))} className={inputBase} rows={3} />
            </div>
          </div>
          {cardError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{cardError}</p>}
          <div className="flex gap-2 mt-4">
            <Button loading={busy} onClick={() => patchTarefa(t.id, { action: 'editar', ...editForm })}>Salvar</Button>
            <Button variant="secondary" onClick={resetCardState}>Cancelar</Button>
          </div>
        </Card>
      )
    }

    return (
      <Card key={t.id} padding="5" className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge tone={t.status === 'pendente' ? 'amber' : 'green'}>{t.status === 'pendente' ? 'Pendente' : 'Concluída'}</Badge>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {t.criado_por_nome} → <span className="font-medium text-gray-600 dark:text-gray-300">{t.atribuido_para_nome}</span> · {fmtDataHora(t.criado_em)}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.titulo}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-xs">
            {isCriador && t.status === 'pendente' && (
              <button
                onClick={() => { resetCardState(); setEditandoId(t.id); setEditForm({ titulo: t.titulo, observacao: t.observacao ?? '', atribuidoPara: t.atribuido_para }) }}
                className="text-gray-400 dark:text-gray-500 hover:text-brand-navy dark:hover:text-blue-400"
              >
                editar
              </button>
            )}
            {(isCriador || me?.isAdmin) && (
              <button onClick={() => excluirTarefa(t.id)} disabled={busy} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400">
                excluir
              </button>
            )}
          </div>
        </div>

        {t.observacao && (
          <div className="mt-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Como fazer</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 leading-snug whitespace-pre-line">{t.observacao}</p>
          </div>
        )}

        {t.status === 'concluida' && (
          <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900">
            <p className="text-[11px] font-medium uppercase tracking-wide text-green-700 dark:text-green-400">
              Concluída{t.concluido_em ? ` em ${fmtDataHora(t.concluido_em)}` : ''}
            </p>
            <p className="text-sm text-green-900 dark:text-green-200 mt-0.5 leading-snug whitespace-pre-line">{t.explicacao_conclusao}</p>
          </div>
        )}

        {t.status === 'pendente' && isResponsavel && concluindoId !== t.id && (
          <Button variant="secondary" className="mt-4" onClick={() => { resetCardState(); setConcluindoId(t.id) }}>
            Marcar como concluída
          </Button>
        )}

        {concluindoId === t.id && (
          <div className="mt-4">
            <label className={labelBase}>Como a tarefa foi resolvida</label>
            <textarea
              value={explicacao}
              onChange={e => setExplicacao(e.target.value)}
              className={inputBase}
              rows={3}
              autoFocus
              placeholder="Explique o que foi feito para concluir..."
            />
            {cardError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{cardError}</p>}
            <div className="flex gap-2 mt-3">
              <Button
                loading={busy}
                onClick={() => explicacao.trim() ? patchTarefa(t.id, { action: 'concluir', explicacao: explicacao.trim() }) : setCardError('Explique como a tarefa foi concluída.')}
              >
                Concluir tarefa
              </Button>
              <Button variant="secondary" onClick={resetCardState}>Cancelar</Button>
            </div>
          </div>
        )}

        {t.status === 'concluida' && (isCriador || isResponsavel) && (
          <button
            onClick={() => patchTarefa(t.id, { action: 'reabrir' })}
            disabled={busy}
            className="mt-3 text-xs text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400"
          >
            {busy ? 'reabrindo…' : 'reabrir tarefa'}
          </button>
        )}
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <PageHeader title="Tarefas" subtitle="Atribua tarefas a outros usuários e acompanhe até a conclusão" />

      <div className="px-8 py-8 max-w-3xl mx-auto">
        <Card padding="6" className="mb-6">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Nova tarefa</p>
          <div>
            <label className={labelBase}>Atribuir para</label>
            <select value={form.atribuidoPara} onChange={e => setForm(f => ({ ...f, atribuidoPara: e.target.value }))} className={inputBase}>
              <option value="">Selecione um usuário…</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (eu)` : u.name}</option>)}
            </select>
          </div>
          <div className="mt-4">
            <label className={labelBase}>Título</label>
            <input
              type="text"
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              className={inputBase}
              placeholder="Ex: Conferir os boletos vencidos da loja L02"
            />
          </div>
          <div className="mt-4">
            <label className={labelBase}>Observação — como deve ser feita (opcional)</label>
            <textarea
              value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              className={inputBase}
              rows={3}
              placeholder="Passo a passo, onde encontrar as informações, prazo combinado..."
            />
          </div>
          {formError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{formError}</p>}
          <Button onClick={criarTarefa} loading={saving} className="w-full mt-4">Criar tarefa</Button>
        </Card>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <KpiCard label="Pendentes para mim" value={pendentes(paraMim)} accent="#d97706" />
          <KpiCard label="Aguardando outros" value={criadas.filter(t => t.status === 'pendente' && t.atribuido_para !== me?.id).length} accent="#4f46e5" />
          <KpiCard label="Concluídas para mim" value={paraMim.length - pendentes(paraMim)} accent="#16a34a" />
        </div>

        <div className="mb-5">
          <Tabs tabs={tabs} activeTab={view} onChange={v => { resetCardState(); setView(v) }} />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {view !== 'log' ? (
          <TabPanel tabKey={view}>
            <div className="flex gap-2 mb-4">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    statusFilter === f.key
                      ? 'bg-brand-navy text-white border-brand-navy'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-3 py-12">
                <Spinner size="lg" className="text-blue-600" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Carregando…</span>
              </div>
            ) : visiveis.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">Nenhuma tarefa aqui.</p>
            ) : (
              visiveis.map(renderTarefa)
            )}
          </TabPanel>
        ) : (
          <TabPanel tabKey="log">
            {loadingLog ? (
              <div className="flex items-center justify-center gap-3 py-12">
                <Spinner size="lg" className="text-blue-600" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Carregando…</span>
              </div>
            ) : log.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">Nenhuma ação registrada ainda.</p>
            ) : (
              <TableCard className="divide-y divide-gray-100 dark:divide-gray-800">
                {log.map(l => (
                  <div key={l.id} className="px-5 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={ACAO_TONE[l.acao]}>{ACAO_LABEL[l.acao]}</Badge>
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        <span className="font-medium">{l.user_nome}</span> · {l.tarefa_titulo}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{fmtDataHora(l.criado_em)}</span>
                    </div>
                    {l.detalhe && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-line">{l.detalhe}</p>}
                  </div>
                ))}
              </TableCard>
            )}
          </TabPanel>
        )}
      </div>
    </div>
  )
}
