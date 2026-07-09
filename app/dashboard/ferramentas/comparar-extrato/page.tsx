'use client'

import { useState, useRef } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, TableCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { FileInput } from '@/components/ui/file-input'
import { Tabs, TabPanel, type TabDef } from '@/components/ui/tabs'
import { TH_CLASS as thClass, TH_RIGHT_CLASS as thRight, TD_CLASS as tdClass, TD_RIGHT_CLASS as tdRight } from '@/components/ui/table'

interface BankEntry {
  date: string
  desc: string
  ref: string
  valor: number
}

interface ErpEntry {
  date: string
  lanc: string
  valor: number
  desc: string
}

interface MatchedEntry {
  type: '1:1' | 'N:1' | '1:N' | 'ajuste'
  banks: BankEntry[]
  erp: ErpEntry
  erpGroup?: ErpEntry[]
  devolvidos?: ErpEntry[]
}

interface Summary {
  bankTotal: number
  bankCount: number
  okTotal: number
  okCount: number
  missTotal: number
  missCount: number
  pendTotal: number
  pendCount: number
}

interface Side {
  missing: BankEntry[]
  matched: MatchedEntry[]
  pending: ErpEntry[]
  summary: Summary
}

interface ApiResponse {
  entradas: Side & { confirmedDevolvidos: { erp: ErpEntry; bankDebit: BankEntry }[] }
  saidas: Side
}

type Tab = 'miss' | 'ok' | 'pend'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function exportCSV(missing: BankEntry[], label: string) {
  const rows = ['﻿Data;Descrição;Referência Banco;Valor (R$)']
  for (const t of missing) {
    rows.push(`${t.date};${t.desc};${t.ref};${t.valor.toFixed(2).replace('.', ',')}`)
  }
  const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `Faltando_ERP_${label}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  a.click()
}

function ReconciliationSide({
  title,
  bankLabel,
  side,
  activeTab,
  onTabChange,
  onExportMissing,
}: {
  title: string
  bankLabel: string
  side: Side
  activeTab: Tab
  onTabChange: (t: Tab) => void
  onExportMissing: () => void
}) {
  const tabs: TabDef<Tab>[] = [
    { key: 'miss', label: 'Faltando no ERP',   count: side.summary.missCount, border: 'border-orange-500 dark:border-orange-400', text: 'text-orange-600 dark:text-orange-400' },
    { key: 'ok',   label: 'Conciliados',        count: side.summary.okCount,   border: 'border-green-500 dark:border-green-400',  text: 'text-green-600 dark:text-green-400'  },
    { key: 'pend', label: 'Faltando no Banco',  count: side.summary.pendCount, border: 'border-gray-400 dark:border-gray-500',   text: 'text-gray-600 dark:text-gray-400'   },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500">{title}</p>
        {side.summary.missCount > 0 && (
          <Button variant="secondary" onClick={onExportMissing} className="text-xs px-3 py-1.5">
            Exportar Faltando (.csv)
          </Button>
        )}
      </div>

      {side.summary.missCount === 0 ? (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400 font-medium animate-fade-in-up">
          Tudo conciliado — {side.summary.okCount} lançamento(s) conferem. Banco: {fmtBRL(side.summary.bankTotal)} · ERP: {fmtBRL(side.summary.okTotal)}
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-400 animate-fade-in-up">
          <span className="font-semibold">{side.summary.missCount} lançamento(s) faltando no ERP</span>
          {' '}·{' '}{fmtBRL(side.summary.missTotal)}
          {' '}·{' '}{side.summary.okCount} conciliados
          {' '}·{' '}{side.summary.pendCount} aguardando banco
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={`Total ${bankLabel} Banco`} value={side.summary.bankTotal} format={fmtBRL} sub={`${side.summary.bankCount} lançamento(s)`} accent="#0369a1" />
        <KpiCard label="Conciliado" value={side.summary.okTotal} format={fmtBRL} sub={`${side.summary.okCount} lançamento(s)`} accent="#22c55e" />
        <KpiCard label="Faltando no ERP" value={side.summary.missTotal} format={fmtBRL} sub={`${side.summary.missCount} lançamento(s)`} accent="#f97316" />
        <KpiCard label="Faltando no Banco" value={side.summary.pendTotal} format={fmtBRL} sub={`${side.summary.pendCount} lançamento(s)`} accent="#9ca3af" />
      </div>

      <TableCard>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} />

        <div className="overflow-x-auto">
          <TabPanel tabKey={activeTab}>

          {activeTab === 'miss' && (
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className={thClass} style={{ width: 96 }}>Data</th>
                  <th className={thRight} style={{ width: 130 }}>Valor</th>
                  <th className={thClass}>Favorecido / Descrição</th>
                  <th className={thClass} style={{ width: 120 }}>Referência</th>
                  <th className={thClass} style={{ width: 90 }}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {side.missing.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">Nenhum lançamento faltando.</td></tr>
                ) : side.missing.map((row, i) => (
                  <tr key={i} className="bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors">
                    <td className={tdClass}>{row.date}</td>
                    <td className={tdRight + ' text-orange-800'}>{fmtBRL(row.valor)}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-xs truncate">{row.desc}</td>
                    <td className={tdClass + ' font-mono text-xs'}>{row.ref}</td>
                    <td className="px-4 py-3">
                      <Badge tone="orange">LANÇAR</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              {side.missing.length > 0 && (
                <tfoot>
                  <tr className="bg-[#0369a1] text-white">
                    <td className="px-4 py-3 text-sm font-bold">TOTAL</td>
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums">{fmtBRL(side.summary.missTotal)}</td>
                    <td className="px-4 py-3 text-sm text-blue-100" colSpan={3}>{side.missing.length} lançamento(s)</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {activeTab === 'ok' && (
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className={thClass} style={{ width: 96 }}>Data</th>
                  <th className={thRight} style={{ width: 130 }}>Valor</th>
                  <th className={thClass}>Favorecido / Descrição</th>
                  <th className={thClass} style={{ width: 120 }}>Referência</th>
                  <th className={thClass} style={{ width: 110 }}>Lanç. ERP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {side.matched.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">Nenhum item conciliado.</td></tr>
                ) : side.matched.map((row, i) => (
                  row.type === '1:1' ? (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className={tdClass}>{row.banks[0].date}</td>
                      <td className={tdRight + ' text-green-800'}>{fmtBRL(row.banks[0].valor)}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-xs truncate">{row.banks[0].desc}</td>
                      <td className={tdClass + ' font-mono text-xs'}>{row.banks[0].ref}</td>
                      <td className={tdClass + ' font-mono text-xs'}>{row.erp.lanc}</td>
                    </tr>
                  ) : row.type === 'ajuste' ? (
                    <tr key={i} className="bg-sky-50 dark:bg-sky-950/30 border-l-2 border-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors">
                      <td className={tdClass}>{row.banks[0].date}</td>
                      <td className={tdRight + ' text-sky-800 dark:text-sky-300'}>{fmtBRL(row.banks[0].valor)}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-xs truncate">
                        {row.banks[0].desc}{' '}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 ml-1">cheque devolvido</span>
                      </td>
                      <td className={tdClass + ' font-mono text-xs'}>{row.banks[0].ref}</td>
                      <td className={tdClass + ' font-mono text-xs'}>
                        {row.erp.lanc}
                        <div className="text-[11px] text-sky-700 dark:text-sky-400 font-sans mt-0.5">
                          {fmtBRL(row.erp.valor)} − {row.devolvidos?.map(d => fmtBRL(d.valor)).join(' − ')} (dev. {row.devolvidos?.map(d => d.lanc).join(', ')})
                        </div>
                      </td>
                    </tr>
                  ) : row.type === 'N:1' ? (
                    <tr key={i}>
                      <td colSpan={5} className="p-0">
                        <table className="w-full text-sm">
                          <tbody>
                            {row.banks.map((b, j) => (
                              <tr key={j} className="bg-purple-50 dark:bg-purple-950/30 border-l-2 border-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
                                <td className={tdClass} style={{ width: 96 }}>{b.date}</td>
                                <td className={tdRight + ' text-purple-800'} style={{ width: 130 }}>{fmtBRL(b.valor)}</td>
                                <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-xs truncate">
                                  {b.desc}{' '}
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 ml-1">agrupado</span>
                                </td>
                                <td className={tdClass + ' font-mono text-xs'} style={{ width: 120 }}>{b.ref}</td>
                                <td className={tdClass + ' font-mono text-xs'} style={{ width: 110 }}>{row.erp.lanc}</td>
                              </tr>
                            ))}
                            <tr className="bg-purple-100 border-l-2 border-purple-400 font-semibold">
                              <td className="px-4 py-2 text-xs text-purple-700" colSpan={5}>
                                Soma de {row.banks.length} lançamentos = ERP {row.erp.lanc} ({fmtBRL(row.erp.valor)})
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : row.type === '1:N' ? (
                    <tr key={i}>
                      <td colSpan={5} className="p-0">
                        <table className="w-full text-sm">
                          <tbody>
                            {(row.erpGroup ?? [row.erp]).map((e, j) => (
                              <tr key={j} className="bg-teal-50 dark:bg-teal-950/30 border-l-2 border-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors">
                                <td className={tdClass} style={{ width: 96 }}>{e.date}</td>
                                <td className={tdRight + ' text-teal-800'} style={{ width: 130 }}>{fmtBRL(e.valor)}</td>
                                <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-xs truncate">
                                  {e.desc}{' '}
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-700 ml-1">agrupado</span>
                                </td>
                                <td className={tdClass + ' font-mono text-xs'} style={{ width: 120 }}>{row.banks[0].ref}</td>
                                <td className={tdClass + ' font-mono text-xs'} style={{ width: 110 }}>{e.lanc}</td>
                              </tr>
                            ))}
                            <tr className="bg-teal-100 border-l-2 border-teal-400 font-semibold">
                              <td className="px-4 py-2 text-xs text-teal-700" colSpan={5}>
                                Soma de {(row.erpGroup ?? [row.erp]).length} lançamentos ERP = Banco {row.banks[0].ref} ({fmtBRL(row.banks[0].valor)})
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : (
                    <tr key={i}>
                      <td colSpan={5} className="p-0">
                        <table className="w-full text-sm">
                          <tbody>
                            {row.banks.map((b, j) => (
                              <tr key={`b${j}`} className="bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                                <td className={tdClass} style={{ width: 96 }}>{b.date}</td>
                                <td className={tdRight + ' text-amber-800'} style={{ width: 130 }}>{fmtBRL(b.valor)}</td>
                                <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-xs truncate">
                                  {b.desc}{' '}
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 ml-1">banco</span>
                                </td>
                                <td className={tdClass + ' font-mono text-xs'} style={{ width: 120 }}>{b.ref}</td>
                                <td className={tdClass + ' font-mono text-xs'} style={{ width: 110 }}>—</td>
                              </tr>
                            ))}
                            {(row.erpGroup ?? [row.erp]).map((e, j) => (
                              <tr key={`e${j}`} className="bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                                <td className={tdClass} style={{ width: 96 }}>{e.date}</td>
                                <td className={tdRight + ' text-amber-800'} style={{ width: 130 }}>{fmtBRL(e.valor)}</td>
                                <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-xs truncate">
                                  {e.desc}{' '}
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 ml-1">ERP</span>
                                </td>
                                <td className={tdClass + ' font-mono text-xs'} style={{ width: 120 }}>—</td>
                                <td className={tdClass + ' font-mono text-xs'} style={{ width: 110 }}>{e.lanc}</td>
                              </tr>
                            ))}
                            <tr className="bg-amber-100 border-l-2 border-amber-400 font-semibold">
                              <td className="px-4 py-2 text-xs text-amber-700" colSpan={5}>
                                Grupo M:N — {(row.erpGroup ?? [row.erp]).length} lançamento(s) ERP = {row.banks.length} lançamento(s) banco ({fmtBRL(row.banks.reduce((a, b) => a + b.valor, 0))})
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
              {side.matched.length > 0 && (
                <tfoot>
                  <tr className="bg-[#0369a1] text-white">
                    <td className="px-4 py-3 text-sm font-bold">TOTAL</td>
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums">{fmtBRL(side.summary.okTotal)}</td>
                    <td className="px-4 py-3 text-sm text-blue-100" colSpan={3}>{side.summary.okCount} lançamento(s) ERP</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {activeTab === 'pend' && (
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className={thClass} style={{ width: 96 }}>Data</th>
                  <th className={thRight} style={{ width: 130 }}>Valor</th>
                  <th className={thClass} style={{ width: 130 }}>Lanç. ERP</th>
                  <th className={thClass}>Descrição</th>
                  <th className={thClass} style={{ width: 220 }}>Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {side.pending.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">Nenhum item pendente.</td></tr>
                ) : side.pending.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className={tdClass}>{row.date}</td>
                    <td className={tdRight}>{fmtBRL(row.valor)}</td>
                    <td className={tdClass + ' font-mono text-xs'}>{row.lanc}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-xs truncate">{row.desc}</td>
                    <td className="px-4 py-3">
                      <Badge tone="gray">Lançado no ERP, aguardando banco</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              {side.pending.length > 0 && (
                <tfoot>
                  <tr className="bg-[#0369a1] text-white">
                    <td className="px-4 py-3 text-sm font-bold">TOTAL</td>
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums">{fmtBRL(side.summary.pendTotal)}</td>
                    <td className="px-4 py-3 text-sm text-blue-100" colSpan={3}>{side.pending.length} lançamento(s)</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          </TabPanel>
        </div>
      </TableCard>
    </div>
  )
}

export default function CompararExtratoPage() {
  const [erpFile, setErpFile] = useState<File | null>(null)
  const [bankFile, setBankFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [entradaTab, setEntradaTab] = useState<Tab>('miss')
  const [saidaTab, setSaidaTab] = useState<Tab>('miss')

  const erpRef = useRef<HTMLInputElement>(null)
  const bankRef = useRef<HTMLInputElement>(null)

  const canProcess = !!erpFile && !!bankFile && !loading

  async function handleProcess() {
    if (!erpFile || !bankFile) return
    setLoading(true)
    setError(null)
    setData(null)
    setEntradaTab('miss')
    setSaidaTab('miss')
    try {
      const formData = new FormData()
      formData.append('erpFile', erpFile)
      formData.append('bankFile', bankFile)
      const res = await fetch('/api/ferramentas/comparar-extrato', { method: 'POST', body: formData })
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

  function handleReset() {
    setErpFile(null)
    setBankFile(null)
    setData(null)
    setError(null)
    setEntradaTab('miss')
    setSaidaTab('miss')
    if (erpRef.current) erpRef.current.value = ''
    if (bankRef.current) bankRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <PageHeader
        title="Conciliação Bancária — Viacredi"
        subtitle="Cruza todas as entradas e saídas do extrato ERP (.txt) com o extrato Viacredi (.csv) e identifica divergências."
      />

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

        <Card padding="5" className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Arquivos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FileInput ref={erpRef} label="Extrato ERP (.txt)" accept=".txt" file={erpFile} onChange={setErpFile} />
            <FileInput ref={bankRef} label="Extrato Banco (.csv)" accept=".csv" file={bankFile} onChange={setBankFile} />
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={handleProcess} disabled={!canProcess} loading={loading}>
              {loading ? 'Processando…' : 'Processar Conciliação'}
            </Button>
            {(erpFile || bankFile || data || error) && !loading && (
              <Button variant="ghost" onClick={handleReset}>Limpar</Button>
            )}
          </div>
        </Card>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400 animate-fade-in-up">
            <span className="font-medium">Erro:</span> {error}
          </div>
        )}

        {data && (
          <>
            {data.entradas.confirmedDevolvidos.length > 0 && (
              <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 rounded-xl px-4 py-3 text-sm text-sky-700 dark:text-sky-400 animate-fade-in-up">
                <span className="font-semibold">{data.entradas.confirmedDevolvidos.length} cheque(s) devolvido(s) confirmado(s) no extrato do banco</span> — estornado(s) separadamente, não afeta nenhum depósito:{' '}
                {data.entradas.confirmedDevolvidos.map(d => `${d.erp.lanc} (${fmtBRL(d.erp.valor)}, ${d.erp.date}) = ${d.bankDebit.desc}`).join('; ')}
              </div>
            )}

            <ReconciliationSide
              title="Entradas (Créditos)"
              bankLabel="Créditos"
              side={data.entradas}
              activeTab={entradaTab}
              onTabChange={setEntradaTab}
              onExportMissing={() => exportCSV(data.entradas.missing, 'entradas')}
            />

            <ReconciliationSide
              title="Saídas (Débitos)"
              bankLabel="Débitos"
              side={data.saidas}
              activeTab={saidaTab}
              onTabChange={setSaidaTab}
              onExportMissing={() => exportCSV(data.saidas.missing, 'saidas')}
            />
          </>
        )}
      </div>
    </div>
  )
}
