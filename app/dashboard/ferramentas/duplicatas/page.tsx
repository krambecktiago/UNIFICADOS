'use client'

import { useState, useRef } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, TableCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { FileInput } from '@/components/ui/file-input'
import { TH_CLASS, TH_RIGHT_CLASS, TD_CLASS, TD_RIGHT_CLASS } from '@/components/ui/table'

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

const STATUS_TONE: Record<string, 'green' | 'red'> = {
  BAIXADA: 'green',
  NAO_BAIXADA: 'red',
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
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Conferir Duplicatas" subtitle="Compara retorno bancário (XLSX) com fluxo de caixa do ERP (TXT)" />

      <div className="px-8 py-8 max-w-7xl">

      <Card padding="6" className="mb-6">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
          Arquivos de entrada
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileInput
            ref={xlsxRef}
            label={<>Retorno Bancário <span className="ml-2 text-xs font-normal text-gray-400">XLSX</span></>}
            accept=".xlsx,.xls"
            file={xlsxFile}
            onChange={setXlsxFile}
          />
          <FileInput
            ref={txtRef}
            label={<>Fluxo de Caixa ERP <span className="ml-2 text-xs font-normal text-gray-400">TXT</span></>}
            accept=".txt"
            file={txtFile}
            onChange={setTxtFile}
          />
        </div>

        <div className="mt-5 flex items-center gap-4">
          <Button onClick={handleProcess} disabled={!canProcess} loading={loading}>
            {loading ? 'Processando...' : 'Processar'}
          </Button>

          {(xlsxFile || txtFile) && !loading && (
            <Button
              variant="ghost"
              onClick={() => {
                setXlsxFile(null)
                setTxtFile(null)
                setData(null)
                setError('')
                if (xlsxRef.current) xlsxRef.current.value = ''
                if (txtRef.current) txtRef.current.value = ''
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-fade-in-up">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <KpiCard label="Total" value={data.summary.total} sub="duplicatas analisadas" accent="#9ca3af" />
            <KpiCard
              label="Baixadas"
              value={data.summary.baixadas}
              sub={data.summary.total > 0 ? `${Math.round((data.summary.baixadas / data.summary.total) * 100)}% do total` : undefined}
              accent="#22c55e"
            />
            <KpiCard
              label="Não Baixadas"
              value={data.summary.naoBaixadas}
              sub={data.summary.total > 0 ? `${Math.round((data.summary.naoBaixadas / data.summary.total) * 100)}% do total` : undefined}
              accent="#ef4444"
            />
          </div>

          <TableCard>
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
                    <th className={TH_CLASS}>Duplicata</th>
                    <th className={TH_CLASS}>Pagador</th>
                    <th className={TH_CLASS}>Vencimento</th>
                    <th className={TH_CLASS}>Liquidação</th>
                    <th className={TH_RIGHT_CLASS}>Valor Título</th>
                    <th className={TH_RIGHT_CLASS}>Valor Cobrado</th>
                    <th className={TH_RIGHT_CLASS}>Juros</th>
                    <th className={TH_CLASS}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((row, i) => (
                    <tr
                      key={`${row.duplicata}-${i}`}
                      className={`border-b border-gray-100 last:border-0 transition-colors ${ROW_STYLES[row.status] ?? ''}`}
                    >
                      <td className={TD_CLASS + ' font-mono text-xs'}>{row.duplicata}</td>
                      <td className={TD_CLASS + ' max-w-[200px] truncate'} title={row.pagador}>{row.pagador}</td>
                      <td className={TD_CLASS + ' tabular-nums'}>{formatDate(row.vencimento)}</td>
                      <td className={TD_CLASS + ' tabular-nums'}>{formatDate(row.liquidacao)}</td>
                      <td className={TD_RIGHT_CLASS}>{formatCurrency(row.valorTitulo)}</td>
                      <td className={TD_RIGHT_CLASS}>{formatCurrency(row.valorCobrado)}</td>
                      <td className={TD_RIGHT_CLASS}>{formatCurrency(row.juros)}</td>
                      <td className={TD_CLASS}>
                        <Badge tone={STATUS_TONE[row.status] ?? 'gray'}>{STATUS_LABELS[row.status] ?? row.status}</Badge>
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
          </TableCard>
        </>
      )}
      </div>
    </div>
  )
}
