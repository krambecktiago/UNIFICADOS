'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, TableCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabPanel, type TabDef } from '@/components/ui/tabs'
import { CurrencyInput } from '@/components/ui/currency-input'
import { TH_CLASS as thClass, TH_RIGHT_CLASS as thRight, TD_CLASS as tdClass, TD_RIGHT_CLASS as tdRight } from '@/components/ui/table'
import { formatBRL } from '@/lib/utils/br-format'

const LOJAS = ['L01', 'L02', 'L03', 'L04', 'L05'] as const
type Loja = typeof LOJAS[number]
const LOJAS_LABELS: Record<Loja, string> = {
  L01: 'LOJA01 - MATRIZ',
  L02: 'LOJA02 - INDAIAL',
  L03: 'LOJA03 - DIESEL',
  L04: 'LOJA04 - BLUMENAU',
  L05: 'LOJA05 - GASPAR',
}

type Status = 'pendente' | 'descontado'

interface Desconto {
  id: string
  loja: Loja
  cod_fornecedor: string
  nome_motoboy: string
  duplicata: string
  motivo: string
  valor: number
  data_para_descontar: string
  status: Status
  descontado_em: string | null
  criado_em: string
}

const inputBase = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30'

// data_para_descontar/descontado_em vêm do Supabase como "yyyy-mm-dd" puro
// (coluna date) — nunca usar formatDate/new Date() nelas, que interpretam
// como UTC meia-noite e voltam um dia no fuso de São Paulo. Rearranjo
// direto de string, sem passar por Date.
function fmtDataBR(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

interface FormState {
  loja: Loja
  codFornecedor: string
  nomeMotoboy: string
  duplicata: string
  motivo: string
  valor: number | null
  dataParaDescontar: string
}

const EMPTY_FORM: FormState = {
  loja: 'L01',
  codFornecedor: '',
  nomeMotoboy: '',
  duplicata: '',
  motivo: '',
  valor: null,
  dataParaDescontar: '',
}

export default function DescontoMotoboysPage() {
  const [descontos, setDescontos] = useState<Desconto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [lojaFiltro, setLojaFiltro] = useState<Loja | 'todas'>('todas')
  const [statusTab, setStatusTab] = useState<Status>('pendente')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ferramentas/desconto-motoboys')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao carregar descontos.')
      setDescontos(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    fetch('/api/profile/me').then(r => r.json()).then(data => setIsAdmin(data.role === 'admin')).catch(() => {})
  }, [])

  const filtered = useMemo(
    () => descontos.filter(d => lojaFiltro === 'todas' || d.loja === lojaFiltro),
    [descontos, lojaFiltro]
  )
  const pendentes = filtered.filter(d => d.status === 'pendente')
  const descontados = filtered.filter(d => d.status === 'descontado')

  const valorPendente = pendentes.reduce((sum, d) => sum + d.valor, 0)

  const tabs: TabDef<Status>[] = [
    { key: 'pendente', label: 'Pendentes', count: pendentes.length, border: 'border-amber-500 dark:border-amber-400', text: 'text-amber-600 dark:text-amber-400' },
    { key: 'descontado', label: 'Descontados', count: descontados.length, border: 'border-green-500 dark:border-green-400', text: 'text-green-600 dark:text-green-400' },
  ]
  const rows = statusTab === 'pendente' ? pendentes : descontados

  function openNewForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  function openEditForm(d: Desconto) {
    setEditingId(d.id)
    setForm({
      loja: d.loja,
      codFornecedor: d.cod_fornecedor,
      nomeMotoboy: d.nome_motoboy,
      duplicata: d.duplicata,
      motivo: d.motivo,
      valor: d.valor,
      dataParaDescontar: d.data_para_descontar,
    })
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
  }

  async function submitForm() {
    if (!form.codFornecedor.trim() || !form.nomeMotoboy.trim() || !form.duplicata.trim() || !form.motivo.trim()) {
      setFormError('Preencha todos os campos.')
      return
    }
    if (!form.valor || form.valor <= 0) {
      setFormError('Informe um valor maior que zero.')
      return
    }
    if (!form.dataParaDescontar) {
      setFormError('Informe a data para descontar.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const body = {
        action: editingId ? 'edit' : undefined,
        loja: form.loja,
        codFornecedor: form.codFornecedor.trim(),
        nomeMotoboy: form.nomeMotoboy.trim(),
        duplicata: form.duplicata.trim(),
        motivo: form.motivo.trim(),
        valor: form.valor,
        dataParaDescontar: form.dataParaDescontar,
      }
      const res = await fetch(
        editingId ? `/api/ferramentas/desconto-motoboys/${editingId}` : '/api/ferramentas/desconto-motoboys',
        { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao salvar.')
      closeForm()
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setSaving(false)
    }
  }

  async function runAction(id: string, action: 'mark_done' | 'reopen') {
    setActionId(id)
    try {
      const res = await fetch(`/api/ferramentas/desconto-motoboys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao atualizar.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setActionId(null)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este desconto? Essa ação não pode ser desfeita.')) return
    setActionId(id)
    try {
      const res = await fetch(`/api/ferramentas/desconto-motoboys/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao excluir.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <PageHeader
        title="Desconto Motoboys"
        subtitle="Controla o que precisa ser descontado no pagamento semanal dos motoboys, por loja."
      />

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard label="Pendentes" value={pendentes.length} accent="#d97706" />
          <KpiCard label="Valor pendente" value={valorPendente} format={formatBRL} accent="#dc2626" />
        </div>

        <Card padding="5" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Loja</label>
              <select
                value={lojaFiltro}
                onChange={e => setLojaFiltro(e.target.value as Loja | 'todas')}
                className={inputBase + ' w-auto'}
              >
                <option value="todas">Todas</option>
                {LOJAS.map(l => <option key={l} value={l}>{LOJAS_LABELS[l]}</option>)}
              </select>
            </div>
            {!formOpen && <Button onClick={openNewForm}>+ Novo desconto</Button>}
          </div>

          {formOpen && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4 animate-fade-in-up">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {editingId ? 'Editar desconto' : 'Novo desconto'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Loja</label>
                  <select value={form.loja} onChange={e => setForm(f => ({ ...f, loja: e.target.value as Loja }))} className={inputBase}>
                    {LOJAS.map(l => <option key={l} value={l}>{LOJAS_LABELS[l]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Cód. Fornecedor</label>
                  <input type="text" value={form.codFornecedor} onChange={e => setForm(f => ({ ...f, codFornecedor: e.target.value }))} className={inputBase} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Nome Motoboy</label>
                  <input type="text" value={form.nomeMotoboy} onChange={e => setForm(f => ({ ...f, nomeMotoboy: e.target.value }))} className={inputBase} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Duplicata</label>
                  <input type="text" value={form.duplicata} onChange={e => setForm(f => ({ ...f, duplicata: e.target.value }))} className={inputBase} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Motivo</label>
                  <input type="text" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} className={inputBase} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Valor</label>
                  <CurrencyInput value={form.valor} onChange={v => setForm(f => ({ ...f, valor: v }))} className={inputBase} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Data para descontar</label>
                  <input type="date" value={form.dataParaDescontar} onChange={e => setForm(f => ({ ...f, dataParaDescontar: e.target.value }))} className={inputBase} />
                </div>
              </div>

              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

              <div className="flex items-center gap-3">
                <Button onClick={submitForm} loading={saving}>{editingId ? 'Salvar' : 'Cadastrar'}</Button>
                <Button variant="ghost" onClick={closeForm}>Cancelar</Button>
              </div>
            </div>
          )}
        </Card>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
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
            <Tabs tabs={tabs} activeTab={statusTab} onChange={setStatusTab} />
            <div className="overflow-x-auto">
              <TabPanel tabKey={statusTab}>
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th className={thClass}>Loja</th>
                      <th className={thClass}>Fornecedor</th>
                      <th className={thClass}>Motoboy</th>
                      <th className={thClass}>Duplicata</th>
                      <th className={thClass}>Motivo</th>
                      <th className={thRight}>Valor</th>
                      <th className={thClass}>Data p/ descontar</th>
                      {statusTab === 'descontado' && <th className={thClass}>Descontado em</th>}
                      <th className={thClass}>Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                          {statusTab === 'pendente' ? 'Nenhum desconto pendente.' : 'Nenhum desconto já feito.'}
                        </td>
                      </tr>
                    ) : rows.map(d => (
                      <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className={tdClass}><Badge tone="gray">{LOJAS_LABELS[d.loja]}</Badge></td>
                        <td className={tdClass}>{d.cod_fornecedor}</td>
                        <td className={tdClass}>{d.nome_motoboy}</td>
                        <td className={tdClass + ' font-mono text-xs'}>{d.duplicata}</td>
                        <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-xs truncate">{d.motivo}</td>
                        <td className={tdRight}>{formatBRL(d.valor)}</td>
                        <td className={tdClass}>{fmtDataBR(d.data_para_descontar)}</td>
                        {statusTab === 'descontado' && <td className={tdClass}>{fmtDataBR(d.descontado_em)}</td>}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-nowrap whitespace-nowrap">
                            {d.status === 'pendente' ? (
                              <Button variant="secondary" className="text-xs px-2 py-1" loading={actionId === d.id} onClick={() => runAction(d.id, 'mark_done')}>
                                Descontar
                              </Button>
                            ) : (
                              <Button variant="secondary" className="text-xs px-2 py-1" loading={actionId === d.id} onClick={() => runAction(d.id, 'reopen')}>
                                Reabrir
                              </Button>
                            )}
                            <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => openEditForm(d)}>Editar</Button>
                            {isAdmin && (
                              <Button variant="ghost" className="text-xs px-2 py-1 text-red-500 hover:text-red-600" loading={actionId === d.id} onClick={() => excluir(d.id)}>
                                Excluir
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabPanel>
            </div>
          </TableCard>
        )}
      </div>
    </div>
  )
}
