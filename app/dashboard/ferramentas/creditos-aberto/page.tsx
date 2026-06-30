'use client'

import { useState } from 'react'

interface CreditoResult {
  emissao: string
  codigo: string
  fornecedor: string
  valor: number
  saldo: number
  status: 'CONFIRMADO' | 'SUSPEITO' | 'EM_ABERTO'
}

interface Summary {
  confirmados: number
  suspeitos: number
  emAberto: number
  total: number
  periodo: string
}

interface ApiResponse {
  results: CreditoResult[]
  summary: Summary
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function getRowClass(status: CreditoResult['status']): string {
  switch (status) {
    case 'CONFIRMADO':
      return 'bg-green-50 text-green-800'
    case 'SUSPEITO':
      return 'bg-yellow-50 text-yellow-800'
    case 'EM_ABERTO':
      return 'bg-red-50 text-red-800'
    default:
      return ''
  }
}

function getStatusBadgeClass(status: CreditoResult['status']): string {
  switch (status) {
    case 'CONFIRMADO':
      return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700'
    case 'SUSPEITO':
      return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700'
    case 'EM_ABERTO':
      return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700'
    default:
      return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700'
  }
}

function getStatusLabel(status: CreditoResult['status']): string {
  switch (status) {
    case 'CONFIRMADO':
      return 'Confirmado'
    case 'SUSPEITO':
      return 'Suspeito'
    case 'EM_ABERTO':
      return 'Em Aberto'
    default:
      return status
  }
}

export default function CreditosAbertoPage() {
  const [txtFile, setTxtFile] = useState<File | null>(null)
  const [xlsxFile, setXlsxFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)

  async function handleProcess() {
    if (!txtFile || !xlsxFile) {
      setError('Selecione ambos os arquivos antes de processar.')
      return
    }

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const formData = new FormData()
      formData.append('txt', txtFile)
      formData.append('xlsx', xlsxFile)

      const response = await fetch('/api/ferramentas/creditos-aberto', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData?.message || `Erro ${response.status}: falha ao processar os arquivos.`)
      }

      const result: ApiResponse = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao processar os arquivos.')
    } finally {
      setLoading(false)
    }
  }

  const canProcess = txtFile !== null && xlsxFile !== null && !loading

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Créditos em Aberto
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Cruza créditos em aberto (XLSX) com baixas do ERP (TXT) para identificar pendências.
          </p>
        </div>

        {/* File inputs */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Arquivos de entrada</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Baixas do ERP (.txt)
              </label>
              <input
                type="file"
                accept=".txt"
                onChange={(e) => setTxtFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg p-2 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Créditos em aberto (.xlsx)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setXlsxFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg p-2 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleProcess}
              disabled={!canProcess}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Processando...' : 'Processar'}
            </button>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg
                  className="animate-spin h-4 w-4 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Aguarde, cruzando os dados...
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="font-medium">Erro:</span> {error}
          </div>
        )}

        {/* Results */}
        {data && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
                <p className="mt-1.5 text-2xl font-semibold text-gray-900 tabular-nums">
                  {data.summary.total}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">registros</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Confirmados</p>
                <p className="mt-1.5 text-2xl font-semibold text-green-700 tabular-nums">
                  {data.summary.confirmados}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">baixados no ERP</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-medium text-yellow-600 uppercase tracking-wide">Suspeitos</p>
                <p className="mt-1.5 text-2xl font-semibold text-yellow-700 tabular-nums">
                  {data.summary.suspeitos}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">a verificar</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Em Aberto</p>
                <p className="mt-1.5 text-2xl font-semibold text-red-700 tabular-nums">
                  {data.summary.emAberto}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">sem baixa</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5 col-span-2 sm:col-span-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Período</p>
                <p className="mt-1.5 text-sm font-semibold text-gray-800 leading-snug">
                  {data.summary.periodo || '—'}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">competência</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-medium text-gray-700">
                  Resultado do cruzamento
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {data.results.length} {data.results.length === 1 ? 'linha' : 'linhas'}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Emissão
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Código
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Fornecedor
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Saldo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.results.map((row, index) => (
                      <tr key={index} className={getRowClass(row.status)}>
                        <td className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
                          {row.emissao}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono whitespace-nowrap">
                          {row.codigo}
                        </td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate">
                          {row.fornecedor}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums text-right whitespace-nowrap">
                          {formatCurrency(row.valor)}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums text-right whitespace-nowrap">
                          {formatCurrency(row.saldo)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={getStatusBadgeClass(row.status)}>
                            {getStatusLabel(row.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {data.results.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-sm text-gray-400"
                        >
                          Nenhum registro encontrado no cruzamento.
                        </td>
                      </tr>
                    )}
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
