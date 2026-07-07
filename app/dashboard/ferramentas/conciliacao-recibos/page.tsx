'use client'

import { useState, useRef, useEffect } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, TableCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { FileInput } from '@/components/ui/file-input'
import { Tabs, TabPanel, type TabDef } from '@/components/ui/tabs'
import { TH_CLASS as thClass, TH_RIGHT_CLASS as thRight, TD_CLASS as tdClass, TD_RIGHT_CLASS as tdRight } from '@/components/ui/table'

interface Venda {
  data: string
  valor: number
  modalidade: string
  bandeira: string
  nsu: string
  autorizacao: string
  maquininha: string
  loja: string
  lojaNumero: string
  parcelas: number
}

interface Recibo {
  cliente: string
  recibo: string
  nsu: string
  autorizacao: string
  dataMvto: string
  dataEmissao: string
  valor: number
  loja: string
  parcelas: number
}

interface MatchedEntry {
  venda: Venda
  recibo: Recibo
  divergente: boolean
  diferenca: number
  motivo: 'valor' | 'identificador'
  parcelasDivergentes: boolean
}

interface Summary {
  vendasTotal: number
  vendasValor: number
  okCount: number
  okValor: number
  divergentCount: number
  missingCount: number
  missingValor: number
  pendingCount: number
  pendingValor: number
}

interface ApiResponse {
  matched: MatchedEntry[]
  divergent: MatchedEntry[]
  missing: Venda[]
  pending: Recibo[]
  summary: Summary
}

type Tab = 'missing' | 'ok' | 'divergent' | 'pending'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function lojaLabel(venda: Venda) {
  return venda.lojaNumero ? `${venda.loja} (${venda.lojaNumero})` : venda.loja
}

// Espelha a rolagem horizontal da tabela numa barra fina logo abaixo das
// abas, para não precisar rolar a página até o rodapé pra achar o scroll
// nativo do navegador.
function TopScrollbar({ targetRef, watch }: { targetRef: React.RefObject<HTMLDivElement | null>; watch: unknown }) {
  const topRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const syncing = useRef(false)

  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    const update = () => setWidth(el.scrollWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch])

  function fromTop() {
    if (syncing.current) { syncing.current = false; return }
    const bottom = targetRef.current
    if (!bottom || !topRef.current) return
    syncing.current = true
    bottom.scrollLeft = topRef.current.scrollLeft
  }

  useEffect(() => {
    const bottom = targetRef.current
    const top = topRef.current
    if (!bottom || !top) return
    const fromBottom = () => {
      if (syncing.current) { syncing.current = false; return }
      syncing.current = true
      top.scrollLeft = bottom.scrollLeft
    }
    bottom.addEventListener('scroll', fromBottom)
    return () => bottom.removeEventListener('scroll', fromBottom)
  }, [targetRef])

  if (width <= 0) return null

  return (
    <div ref={topRef} onScroll={fromTop} className="overflow-x-auto overflow-y-hidden border-b border-gray-100" style={{ height: 14 }}>
      <div style={{ width, height: 1 }} />
    </div>
  )
}

export default function ConciliacaoRecibosPage() {
  const [vendasFile, setVendasFile] = useState<File | null>(null)
  const [recibosFile, setRecibosFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('missing')
  const [exporting, setExporting] = useState(false)

  const vendasRef = useRef<HTMLInputElement>(null)
  const recibosRef = useRef<HTMLInputElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  const canProcess = !!vendasFile && !!recibosFile && !loading

  async function handleProcess() {
    if (!vendasFile || !recibosFile) return
    setLoading(true)
    setError(null)
    setData(null)
    setActiveTab('missing')
    try {
      const formData = new FormData()
      formData.append('vendasFile', vendasFile)
      formData.append('recibosFile', recibosFile)
      const res = await fetch('/api/ferramentas/conciliacao-recibos', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Erro ${res.status}`)
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    if (!data) return
    setExporting(true)
    try {
      const res = await fetch('/api/ferramentas/conciliacao-recibos/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Erro ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'conciliacao-recibos.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao exportar planilha.')
    } finally {
      setExporting(false)
    }
  }

  function handleReset() {
    setVendasFile(null)
    setRecibosFile(null)
    setData(null)
    setError(null)
    setActiveTab('missing')
    if (vendasRef.current) vendasRef.current.value = ''
    if (recibosRef.current) recibosRef.current.value = ''
  }

  const tabs: TabDef<Tab>[] = data
    ? [
        { key: 'missing',    label: 'Vendas sem recibo',    count: data.summary.missingCount,   border: 'border-orange-500', text: 'text-orange-600' },
        { key: 'ok',         label: 'Conciliados',          count: data.summary.okCount,        border: 'border-green-500',  text: 'text-green-600'  },
        { key: 'divergent',  label: 'Divergências',         count: data.summary.divergentCount, border: 'border-amber-500',  text: 'text-amber-600'  },
        { key: 'pending',    label: 'Recibos sem venda',    count: data.summary.pendingCount,   border: 'border-gray-400',   text: 'text-gray-600'   },
      ]
    : []

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Conciliação de Recibos"
        subtitle="Confere vendas no cartão (Rede) x recibos emitidos pelo sistema, por NSU + Autorização."
      />

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">

        <Card padding="5" className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Arquivos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FileInput ref={vendasRef} label="Vendas Rede (.xlsx)" accept=".xlsx" file={vendasFile} onChange={setVendasFile} />
            <FileInput ref={recibosRef} label="Recibos Emitidos (.xlsx)" accept=".xlsx" file={recibosFile} onChange={setRecibosFile} />
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={handleProcess} disabled={!canProcess} loading={loading}>
              {loading ? 'Processando…' : 'Processar Conciliação'}
            </Button>
            {(vendasFile || recibosFile || data || error) && !loading && (
              <Button variant="ghost" onClick={handleReset}>Limpar</Button>
            )}
          </div>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 animate-fade-in-up">
            <span className="font-medium">Erro:</span> {error}
          </div>
        )}

        {data && (
          <>
            <div className="flex items-center gap-4 animate-fade-in-up">
              <div className="flex-1">
                {data.summary.missingCount === 0 && data.summary.divergentCount === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
                    Tudo conciliado — {data.summary.okCount} venda(s) com recibo. Total vendas: {fmtBRL(data.summary.vendasValor)}
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                    <span className="font-semibold">{data.summary.missingCount} venda(s) sem recibo</span>
                    {' '}·{' '}{fmtBRL(data.summary.missingValor)}
                    {' '}·{' '}{data.summary.divergentCount} divergência(s)
                    {' '}·{' '}{data.summary.okCount} conciliados
                  </div>
                )}
              </div>
              <Button variant="secondary" onClick={handleExport} loading={exporting} className="shrink-0">
                {exporting ? 'Exportando…' : 'Exportar Excel'}
              </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Vendas no Período" value={data.summary.vendasValor} format={fmtBRL} sub={`${data.summary.vendasTotal} venda(s)`} accent="#0369a1" />
              <KpiCard label="Conciliado" value={data.summary.okValor} format={fmtBRL} sub={`${data.summary.okCount} venda(s)`} accent="#22c55e" />
              <KpiCard label="Sem Recibo" value={data.summary.missingValor} format={fmtBRL} sub={`${data.summary.missingCount} venda(s)`} accent="#f97316" />
              <KpiCard label="Recibos sem Venda" value={data.summary.pendingValor} format={fmtBRL} sub={`${data.summary.pendingCount} recibo(s)`} accent="#9ca3af" />
            </div>

            <TableCard>
              <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

              <TopScrollbar targetRef={tableScrollRef} watch={`${activeTab}-${data.matched.length}-${data.divergent.length}-${data.missing.length}-${data.pending.length}`} />

              <div ref={tableScrollRef} className="overflow-x-auto">
                <TabPanel tabKey={activeTab}>

                {activeTab === 'missing' && (
                  <table className="w-full text-sm min-w-[780px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className={thClass} style={{ width: 96 }}>Data</th>
                        <th className={thClass}>Loja</th>
                        <th className={thRight} style={{ width: 110 }}>Valor</th>
                        <th className={thClass}>Modalidade</th>
                        <th className={thClass}>Bandeira</th>
                        <th className={thClass}>NSU</th>
                        <th className={thClass}>Autorização</th>
                        <th className={thClass}>Maquininha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.missing.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">Nenhuma venda sem recibo.</td></tr>
                      ) : data.missing.map((v, i) => (
                        <tr key={i} className="bg-orange-50 hover:bg-orange-100 transition-colors">
                          <td className={tdClass}>{v.data}</td>
                          <td className={tdClass + ' font-medium'}>{lojaLabel(v)}</td>
                          <td className={tdRight + ' text-orange-800'}>{fmtBRL(v.valor)}</td>
                          <td className={tdClass}>{v.modalidade}</td>
                          <td className={tdClass}>{v.bandeira}</td>
                          <td className={tdClass + ' font-mono text-xs'}>{v.nsu}</td>
                          <td className={tdClass + ' font-mono text-xs'}>{v.autorizacao}</td>
                          <td className={tdClass + ' font-mono text-xs'}>{v.maquininha}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'ok' && (
                  <table className="w-full text-sm min-w-[820px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className={thClass} style={{ width: 96 }}>Data</th>
                        <th className={thClass}>Loja</th>
                        <th className={thRight} style={{ width: 110 }}>Valor</th>
                        <th className={thClass}>NSU</th>
                        <th className={thClass}>Autorização</th>
                        <th className={thClass}>Cliente</th>
                        <th className={thClass}>Recibo</th>
                        <th className={thClass} style={{ width: 100 }}>Emissão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.matched.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">Nenhum item conciliado.</td></tr>
                      ) : data.matched.map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className={tdClass}>{m.venda.data}</td>
                          <td className={tdClass + ' font-medium'}>{lojaLabel(m.venda)}</td>
                          <td className={tdRight + ' text-green-800'}>{fmtBRL(m.venda.valor)}</td>
                          <td className={tdClass + ' font-mono text-xs'}>{m.venda.nsu}</td>
                          <td className={tdClass + ' font-mono text-xs'}>{m.venda.autorizacao}</td>
                          <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">{m.recibo.cliente}</td>
                          <td className={tdClass + ' font-mono text-xs'}>{m.recibo.recibo}</td>
                          <td className={tdClass}>{m.recibo.dataEmissao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'divergent' && (
                  <table className="w-full text-sm min-w-[1080px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className={thClass} style={{ width: 96 }}>Data</th>
                        <th className={thClass}>Loja</th>
                        <th className={thClass} style={{ width: 220 }}>Motivo</th>
                        <th className={thRight} style={{ width: 110 }}>Valor Venda</th>
                        <th className={thRight} style={{ width: 110 }}>Valor Recibo</th>
                        <th className={thRight} style={{ width: 150 }}>Diferença</th>
                        <th className={thRight} style={{ width: 130 }}>Parcelas (venda / recibo)</th>
                        <th className={thClass}>NSU (venda / recibo)</th>
                        <th className={thClass}>Autorização (venda / recibo)</th>
                        <th className={thClass}>Cliente</th>
                        <th className={thClass}>Recibo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.divergent.length === 0 ? (
                        <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-gray-400">Nenhuma divergência encontrada.</td></tr>
                      ) : data.divergent.map((m, i) => (
                        <tr key={i} className="bg-amber-50 hover:bg-amber-100 transition-colors">
                          <td className={tdClass}>{m.venda.data}</td>
                          <td className={tdClass + ' font-medium'}>{lojaLabel(m.venda)}</td>
                          <td className={tdClass}>
                            <div className="flex flex-wrap gap-1">
                              {m.motivo === 'identificador' ? (
                                <Badge tone="purple">NSU/Autorização não conferem</Badge>
                              ) : Math.abs(m.diferenca) > 0.01 ? (
                                <Badge tone="amber">Valor diferente</Badge>
                              ) : null}
                              {m.parcelasDivergentes && <Badge tone="sky">Parcelas diferentes</Badge>}
                            </div>
                          </td>
                          <td className={tdRight + ' text-amber-800'}>{fmtBRL(m.venda.valor)}</td>
                          <td className={tdRight + ' text-amber-800'}>{fmtBRL(m.recibo.valor)}</td>
                          <td className={tdRight + ' font-semibold ' + (Math.abs(m.diferenca) <= 0.01 ? '' : m.diferenca > 0 ? 'text-red-700' : 'text-blue-700')}>
                            {Math.abs(m.diferenca) <= 0.01 ? '' : `${m.diferenca > 0 ? 'Recibo +' : 'Recibo '}${fmtBRL(m.diferenca)}`}
                          </td>
                          <td className={tdRight + (m.parcelasDivergentes ? ' font-semibold text-sky-700' : '')}>
                            {m.venda.parcelas === m.recibo.parcelas ? m.venda.parcelas : `${m.venda.parcelas} / ${m.recibo.parcelas}`}
                          </td>
                          <td className={tdClass + ' font-mono text-xs'}>
                            {m.venda.nsu === m.recibo.nsu ? m.venda.nsu : `${m.venda.nsu} / ${m.recibo.nsu}`}
                          </td>
                          <td className={tdClass + ' font-mono text-xs'}>
                            {m.venda.autorizacao === m.recibo.autorizacao ? m.venda.autorizacao : `${m.venda.autorizacao} / ${m.recibo.autorizacao}`}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">{m.recibo.cliente}</td>
                          <td className={tdClass + ' font-mono text-xs'}>{m.recibo.recibo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'pending' && (
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className={thClass} style={{ width: 100 }}>Mvto Adquirente</th>
                        <th className={thClass}>Loja</th>
                        <th className={thRight} style={{ width: 110 }}>Valor</th>
                        <th className={thClass}>NSU</th>
                        <th className={thClass}>Autorização</th>
                        <th className={thClass}>Cliente</th>
                        <th className={thClass}>Recibo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.pending.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Nenhum recibo sem venda correspondente.</td></tr>
                      ) : data.pending.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className={tdClass}>{r.dataMvto}</td>
                          <td className={tdClass + ' font-medium'}>{r.loja}</td>
                          <td className={tdRight}>{fmtBRL(r.valor)}</td>
                          <td className={tdClass + ' font-mono text-xs'}>{r.nsu}</td>
                          <td className={tdClass + ' font-mono text-xs'}>{r.autorizacao}</td>
                          <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">{r.cliente}</td>
                          <td className={tdClass + ' font-mono text-xs'}>{r.recibo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                </TabPanel>
              </div>
            </TableCard>
          </>
        )}
      </div>
    </div>
  )
}
