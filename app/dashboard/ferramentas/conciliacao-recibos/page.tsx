'use client'

import { useState, useRef, useEffect } from 'react'

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

  function handleReset() {
    setVendasFile(null)
    setRecibosFile(null)
    setData(null)
    setError(null)
    setActiveTab('missing')
    if (vendasRef.current) vendasRef.current.value = ''
    if (recibosRef.current) recibosRef.current.value = ''
  }

  const fileInputClass =
    'block w-full text-sm text-gray-900 border border-gray-300 rounded-lg p-2 bg-white ' +
    'file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium ' +
    'file:bg-blue-50 file:text-blue-700 cursor-pointer'

  const tabs: { key: Tab; label: string; count: number; border: string; text: string }[] = data
    ? [
        { key: 'missing',    label: 'Vendas sem recibo',    count: data.summary.missingCount,   border: 'border-orange-500', text: 'text-orange-600' },
        { key: 'ok',         label: 'Conciliados',          count: data.summary.okCount,        border: 'border-green-500',  text: 'text-green-600'  },
        { key: 'divergent',  label: 'Divergências',         count: data.summary.divergentCount, border: 'border-amber-500',  text: 'text-amber-600'  },
        { key: 'pending',    label: 'Recibos sem venda',    count: data.summary.pendingCount,   border: 'border-gray-400',   text: 'text-gray-600'   },
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

        {data && (
          <>
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Vendas no Período" value={fmtBRL(data.summary.vendasValor)} sub={`${data.summary.vendasTotal} venda(s)`} accent="border-[#0369a1]" />
              <KpiCard label="Conciliado" value={fmtBRL(data.summary.okValor)} sub={`${data.summary.okCount} venda(s)`} accent="border-green-500" />
              <KpiCard label="Sem Recibo" value={fmtBRL(data.summary.missingValor)} sub={`${data.summary.missingCount} venda(s)`} accent="border-orange-500" />
              <KpiCard label="Recibos sem Venda" value={fmtBRL(data.summary.pendingValor)} sub={`${data.summary.pendingCount} recibo(s)`} accent="border-gray-400" />
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

              <TopScrollbar targetRef={tableScrollRef} watch={`${activeTab}-${data.matched.length}-${data.divergent.length}-${data.missing.length}-${data.pending.length}`} />

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
                      {data.divergent.length === 0 ? (
                        <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">Nenhuma divergência encontrada.</td></tr>
                      ) : data.divergent.map((m, i) => (
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

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
