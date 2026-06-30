'use client'

import { useState, useRef } from 'react'

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
}

interface MatchedEntry {
  type: '1:1' | 'N:1'
  banks: BankEntry[]
  erp: ErpEntry
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

interface ApiResponse {
  missing: BankEntry[]
  matched: MatchedEntry[]
  pending: ErpEntry[]
  summary: Summary
}

type Tab = 'miss' | 'ok' | 'pend'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function exportCSV(missing: BankEntry[]) {
  const rows = ['﻿Data;Descrição;Referência Banco;Valor (R$)']
  for (const t of missing) {
    rows.push(`${t.date};${t.desc};${t.ref};${t.valor.toFixed(2).replace('.', ',')}`)
  }
  const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `Faltando_ERP_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  a.click()
}

interface KpiCardProps { label: string; value: string; sub: string; accent: string }
function KpiCard({ label, value, sub, accent }: KpiCardProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-5 border-l-4 ${accent}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}

export default function CompararExtratoPage() {
  const [erpFile, setErpFile] = useState<File | null>(null)
  const [bankFile, setBankFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('miss')

  const erpRef = useRef<HTMLInputElement>(null)
  const bankRef = useRef<HTMLInputElement>(null)

  const canProcess = !!erpFile && !!bankFile && !loading

  async function handleProcess() {
    if (!erpFile || !bankFile) return
    setLoading(true)
    setError(null)
    setData(null)
    setActiveTab('miss')
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

  const fileInputClass =
    'block w-full text-sm text-gray-900 border border-gray-300 rounded-lg p-2 bg-white ' +
    'file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium ' +
    'file:bg-blue-50 file:text-blue-700 cursor-pointer'

  const tabs: { key: Tab; label: string; count: number; border: string; text: string }[] = data
    ? [
        { key: 'miss', label: 'Faltando no ERP',   count: data.summary.missCount, border: 'border-orange-500', text: 'text-orange-600' },
        { key: 'ok',   label: 'Conciliados',        count: data.summary.okCount,   border: 'border-green-500',  text: 'text-green-600'  },
        { key: 'pend', label: 'Faltando no Banco',  count: data.summary.pendCount, border: 'border-gray-400',   text: 'text-gray-600'   },
      ]
    : []

  const thClass = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide'
  const thRight = thClass + ' text-right'
  const tdClass = 'px-4 py-3 text-sm text-gray-800 whitespace-nowrap'
  const tdRight = tdClass + ' text-right tabular-nums font-medium'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="h-[68px] bg-white border-b border-gray-200 px-8 flex items-center">
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Conciliação Bancária — Viacredi</h1>
          <p className="text-xs text-gray-400 leading-tight mt-0.5">Cruza o extrato ERP (.txt) com o extrato Viacredi (.csv) e identifica divergências.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">

        {/* Upload */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Arquivos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                Extrato ERP (.txt)
              </label>
              <input
                ref={erpRef}
                type="file"
                accept=".txt"
                className={fileInputClass}
                onChange={e => setErpFile(e.target.files?.[0] ?? null)}
              />
              {erpFile && <p className="text-xs text-gray-400 truncate">{erpFile.name}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                Extrato Banco (.csv)
              </label>
              <input
                ref={bankRef}
                type="file"
                accept=".csv"
                className={fileInputClass}
                onChange={e => setBankFile(e.target.files?.[0] ?? null)}
              />
              {bankFile && <p className="text-xs text-gray-400 truncate">{bankFile.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleProcess}
              disabled={!canProcess}
              className="px-6 py-2 bg-[#0369a1] text-white rounded-lg text-sm font-medium hover:bg-[#025a8e] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Processando…' : 'Processar Conciliação'}
            </button>
            {data && data.summary.missCount > 0 && (
              <button
                onClick={() => exportCSV(data.missing)}
                className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Exportar Faltando (.csv)
              </button>
            )}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="animate-spin h-4 w-4 text-[#0369a1]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Aguarde…
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <span className="font-medium">Erro:</span> {error}
          </div>
        )}

        {/* Results */}
        {data && (
          <>
            {/* Status banner */}
            {data.summary.missCount === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
                Tudo conciliado — {data.summary.okCount} lançamento(s) conferem. Banco: {fmtBRL(data.summary.bankTotal)} · ERP: {fmtBRL(data.summary.okTotal)}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <span className="font-semibold">{data.summary.missCount} lançamento(s) faltando no ERP</span>
                {' '}·{' '}{fmtBRL(data.summary.missTotal)}
                {' '}·{' '}{data.summary.okCount} conciliados
                {' '}·{' '}{data.summary.pendCount} aguardando banco
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Créditos Banco" value={fmtBRL(data.summary.bankTotal)} sub={`${data.summary.bankCount} crédito(s)`} accent="border-[#0369a1]" />
              <KpiCard label="Conciliado" value={fmtBRL(data.summary.okTotal)} sub={`${data.summary.okCount} lançamento(s)`} accent="border-green-500" />
              <KpiCard label="Faltando no ERP" value={fmtBRL(data.summary.missTotal)} sub={`${data.summary.missCount} lançamento(s)`} accent="border-orange-500" />
              <KpiCard label="Faltando no Banco" value={fmtBRL(data.summary.pendTotal)} sub={`${data.summary.pendCount} lançamento(s)`} accent="border-gray-400" />
            </div>

            {/* Tabs + Tables */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex border-b border-gray-100 overflow-x-auto">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? `${tab.border} ${tab.text} bg-white`
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.key ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto">

                {/* Tab: Faltando no ERP */}
                {activeTab === 'miss' && (
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className={thClass} style={{ width: 96 }}>Data</th>
                        <th className={thRight} style={{ width: 130 }}>Valor</th>
                        <th className={thClass}>Favorecido / Descrição</th>
                        <th className={thClass} style={{ width: 120 }}>Referência</th>
                        <th className={thClass} style={{ width: 90 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.missing.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">Nenhum lançamento faltando.</td></tr>
                      ) : data.missing.map((row, i) => (
                        <tr key={i} className="bg-orange-50 hover:bg-orange-100 transition-colors">
                          <td className={tdClass}>{row.date}</td>
                          <td className={tdRight + ' text-orange-800'}>{fmtBRL(row.valor)}</td>
                          <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">{row.desc}</td>
                          <td className={tdClass + ' font-mono text-xs'}>{row.ref}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">LANÇAR</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {data.missing.length > 0 && (
                      <tfoot>
                        <tr className="bg-[#0369a1] text-white">
                          <td className="px-4 py-3 text-sm font-bold">TOTAL</td>
                          <td className="px-4 py-3 text-sm font-bold text-right tabular-nums">{fmtBRL(data.summary.missTotal)}</td>
                          <td className="px-4 py-3 text-sm text-blue-100" colSpan={3}>{data.missing.length} lançamento(s)</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}

                {/* Tab: Conciliados */}
                {activeTab === 'ok' && (
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className={thClass} style={{ width: 96 }}>Data</th>
                        <th className={thRight} style={{ width: 130 }}>Valor</th>
                        <th className={thClass}>Favorecido / Descrição</th>
                        <th className={thClass} style={{ width: 120 }}>Referência</th>
                        <th className={thClass} style={{ width: 110 }}>Lanç. ERP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.matched.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">Nenhum item conciliado.</td></tr>
                      ) : data.matched.map((row, i) => (
                        row.type === '1:1' ? (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className={tdClass}>{row.banks[0].date}</td>
                            <td className={tdRight + ' text-green-800'}>{fmtBRL(row.banks[0].valor)}</td>
                            <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">{row.banks[0].desc}</td>
                            <td className={tdClass + ' font-mono text-xs'}>{row.banks[0].ref}</td>
                            <td className={tdClass + ' font-mono text-xs'}>{row.erp.lanc}</td>
                          </tr>
                        ) : (
                          <tr key={i}>
                            <td colSpan={5} className="p-0">
                              <table className="w-full text-sm">
                                <tbody>
                                  {row.banks.map((b, j) => (
                                    <tr key={j} className="bg-purple-50 border-l-2 border-purple-400 hover:bg-purple-100 transition-colors">
                                      <td className={tdClass} style={{ width: 96 }}>{b.date}</td>
                                      <td className={tdRight + ' text-purple-800'} style={{ width: 130 }}>{fmtBRL(b.valor)}</td>
                                      <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">
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
                        )
                      ))}
                    </tbody>
                    {data.matched.length > 0 && (
                      <tfoot>
                        <tr className="bg-[#0369a1] text-white">
                          <td className="px-4 py-3 text-sm font-bold">TOTAL</td>
                          <td className="px-4 py-3 text-sm font-bold text-right tabular-nums">{fmtBRL(data.summary.okTotal)}</td>
                          <td className="px-4 py-3 text-sm text-blue-100" colSpan={3}>{data.summary.okCount} lançamento(s) ERP</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}

                {/* Tab: Faltando no Banco */}
                {activeTab === 'pend' && (
                  <table className="w-full text-sm min-w-[480px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className={thClass} style={{ width: 96 }}>Data</th>
                        <th className={thRight} style={{ width: 130 }}>Valor</th>
                        <th className={thClass} style={{ width: 130 }}>Lanç. ERP</th>
                        <th className={thClass}>Observação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.pending.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">Nenhum item pendente.</td></tr>
                      ) : data.pending.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className={tdClass}>{row.date}</td>
                          <td className={tdRight}>{fmtBRL(row.valor)}</td>
                          <td className={tdClass + ' font-mono text-xs'}>{row.lanc}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Lançado no ERP, aguardando banco</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {data.pending.length > 0 && (
                      <tfoot>
                        <tr className="bg-[#0369a1] text-white">
                          <td className="px-4 py-3 text-sm font-bold">TOTAL</td>
                          <td className="px-4 py-3 text-sm font-bold text-right tabular-nums">{fmtBRL(data.summary.pendTotal)}</td>
                          <td className="px-4 py-3 text-sm text-blue-100">{data.pending.length} lançamento(s)</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
