'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, TableCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { Spinner } from '@/components/ui/spinner'
import { TH_CLASS, TD_CLASS } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { CHECKLIST, TAB_LABELS, itemId, sectionTotal, countChecked, type PeriodTab, type ItemState } from './data'
import { exportEvaluationPdf } from './pdf'

interface Evaluation {
  id: string
  nome_avaliado: string
  tipo: PeriodTab
  itens: Record<string, ItemState>
  finalizada: boolean
  criado_em: string
  atualizado_em: string
}

const inputBase = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30'

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function ChecklistCaixasPage() {
  const [view, setView] = useState<'list' | 'evaluate'>('list')
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [nomeAvaliado, setNomeAvaliado] = useState('')
  const [tipo, setTipo] = useState<PeriodTab>('weekly')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [current, setCurrent] = useState<Evaluation | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ferramentas/checklist-caixas')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao carregar avaliações.')
      setEvaluations(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function startEvaluation() {
    if (!nomeAvaliado.trim()) {
      setFormError('Informe o nome da pessoa avaliada.')
      return
    }
    setCreating(true)
    setFormError(null)
    try {
      const res = await fetch('/api/ferramentas/checklist-caixas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeAvaliado: nomeAvaliado.trim(), tipo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao iniciar avaliação.')
      setCurrent(json.data)
      setFormOpen(false)
      setNomeAvaliado('')
      setView('evaluate')
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setCreating(false)
    }
  }

  function backToList() {
    setView('list')
    setCurrent(null)
    load()
  }

  async function persistItens(next: Record<string, ItemState>, finalizada?: boolean) {
    if (!current) return
    setCurrent({ ...current, itens: next, ...(finalizada !== undefined ? { finalizada } : {}) })
    try {
      const res = await fetch(`/api/ferramentas/checklist-caixas/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: next, ...(finalizada !== undefined ? { finalizada } : {}) }),
      })
      if (!res.ok) throw new Error()
      setError(null)
    } catch {
      setError('Não foi possível salvar agora — tente novamente.')
    }
  }

  function toggleItem(id: string) {
    if (!current) return
    persistItens({ ...current.itens, [id]: { ...current.itens[id], checked: !current.itens[id]?.checked } })
  }

  function editComment(id: string, comentario: string) {
    if (!current) return
    setCurrent({ ...current, itens: { ...current.itens, [id]: { ...current.itens[id], comentario } } })
  }

  function commitComment() {
    if (!current) return
    persistItens(current.itens)
  }

  async function finalizeAndExport() {
    if (!current) return
    await persistItens(current.itens, true)
    exportEvaluationPdf({
      nomeAvaliado: current.nome_avaliado,
      tipo: current.tipo,
      sections: CHECKLIST[current.tipo],
      itens: current.itens,
      criadoEm: current.criado_em,
    })
  }

  async function removeEvaluation(id: string) {
    if (!confirm('Excluir esta avaliação? Essa ação não pode ser desfeita.')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/ferramentas/checklist-caixas/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      setError('Não foi possível excluir agora.')
    } finally {
      setDeletingId(null)
    }
  }

  const total = current ? sectionTotal(CHECKLIST[current.tipo]) : 0
  const checked = current ? countChecked(current.itens) : 0
  const pct = total ? Math.round((checked / total) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <PageHeader
        title="Checklist Equipe de Caixas"
        subtitle="Avaliação individual, semanal ou mensal, com comentários e exportação em PDF"
      />

      <div className="px-8 py-8 max-w-4xl mx-auto">
        {view === 'list' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <KpiCard label="Avaliações registradas" value={evaluations.length} accent="#4a7c59" />
              <KpiCard label="Finalizadas" value={evaluations.filter(e => e.finalizada).length} accent="#0369a1" />
            </div>

            <Card padding="6" className="mb-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Nova avaliação</p>
                {!formOpen && <Button onClick={() => setFormOpen(true)}>+ Nova avaliação</Button>}
              </div>

              {formOpen && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 sm:items-end animate-fade-in-up">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Nome da pessoa</label>
                    <input
                      type="text"
                      value={nomeAvaliado}
                      onChange={e => setNomeAvaliado(e.target.value)}
                      className={inputBase}
                      placeholder="Ex: Maria Silva"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tipo</label>
                    <select value={tipo} onChange={e => setTipo(e.target.value as PeriodTab)} className={inputBase + ' sm:w-auto'}>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={startEvaluation} loading={creating}>Iniciar</Button>
                    <Button variant="ghost" onClick={() => { setFormOpen(false); setFormError(null) }}>Cancelar</Button>
                  </div>
                </div>
              )}
              {formError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{formError}</p>}
            </Card>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center gap-3 py-12">
                <Spinner size="lg" className="text-blue-600" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Carregando…</span>
              </div>
            ) : (
              <TableCard>
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Avaliações</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className={TH_CLASS}>Pessoa</th>
                        <th className={TH_CLASS}>Tipo</th>
                        <th className={TH_CLASS}>Data</th>
                        <th className={TH_CLASS}>Progresso</th>
                        <th className={TH_CLASS}>Status</th>
                        <th className={TH_CLASS}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluations.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                            Nenhuma avaliação registrada ainda.
                          </td>
                        </tr>
                      ) : evaluations.map(ev => {
                        const evTotal = sectionTotal(CHECKLIST[ev.tipo])
                        const evChecked = countChecked(ev.itens)
                        return (
                          <tr key={ev.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <td className={TD_CLASS + ' font-medium'}>{ev.nome_avaliado}</td>
                            <td className={TD_CLASS}><Badge tone="gray">{TAB_LABELS[ev.tipo]}</Badge></td>
                            <td className={TD_CLASS + ' tabular-nums'}>{fmtData(ev.criado_em)}</td>
                            <td className={TD_CLASS + ' tabular-nums'}>{evChecked}/{evTotal}</td>
                            <td className={TD_CLASS}>
                              <Badge tone={ev.finalizada ? 'green' : 'amber'}>{ev.finalizada ? 'Finalizada' : 'Rascunho'}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 flex-nowrap whitespace-nowrap">
                                <Button variant="secondary" className="text-xs px-2 py-1" onClick={() => { setCurrent(ev); setView('evaluate') }}>
                                  Abrir
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="text-xs px-2 py-1"
                                  onClick={() => exportEvaluationPdf({
                                    nomeAvaliado: ev.nome_avaliado,
                                    tipo: ev.tipo,
                                    sections: CHECKLIST[ev.tipo],
                                    itens: ev.itens,
                                    criadoEm: ev.criado_em,
                                  })}
                                >
                                  Exportar PDF
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="text-xs px-2 py-1 text-red-500 hover:text-red-600"
                                  loading={deletingId === ev.id}
                                  onClick={() => removeEvaluation(ev.id)}
                                >
                                  Excluir
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </TableCard>
            )}
          </>
        )}

        {view === 'evaluate' && current && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{current.nome_avaliado}</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {TAB_LABELS[current.tipo]} · iniciada em {fmtData(current.criado_em)}
                </p>
              </div>
              <Button variant="ghost" onClick={backToList}>← Voltar</Button>
            </div>

            <Card padding="5" className="mb-4">
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-right mt-1.5">
                {checked} de {total} conferidos ({pct}%)
              </p>
            </Card>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {CHECKLIST[current.tipo].map((section, sIdx) => (
                <Card key={section.title} padding="5">
                  <p className="text-xs font-medium text-brand-navy dark:text-blue-400 uppercase tracking-wide mb-3">
                    {section.title}
                  </p>
                  <div className="space-y-3">
                    {section.items.map((text, iIdx) => {
                      const id = itemId(sIdx, iIdx)
                      const state = current.itens[id] ?? {}
                      const isChecked = !!state.checked
                      return (
                        <div key={id} className="border-b border-gray-50 dark:border-gray-800 last:border-0 pb-3 last:pb-0">
                          <div
                            onClick={() => toggleItem(id)}
                            className="flex items-start gap-3 -mx-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <div
                              className={cn(
                                'w-5 h-5 mt-0.5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                                isChecked ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'
                              )}
                            >
                              {isChecked && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </div>
                            <span className={cn('text-sm leading-snug', isChecked ? 'text-gray-700 dark:text-gray-300' : 'text-gray-800 dark:text-gray-200')}>
                              {text}
                            </span>
                          </div>
                          <textarea
                            value={state.comentario ?? ''}
                            onChange={e => editComment(id, e.target.value)}
                            onBlur={commitComment}
                            placeholder="Comentário (opcional)"
                            rows={1}
                            className="mt-1 ml-8 w-[calc(100%-2rem)] px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 resize-y"
                          />
                        </div>
                      )
                    })}
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={finalizeAndExport}>Finalizar e exportar PDF</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
