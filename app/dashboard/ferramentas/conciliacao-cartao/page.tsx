'use client'

import { useState, useRef } from 'react'

interface ResultRow {
  empresa: string
  duplicata: string
  emissao: string
  vencimento: string
  valor: number
  status: 'CONFIRMADO' | 'A_VERIFICAR' | 'NAO_ENCONTRADO'
  vendaData: string
  vendaValor: number
}

interface Summary {
  total: number
  confirmados: number
  aVerificar: number
  naoEncontrados: number
  totalEmAberto: number
  totalConfirmado: number
}

interface ApiResponse {
  results: ResultRow[]
  summary: Summary
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return dateStr
}

const STATUS_CONFIG = {
  CONFIRMADO: {
    label: 'Confirmado',
    rowClass: 'bg-green-50',
    badgeClass: 'bg-green-100 text-green-700 ring-green-200',
  },
  A_VERIFICAR: {
    label: 'A Verificar',
    rowClass: 'bg-yellow-50',
    badgeClass: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
  },
  NAO_ENCONTRADO: {
    label: 'Não Encontrado',
    rowClass: 'bg-red-50',
    badgeClass: 'bg-red-100 text-red-700 ring-red-200',
  },
} as const

export default function ConciliacaoCartaoPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [txtFile, setTxtFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)

  const csvInputRef = useRef<HTMLInputElement>(null)
  const txtInputRef = useRef<HTMLInputElement>(null)

  async function handleProcess() {
    if (!csvFile || !txtFile) {
      setError('Selecione os dois arquivos antes de processar.')
      return
    }

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const formData = new FormData()
      formData.append('csv', csvFile)
      formData.append('txt', txtFile)

      const response = await fetch('/api/ferramentas/conciliacao-cartao', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Erro ${response.status}`)
      }

      const json: ApiResponse = await response.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao processar.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setCsvFile(null)
    setTxtFile(null)
    setData(null)
    setError(null)
    if (csvInputRef.current) csvInputRef.current.value = ''
    if (txtInputRef.current) txtInputRef.current.value = ''
  }

  const canProcess = csvFile !== null && txtFile !== null && !loading

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="mb-8">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">
            Ferramentas / Conciliação
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Conciliação Cartão × Duplicatas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cruzamento de vendas no cartão com duplicatas em aberto.
          </p>
        </div>

        {/* Upload card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-5">
            Arquivos de Entrada
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            {/* CSV upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Vendas Cartão (CSV)
              </label>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-900 border border-slate-300 rounded-lg p-2 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
              />
              {csvFile && (
                <p className="mt-1.5 text-xs text-slate-400 truncate">{csvFile.name}</p>
              )}
            </div>

            {/* TXT upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Duplicatas em Aberto (TXT)
              </label>
              <input
                ref={txtInputRef}
                type="file"
                accept=".txt,text/plain"
                onChange={(e) => setTxtFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-900 border border-slate-300 rounded-lg p-2 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
              />
              {txtFile && (
                <p className="mt-1.5 text-xs text-slate-400 truncate">{txtFile.name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleProcess}
              disabled={!canProcess}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Processando...' : 'Processar'}
            </button>
            {(data || error) && (
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 py-8 justify-center text-slate-500 text-sm">
            <svg
              className="animate-spin h-4 w-4 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Cruzando arquivos...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="border border-red-200 bg-red-50 rounded-xl px-5 py-4 mb-6">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        {/* Results */}
        {data && (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">
                  Total em Aberto
                </p>
                <p className="text-xl font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(data.summary.totalEmAberto)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {data.summary.total} duplicata{data.summary.total !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-green-600 uppercase tracking-widest mb-2">
                  Confirmados
                </p>
                <p className="text-xl font-semibold text-slate-900 tabular-nums">
                  {data.summary.confirmados}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                  {formatCurrency(data.summary.totalConfirmado)}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-yellow-600 uppercase tracking-widest mb-2">
                  A Verificar
                </p>
                <p className="text-xl font-semibold text-slate-900 tabular-nums">
                  {data.summary.aVerificar}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">requer atenção</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-red-600 uppercase tracking-widest mb-2">
                  Não Encontrados
                </p>
                <p className="text-xl font-semibold text-slate-900 tabular-nums">
                  {data.summary.naoEncontrados}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">sem venda no cartão</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">
                  Resultado do cruzamento
                </h2>
                <span className="text-xs text-slate-400">
                  {data.results.length} registro{data.results.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Empresa
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Duplicata
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Emissão
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Vencimento
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Valor Dup.
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Data Venda
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        Valor Venda
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((row, index) => {
                      const cfg = STATUS_CONFIG[row.status]
                      return (
                        <tr
                          key={index}
                          className={`border-b border-slate-100 last:border-0 ${cfg.rowClass}`}
                        >
                          <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                            {row.empresa}
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-mono text-xs whitespace-nowrap">
                            {row.duplicata}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap tabular-nums">
                            {formatDate(row.emissao)}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap tabular-nums">
                            {formatDate(row.vencimento)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap tabular-nums">
                            {formatCurrency(row.valor)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${cfg.badgeClass}`}
                            >
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap tabular-nums">
                            {row.vendaData ? formatDate(row.vendaData) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap tabular-nums">
                            {row.vendaValor ? formatCurrency(row.vendaValor) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
