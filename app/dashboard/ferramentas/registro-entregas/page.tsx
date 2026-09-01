'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { Tabs, TabPanel, type TabDef } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'

type Categoria = 'automacao' | 'melhoria' | 'problema' | 'projeto' | 'treinamento' | 'outro'
type View = 'add' | 'report'

interface Entry {
  id: string
  data: string
  categoria: Categoria
  titulo: string
  detalhe: string | null
  impacto: string | null
  criado_em: string
}

interface AdminUser {
  id: string
  email: string
  full_name: string | null
}

const CATEGORIAS: Categoria[] = ['automacao', 'melhoria', 'problema', 'projeto', 'treinamento', 'outro']

const CATEGORIA_OPTION_LABELS: Record<Categoria, string> = {
  automacao: 'Automação',
  melhoria: 'Melhoria de processo',
  problema: 'Resolução de problema',
  projeto: 'Projeto especial',
  treinamento: 'Treinamento / reunião',
  outro: 'Outro',
}

const CATEGORIA_BADGE_LABELS: Record<Categoria, string> = {
  automacao: 'Automação',
  melhoria: 'Melhoria',
  problema: 'Problema',
  projeto: 'Projeto',
  treinamento: 'Treinamento',
  outro: 'Outro',
}

const CATEGORIA_TONE: Record<Categoria, BadgeProps['tone']> = {
  automacao: 'sky',
  melhoria: 'green',
  problema: 'amber',
  projeto: 'purple',
  treinamento: 'blue',
  outro: 'gray',
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const inputBase = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30'

const COMPANY_NAME = 'Krambeck Autopeças e Tintas'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabelText(d: Date): string {
  return `${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

function fmtDataBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const EMPTY_FORM = { data: todayISO(), categoria: 'automacao' as Categoria, titulo: '', detalhe: '', impacto: '' }

export default function RegistroEntregasPage() {
  const [view, setView] = useState<View>('add')
  const [isAdmin, setIsAdmin] = useState(false)
  const [myName, setMyName] = useState<string | null>(null)

  const [myEntries, setMyEntries] = useState<Entry[]>([])
  const [loadingMy, setLoadingMy] = useState(true)

  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [reportEntries, setReportEntries] = useState<Entry[]>([])
  const [loadingReport, setLoadingReport] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => new Date())

  async function loadMine() {
    setLoadingMy(true)
    try {
      const res = await fetch('/api/ferramentas/registro-entregas')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao carregar registros.')
      setMyEntries(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setLoadingMy(false)
    }
  }

  async function loadReport(userId: string | null) {
    if (!userId) {
      setReportEntries(myEntries)
      return
    }
    setLoadingReport(true)
    try {
      const res = await fetch(`/api/ferramentas/registro-entregas?userId=${userId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao carregar registros.')
      setReportEntries(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setLoadingReport(false)
    }
  }

  useEffect(() => {
    loadMine()
    fetch('/api/profile/me').then(r => r.json()).then(data => {
      setIsAdmin(data.role === 'admin')
      setMyName(data.fullName ?? null)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetch('/api/admin/users').then(r => r.json()).then((data: AdminUser[]) => setAdminUsers(data ?? [])).catch(() => {})
    }
  }, [isAdmin])

  useEffect(() => {
    if (view === 'report') loadReport(selectedUserId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedUserId, myEntries])

  async function submitForm() {
    if (!form.titulo.trim()) {
      setFormError('Descreva o que você fez.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch('/api/ferramentas/registro-entregas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: form.data || todayISO(),
          categoria: form.categoria,
          titulo: form.titulo.trim(),
          detalhe: form.detalhe.trim(),
          impacto: form.impacto.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao salvar registro.')
      setForm({ ...EMPTY_FORM, data: todayISO() })
      await loadMine()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setSaving(false)
    }
  }

  async function removeEntry(id: string) {
    if (!confirm('Remover este registro?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/ferramentas/registro-entregas/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await loadMine()
    } catch {
      setError('Não foi possível remover agora.')
    } finally {
      setDeletingId(null)
    }
  }

  const filteredReport = reportEntries
    .filter(e => e.data.startsWith(monthKey(viewMonth)))
    .sort((a, b) => a.data.localeCompare(b.data))

  const counts = {
    automacao: filteredReport.filter(e => e.categoria === 'automacao').length,
    melhoria: filteredReport.filter(e => e.categoria === 'melhoria').length,
    problema: filteredReport.filter(e => e.categoria === 'problema').length,
  }

  const reportPersonName = selectedUserId
    ? (adminUsers.find(u => u.id === selectedUserId)?.full_name ?? adminUsers.find(u => u.id === selectedUserId)?.email ?? '—')
    : (myName ?? '—')

  const tabs: TabDef<View>[] = [
    { key: 'add', label: 'Registrar', count: myEntries.length, border: 'border-brand-navy dark:border-blue-400', text: 'text-brand-navy dark:text-blue-400' },
    { key: 'report', label: 'Relatório Mensal', count: filteredReport.length, border: 'border-brand-navy dark:border-blue-400', text: 'text-brand-navy dark:text-blue-400' },
  ]

  function renderEntryCard(entry: Entry, deletable: boolean) {
    return (
      <Card key={entry.id} padding="5" className="mb-3">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {fmtDataBR(entry.data)} · <Badge tone={CATEGORIA_TONE[entry.categoria]}>{CATEGORIA_BADGE_LABELS[entry.categoria]}</Badge>
          </span>
          {deletable && (
            <button
              onClick={() => removeEntry(entry.id)}
              disabled={deletingId === entry.id}
              className="print:hidden text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
            >
              {deletingId === entry.id ? 'removendo…' : 'remover'}
            </button>
          )}
        </div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.titulo}</p>
        {entry.detalhe && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-snug">{entry.detalhe}</p>}
        {entry.impacto && <p className="text-sm text-green-700 dark:text-green-400 mt-1.5">✓ {entry.impacto}</p>}
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <div className="print:hidden">
        <PageHeader title="Registro de Entregas" subtitle="O que você produziu além da rotina — para o relatório mensal ao gestor" />
      </div>

      <div className="px-8 py-8 max-w-3xl mx-auto">
        <div className="print:hidden mb-5">
          <Tabs tabs={tabs} activeTab={view} onChange={setView} />
        </div>

        {error && (
          <div className="print:hidden mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {view === 'add' && (
          <TabPanel tabKey="add">
            <Card padding="6" className="print:hidden mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Data</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className={inputBase} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Categoria</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as Categoria }))} className={inputBase}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{CATEGORIA_OPTION_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">O que você fez</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  className={inputBase}
                  placeholder="Ex: Automatizei o envio do resumo bancário"
                />
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Detalhes (opcional)</label>
                <textarea
                  value={form.detalhe}
                  onChange={e => setForm(f => ({ ...f, detalhe: e.target.value }))}
                  className={inputBase}
                  rows={2}
                  placeholder="Contexto, ferramentas usadas, quem foi envolvido..."
                />
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Resultado / impacto (opcional)</label>
                <input
                  type="text"
                  value={form.impacto}
                  onChange={e => setForm(f => ({ ...f, impacto: e.target.value }))}
                  className={inputBase}
                  placeholder="Ex: reduziu 20 min do fechamento diário"
                />
              </div>
              {formError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{formError}</p>}
              <Button onClick={submitForm} loading={saving} className="w-full mt-4">Adicionar registro</Button>
            </Card>

            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Últimos registros</p>
            {loadingMy ? (
              <div className="flex items-center justify-center gap-3 py-12">
                <Spinner size="lg" className="text-blue-600" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Carregando…</span>
              </div>
            ) : myEntries.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">Nenhum registro ainda. Adicione o primeiro acima.</p>
            ) : (
              myEntries.slice(0, 8).map(e => renderEntryCard(e, true))
            )}
          </TabPanel>
        )}

        {view === 'report' && (
          <TabPanel tabKey="report">
            {isAdmin && (
              <div className="print:hidden mb-4">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Ver relatório de</label>
                <select
                  value={selectedUserId ?? ''}
                  onChange={e => setSelectedUserId(e.target.value || null)}
                  className={inputBase + ' sm:w-auto'}
                >
                  <option value="">Eu mesmo</option>
                  {adminUsers.map(u => <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>)}
                </select>
              </div>
            )}

            <div className="print:hidden">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Relatório de Entregas — {monthLabelText(viewMonth)}
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 mb-4">Atividades realizadas além da rotina padrão</p>

              <div className="flex items-center justify-between mb-5">
                <Button variant="ghost" onClick={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>← Mês anterior</Button>
                <Button variant="ghost" onClick={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>Próximo mês →</Button>
              </div>

              <Button variant="secondary" onClick={() => window.print()} className="w-full mb-6">
                Imprimir / salvar como PDF
              </Button>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <KpiCard label="Total" value={filteredReport.length} accent="#4a7c59" />
                <KpiCard label="Automações" value={counts.automacao} accent="#0369a1" />
                <KpiCard label="Melhorias" value={counts.melhoria} accent="#22c55e" />
                <KpiCard label="Problemas resolvidos" value={counts.problema} accent="#d97706" />
              </div>

              {loadingReport ? (
                <div className="flex items-center justify-center gap-3 py-12">
                  <Spinner size="lg" className="text-blue-600" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Carregando…</span>
                </div>
              ) : filteredReport.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">Nenhum registro neste mês.</p>
              ) : (
                filteredReport.map(e => renderEntryCard(e, selectedUserId === null))
              )}
            </div>

            {/* Documento formal — só existe no PDF/impressão (hidden na tela). Layout
                próprio em vez de reaproveitar os cards acima: aqui é texto corrido com
                cabeçalho de identidade (empresa/pessoa/período) e cada entrega separada
                por um filete fino, sem bordas/sombra "de tela" e sem quebrar no meio de
                uma página (break-inside-avoid). */}
            <div className="hidden print:block text-black">
              <div className="border-b-2 border-black pb-3 mb-5">
                <p className="text-[10px] uppercase tracking-widest text-gray-600">{COMPANY_NAME}</p>
                <h1 className="text-lg font-bold mt-0.5">Registro de Entregas</h1>
                <p className="text-sm text-gray-700 mt-0.5">{reportPersonName} · {monthLabelText(viewMonth)}</p>
              </div>

              <p className="text-xs text-gray-700 mb-5">
                {filteredReport.length} {filteredReport.length === 1 ? 'entrega' : 'entregas'} · {counts.automacao} automações · {counts.melhoria} melhorias · {counts.problema} problemas resolvidos
              </p>

              {filteredReport.length === 0 ? (
                <p className="text-sm text-gray-600">Nenhum registro neste mês.</p>
              ) : (
                filteredReport.map(e => (
                  <div key={e.id} className="py-3 border-t border-gray-300 break-inside-avoid">
                    <p className="text-[10px] text-gray-500">{fmtDataBR(e.data)} · {CATEGORIA_BADGE_LABELS[e.categoria]}</p>
                    <p className="text-sm font-semibold mt-0.5">{e.titulo}</p>
                    {e.detalhe && <p className="text-xs text-gray-700 mt-1 leading-snug">{e.detalhe}</p>}
                    {e.impacto && <p className="text-xs text-gray-700 mt-1">Impacto: {e.impacto}</p>}
                  </div>
                ))
              )}

              <p className="text-[9px] text-gray-400 mt-6 pt-2 border-t border-gray-200">
                Gerado em {new Date().toLocaleString('pt-BR')}
              </p>
            </div>
          </TabPanel>
        )}
      </div>
    </div>
  )
}
