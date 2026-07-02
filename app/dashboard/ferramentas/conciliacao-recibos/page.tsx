'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import JSZip from 'jszip'
import { normText } from '@/lib/utils/br-format'

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
}

interface MatchedEntry {
  venda: Venda
  recibo: Recibo
  divergente: boolean
  diferenca: number
  motivo: 'valor' | 'identificador'
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

// Nomes canônicos das lojas (mesmos do LOJA_MAP do lado recibos). O nome do
// estabelecimento no relatório da Rede (lado vendas) normalmente contém um
// desses nomes embutido no texto — por isso o filtro casa por "contém", não
// por igualdade exata, para funcionar nos dois lados com nomenclaturas diferentes.
const STORE_NAMES = ['Matriz', 'Indaial', 'Diesel', 'Blumenau', 'Gaspar']

function storeKey(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return '(Sem loja)'
  const normed = normText(trimmed)
  const found = STORE_NAMES.find(name => normed.includes(normText(name)))
  return found ?? trimmed
}

function csvEscape(v: string): string {
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function toCSV(headers: string[], rows: string[][]): string {
  const lines = [headers.join(';'), ...rows.map(r => r.map(csvEscape).join(';'))]
  return '﻿' + lines.join('\r\n')
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

export default function ConciliacaoRecibosPage() {
  const [vendasFile, setVendasFile] = useState<File | null>(null)
  const [recibosFile, setRecibosFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('missing')
  const [storeFilter, setStoreFilter] = useState<string>('all')

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
    setStoreFilter('all')
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

  function handleReset() {
    setVendasFile(null)
    setRecibosFile(null)
    setData(null)
    setError(null)
    setActiveTab('missing')
    setStoreFilter('all')
    if (vendasRef.current) vendasRef.current.value = ''
    if (recibosRef.current) recibosRef.current.value = ''
  }

  const storeOptions = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    data.missing.forEach(v => set.add(storeKey(v.loja)))
    data.matched.forEach(m => set.add(storeKey(m.venda.loja)))
    data.divergent.forEach(m => set.add(storeKey(m.venda.loja)))
    data.pending.forEach(r => set.add(storeKey(r.loja)))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [data])

  const filteredMissing = useMemo(
    () => !data ? [] : storeFilter === 'all' ? data.missing : data.missing.filter(v => storeKey(v.loja) === storeFilter),
    [data, storeFilter]
  )
  const filteredMatched = useMemo(
    () => !data ? [] : storeFilter === 'all' ? data.matched : data.matched.filter(m => storeKey(m.venda.loja) === storeFilter),
    [data, storeFilter]
  )
  const filteredDivergent = useMemo(
    () => !data ? [] : storeFilter === 'all' ? data.divergent : data.divergent.filter(m => storeKey(m.venda.loja) === storeFilter),
    [data, storeFilter]
  )
  const filteredPending = useMemo(
    () => !data ? [] : storeFilter === 'all' ? data.pending : data.pending.filter(r => storeKey(r.loja) === storeFilter),
    [data, storeFilter]
  )

  const displaySummary: Summary | null = useMemo(() => {
    if (!data) return null
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
    const vendasValores = [
      ...filteredMissing.map(v => v.valor),
      ...filteredMatched.map(m => m.venda.valor),
      ...filteredDivergent.map(m => m.venda.valor),
    ]
    return {
      vendasTotal: vendasValores.length,
      vendasValor: sum(vendasValores),
      okCount: filteredMatched.length,
      okValor: sum(filteredMatched.map(m => m.venda.valor)),
      divergentCount: filteredDivergent.length,
      missingCount: filteredMissing.length,
      missingValor: sum(filteredMissing.map(v => v.valor)),
      pendingCount: filteredPending.length,
      pendingValor: sum(filteredPending.map(r => r.valor)),
    }
  }, [data, filteredMissing, filteredMatched, filteredDivergent, filteredPending])

  async function handleExport() {
    if (!data) return
    const zip = new JSZip()
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const storeSuffix = (storeFilter === 'all' ? 'TodasLojas' : storeFilter).replace(/[^\p{L}\p{N}]+/gu, '')

    zip.file(`VendasSemRecibo_${storeSuffix}.csv`, toCSV(
      ['Data', 'Loja', 'Valor (R$)', 'Modalidade', 'Bandeira', 'NSU', 'Autorização', 'Maquininha'],
      filteredMissing.map(v => [v.data, lojaLabel(v), v.valor.toFixed(2).replace('.', ','), v.modalidade, v.bandeira, v.nsu, v.autorizacao, v.maquininha])
    ))
    zip.file(`Conciliados_${storeSuffix}.csv`, toCSV(
      ['Data', 'Loja', 'Valor (R$)', 'NSU', 'Autorização', 'Cliente', 'Recibo', 'Emissão'],
      filteredMatched.map(m => [m.venda.data, lojaLabel(m.venda), m.venda.valor.toFixed(2).replace('.', ','), m.venda.nsu, m.venda.autorizacao, m.recibo.cliente, m.recibo.recibo, m.recibo.dataEmissao])
    ))
    zip.file(`Divergencias_${storeSuffix}.csv`, toCSV(
      ['Data', 'Loja', 'Motivo', 'Valor Venda (R$)', 'Valor Recibo (R$)', 'Diferença (R$)', 'NSU Venda', 'NSU Recibo', 'Autorização Venda', 'Autorização Recibo', 'Cliente', 'Recibo'],
      filteredDivergent.map(m => [
        m.venda.data,
        lojaLabel(m.venda),
        m.motivo === 'identificador' ? 'NSU/Autorização não conferem' : 'Valor diferente',
        m.venda.valor.toFixed(2).replace('.', ','),
        m.recibo.valor.toFixed(2).replace('.', ','),
        m.diferenca.toFixed(2).replace('.', ','),
        m.venda.nsu,
        m.recibo.nsu,
        m.venda.autorizacao,
        m.recibo.autorizacao,
        m.recibo.cliente,
        m.recibo.recibo,
      ])
    ))
    zip.file(`RecibosSemVenda_${storeSuffix}.csv`, toCSV(
      ['Data Mvto', 'Loja', 'Valor (R$)', 'NSU', 'Autorização', 'Cliente', 'Recibo'],
      filteredPending.map(r => [r.dataMvto, r.loja, r.valor.toFixed(2).replace('.', ','), r.nsu, r.autorizacao, r.cliente, r.recibo])
    ))

    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Conciliacao_Recibos_${storeSuffix}_${stamp}.zip`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const fileInputClass =
    'block w-full text-sm text-gray-900 border border-gray-300 rounded-lg p-2 bg-white ' +
    'file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium ' +
    'file:bg-blue-50 file:text-blue-700 cursor-pointer'

  const tabs: { key: Tab; label: string; count: number; border: string; text: string }[] = displaySummary
    ? [
        { key: 'missing',    label: 'Vendas sem recibo',    count: displaySummary.missingCount,   border: 'border-orange-500', text: 'text-orange-600' },
        { key: 'ok',         label: 'Conciliados',          count: displaySummary.okCount,        border: 'border-green-500',  text: 'text-green-600'  },
        { key: 'divergent',  label: 'Divergências',         count: displaySummary.divergentCount, border: 'border-amber-500',  text: 'text-amber-600'  },
        { key: 'pending',    label: 'Recibos sem venda',    count: displaySummary.pendingCount,   border: 'border-gray-400',   text: 'text-gray-600'   },
      ]
    : []

  const thClass = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide'
  const thRight = thClass + ' text-right'
  const tdClass = 'px-4 py-3 text-sm text-gray-800 whitespace-nowrap'
  const tdRight = tdClass + ' text-right tabular-nums font-medium'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-[68px] bg-white border-b border-gray-200 px-8 flex items-center">
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Conciliação de Recibos</h1>
          <p className="text-xs text-gray-400 leading-tight mt-0.5">Confere vendas no cartão (Rede) x recibos emitidos pelo sistema, por NSU + Autorização.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Arquivos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                Vendas Rede (.xlsx)
              </label>
              <input
                ref={vendasRef}
                type="file"
                accept=".xlsx"
                className={fileInputClass}
                onChange={e => setVendasFile(e.target.files?.[0] ?? null)}
              />
              {vendasFile && <p className="text-xs text-gray-400 truncate">{vendasFile.name}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                Recibos Emitidos (.xlsx)
              </label>
              <input
                ref={recibosRef}
                type="file"
                accept=".xlsx"
                className={fileInputClass}
                onChange={e => setRecibosFile(e.target.files?.[0] ?? null)}
              />
              {recibosFile && <p className="text-xs text-gray-400 truncate">{recibosFile.name}</p>}
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
            {(vendasFile || recibosFile || data || error) && !loading && (
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
              >
                Limpar
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

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <span className="font-medium">Erro:</span> {error}
          </div>
        )}

        {data && displaySummary && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Loja</label>
                <select
                  value={storeFilter}
                  onChange={e => setStoreFilter(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900"
                >
                  <option value="all">Todas as lojas</option>
                  {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button
                onClick={handleExport}
                className="px-4 py-1.5 text-sm font-medium text-[#0369a1] border border-[#0369a1] rounded-lg hover:bg-blue-50 transition-colors"
              >
                Exportar {storeFilter === 'all' ? '(todas as lojas)' : `— ${storeFilter}`}
              </button>
            </div>

            {displaySummary.missingCount === 0 && displaySummary.divergentCount === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
                Tudo conciliado — {displaySummary.okCount} venda(s) com recibo. Total vendas: {fmtBRL(displaySummary.vendasValor)}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <span className="font-semibold">{displaySummary.missingCount} venda(s) sem recibo</span>
                {' '}·{' '}{fmtBRL(displaySummary.missingValor)}
                {' '}·{' '}{displaySummary.divergentCount} divergência(s)
                {' '}·{' '}{displaySummary.okCount} conciliados
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Vendas no Período" value={fmtBRL(displaySummary.vendasValor)} sub={`${displaySummary.vendasTotal} venda(s)`} accent="border-[#0369a1]" />
              <KpiCard label="Conciliado" value={fmtBRL(displaySummary.okValor)} sub={`${displaySummary.okCount} venda(s)`} accent="border-green-500" />
              <KpiCard label="Sem Recibo" value={fmtBRL(displaySummary.missingValor)} sub={`${displaySummary.missingCount} venda(s)`} accent="border-orange-500" />
              <KpiCard label="Recibos sem Venda" value={fmtBRL(displaySummary.pendingValor)} sub={`${displaySummary.pendingCount} recibo(s)`} accent="border-gray-400" />
            </div>

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

              <TopScrollbar targetRef={tableScrollRef} watch={`${activeTab}-${filteredMatched.length}-${filteredDivergent.length}-${filteredMissing.length}-${filteredPending.length}`} />

              <div ref={tableScrollRef} className="overflow-x-auto">

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
                      {filteredMissing.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">Nenhuma venda sem recibo.</td></tr>
                      ) : filteredMissing.map((v, i) => (
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
                      {filteredMatched.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">Nenhum item conciliado.</td></tr>
                      ) : filteredMatched.map((m, i) => (
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
                  <table className="w-full text-sm min-w-[980px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className={thClass} style={{ width: 96 }}>Data</th>
                        <th className={thClass}>Loja</th>
                        <th className={thClass} style={{ width: 170 }}>Motivo</th>
                        <th className={thRight} style={{ width: 110 }}>Valor Venda</th>
                        <th className={thRight} style={{ width: 110 }}>Valor Recibo</th>
                        <th className={thRight} style={{ width: 150 }}>Diferença</th>
                        <th className={thClass}>NSU (venda / recibo)</th>
                        <th className={thClass}>Autorização (venda / recibo)</th>
                        <th className={thClass}>Cliente</th>
                        <th className={thClass}>Recibo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredDivergent.length === 0 ? (
                        <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">Nenhuma divergência encontrada.</td></tr>
                      ) : filteredDivergent.map((m, i) => (
                        <tr key={i} className="bg-amber-50 hover:bg-amber-100 transition-colors">
                          <td className={tdClass}>{m.venda.data}</td>
                          <td className={tdClass + ' font-medium'}>{lojaLabel(m.venda)}</td>
                          <td className={tdClass}>
                            {m.motivo === 'identificador' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">NSU/Autorização não conferem</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Valor diferente</span>
                            )}
                          </td>
                          <td className={tdRight + ' text-amber-800'}>{fmtBRL(m.venda.valor)}</td>
                          <td className={tdRight + ' text-amber-800'}>{fmtBRL(m.recibo.valor)}</td>
                          <td className={tdRight + ' font-semibold ' + (Math.abs(m.diferenca) <= 0.01 ? '' : m.diferenca > 0 ? 'text-red-700' : 'text-blue-700')}>
                            {Math.abs(m.diferenca) <= 0.01 ? '' : `${m.diferenca > 0 ? 'Recibo +' : 'Recibo '}${fmtBRL(m.diferenca)}`}
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
                      {filteredPending.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Nenhum recibo sem venda correspondente.</td></tr>
                      ) : filteredPending.map((r, i) => (
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

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
