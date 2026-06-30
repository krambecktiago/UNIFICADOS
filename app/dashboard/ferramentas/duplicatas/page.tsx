'use client'

import { useState, useRef } from 'react'

interface DuplicataResult {
  duplicata: string
  pagador: string
  vencimento: string
  liquidacao: string
  valorTitulo: number
  valorCobrado: number
  juros: number
  status: 'BAIXADA' | 'NAO_BAIXADA'
}

interface Summary {
  baixadas: number
  naoBaixadas: number
  total: number
}

interface ApiResponse {
  results: DuplicataResult[]
  summary: Summary
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string): string {
  if (!value) return '—'
  return value
}

const STATUS_STYLES: Record<string, string> = {
  BAIXADA: 'bg-green-50 text-green-700 border-green-200',
  NAO_BAIXADA: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_LABELS: Record<string, string> = {
  BAIXADA: 'Baixada',
  NAO_BAIXADA: 'Não Baixada',
}

const ROW_STYLES: Record<string, string> = {
  BAIXADA: 'bg-green-50',
  NAO_BAIXADA: 'bg-red-50',
}

export default function DuplicatasPage() {
  const [xlsxFile, setXlsxFile] = useState<File | null>(null)
  const [txtFile, setTxtFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<ApiResponse | null>(null)

  const xlsxRef = useRef<HTMLInputElement>(null)
  const txtRef = useRef<HTMLInputElement>(null)

  async function handleProcess() {
    if (!xlsxFile || !txtFile) {
      setError('Selecione os dois arquivos antes de processar.')
      return
    }

    setLoading(true)
    setError('')
    setData(null)

    try {
      const formData = new FormData()
      formData.append('xlsx', xlsxFile)
      formData.append('txt', txtFile)

      const res = await fetch('/api/ferramentas/duplicatas', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Erro ao processar os arquivos.')
        return
      }

      setData(json)
    } catch {
      setError('Falha ao conectar com o servidor. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const canProcess = xlsxFile !== null && txtFile !== null && !loading

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
          Ferramentas
        </p>
        <h2 className="text-2xl font-bold text-gray-900">Conferir Duplicatas</h2>
        <p className="text-sm text-gray-500 mt-1">
          Compara retorno bancário (XLSX) com fluxo de caixa do ERP (TXT)
        </p>
      </div>

      {/* File inputs */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
          Arquivos de entrada
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Retorno Bancário
              <span className="ml-2 text-xs font-normal text-gray-400">XLSX</span>
            </label>
            <input
              ref={xlsxRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setXlsxFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg p-2 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700"
            />
            {xlsxFile && (
              <p className="mt-1.5 text-xs text-gray-500 truncate">{xlsxFile.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Fluxo de Caixa ERP
              <span className="ml-2 text-xs font-normal text-gray-400">TXT</span>
            </label>
            <input
              ref={txtRef}
              type="file"
              accept=".txt"
              onChange={(e) => setTxtFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg p-2 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700"
            />
            {txtFile && (
              <p className="mt-1.5 text-xs text-gray-500 truncate">{txtFile.name}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Processando...
              </span>
            ) : (
              'Processar'
            )}
          </button>

          {(xlsxFile || txtFile) && !loading && (
            <button
              onClick={() => {
                setXlsxFile(null)
                setTxtFile(null)
                setData(null)
                setError('')
                if (xlsxRef.current) xlsxRef.current.value = ''
                if (txtRef.current) txtRef.current.value = ''
              }}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Total
              </p>
              <p className="text-3xl font-bold text-gray-900 font-variant-numeric tabular-nums">
                {data.summary.total}
              </p>
              <p className="text-xs text-gray-400 mt-1">duplicatas analisadas</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-2">
                Baixadas
              </p>
              <p className="text-3xl font-bold text-green-700 tabular-nums">
                {data.summary.baixadas}
              </p>
              {data.summary.total > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {Math.round((data.summary.baixadas / data.summary.total) * 100)}% do total
                </p>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">
                Não Baixadas
              </p>
              <p className="text-3xl font-bold text-red-700 tabular-nums">
                {data.summary.naoBaixadas}
              </p>
              {data.summary.total > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {Math.round((data.summary.naoBaixadas / data.summary.total) * 100)}% do total
                </p>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Resultado detalhado
              </p>
              <p className="text-xs text-gray-400">{data.results.length} registros</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Duplicata
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Pagador
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Vencimento
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Liquidação
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Valor Título
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Valor Cobrado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Juros
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((row, i) => (
                    <tr
                      key={`${row.duplicata}-${i}`}
                      className={`border-b border-gray-100 last:border-0 ${ROW_STYLES[row.status] ?? ''}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                        {row.duplicata}
                      </td>
                      <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate" title={row.pagador}>
                        {row.pagador}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">
                        {formatDate(row.vencimento)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">
                        {formatDate(row.liquidacao)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 whitespace-nowrap tabular-nums">
                        {formatCurrency(row.valorTitulo)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 whitespace-nowrap tabular-nums">
                        {formatCurrency(row.valorCobrado)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap tabular-nums">
                        {formatCurrency(row.juros)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded border text-xs font-medium ${STATUS_STYLES[row.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}
                        >
                          {STATUS_LABELS[row.status] ?? row.status}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {data.results.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                        Nenhum resultado encontrado.
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
  )
}
