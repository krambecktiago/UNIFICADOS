'use client'

import { useState, useRef } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, TableCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/ui/kpi-card'
import { FileInput } from '@/components/ui/file-input'
import { Tabs, type TabDef } from '@/components/ui/tabs'
import { TH_CLASS } from '@/components/ui/table'

interface CreditoResult {
  emissao: string
  lancamento: string
  codigo: string
  fornecedor: string
  valor: string
  saldo: string
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

type TabKey = 'todos' | 'CONFIRMADO' | 'SUSPEITO' | 'EM_ABERTO'

function getRowClass(status: CreditoResult['status']): string {
  switch (status) {
    case 'CONFIRMADO': return 'bg-green-50 text-green-800'
    case 'SUSPEITO':   return 'bg-yellow-50 text-yellow-800'
    case 'EM_ABERTO':  return 'bg-red-50 text-red-800'
    default:           return ''
  }
}

const STATUS_TONE: Record<CreditoResult['status'], 'green' | 'yellow' | 'red'> = {
  CONFIRMADO: 'green',
  SUSPEITO: 'yellow',
  EM_ABERTO: 'red',
}

function getStatusLabel(status: CreditoResult['status']): string {
  switch (status) {
    case 'CONFIRMADO': return 'Confirmado'
    case 'SUSPEITO':   return 'Suspeito'
    case 'EM_ABERTO':  return 'Em Aberto'
    default:           return status
  }
}

export default function CreditosAbertoPage() {
  const [fileAberto, setFileAberto] = useState<File | null>(null)
  const [fileBaixadas, setFileBaixadas] = useState<File | null>(null)
  const refAberto = useRef<HTMLInputElement>(null)
  const refBaixadas = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('todos')

  function resetAberto() {
    setFileAberto(null)
    if (refAberto.current) refAberto.current.value = ''
  }

  function resetBaixadas() {
    setFileBaixadas(null)
    if (refBaixadas.current) refBaixadas.current.value = ''
  }

  function handleReset() {
    resetAberto()
    resetBaixadas()
    setData(null)
    setError(null)
  }

  async function handleProcess() {
    if (!fileAberto || !fileBaixadas) {
      setError('Selecione ambos os arquivos antes de processar.')
      return
    }
    setLoading(true)
    setError(null)
    setData(null)
    setActiveTab('todos')
    try {
      const formData = new FormData()
      formData.append('txtAberto', fileAberto)
      formData.append('txtBaixadas', fileBaixadas)
      const response = await fetch('/api/ferramentas/creditos-aberto', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData?.message || `Erro ${response.status}: falha ao processar os arquivos.`)
      }
      setData(await response.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao processar os arquivos.')
    } finally {
      setLoading(false)
    }
  }

  const canProcess = fileAberto !== null && fileBaixadas !== null && !loading

  const filteredResults = data
    ? activeTab === 'todos' ? data.results : data.results.filter(r => r.status === activeTab)
    : []

  const tabs: TabDef<TabKey>[] = data
    ? [
        { key: 'todos',      label: 'Todos',       count: data.summary.total,       border: 'border-blue-500',   text: 'text-blue-600'  },
        { key: 'CONFIRMADO', label: 'Confirmados', count: data.summary.confirmados, border: 'border-green-500',  text: 'text-green-600' },
        { key: 'SUSPEITO',   label: 'Suspeitos',   count: data.summary.suspeitos,   border: 'border-yellow-500', text: 'text-yellow-600' },
        { key: 'EM_ABERTO',  label: 'Em Aberto',   count: data.summary.emAberto,    border: 'border-red-500',    text: 'text-red-600'   },
      ]
    : []

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Créditos em Aberto"
        subtitle="Cruza créditos em aberto do fornecedor (TXT) com pagamentos do ERP (TXT) para identificar pendências."
      />

      <div className="max-w-7xl mx-auto px-8 py-8">

        <Card padding="5" className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Arquivos de entrada</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FileInput
              ref={refAberto}
              label='Créditos em aberto — "CREDITO FORN EM ABERTO.txt"'
              accept=".txt"
              file={fileAberto}
              onChange={setFileAberto}
              onClear={resetAberto}
            />
            <FileInput
              ref={refBaixadas}
              label='Pagamentos do ERP — "DPL PAGA POR MOVIMENTO.txt"'
              accept=".txt"
              file={fileBaixadas}
              onChange={setFileBaixadas}
              onClear={resetBaixadas}
            />
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Button onClick={handleProcess} disabled={!canProcess} loading={loading}>
              {loading ? 'Processando...' : 'Processar'}
            </Button>
            {(fileAberto || fileBaixadas || data || error) && !loading && (
              <Button variant="ghost" onClick={handleReset}>Limpar</Button>
            )}
          </div>
        </Card>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in-up">
            <span className="font-medium">Erro:</span> {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              <KpiCard label="Total" value={data.summary.total} sub="registros" accent="#9ca3af" />
              <KpiCard label="Confirmados" value={data.summary.confirmados} sub="baixados no ERP" accent="#16a34a" />
              <KpiCard label="Suspeitos" value={data.summary.suspeitos} sub="a verificar" accent="#ca8a04" />
              <KpiCard label="Em Aberto" value={data.summary.emAberto} sub="sem baixa" accent="#dc2626" />
              <Card padding="5" className="col-span-2 sm:col-span-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Período</p>
                <p className="mt-1.5 text-sm font-semibold text-gray-800 leading-snug">{data.summary.periodo || '—'}</p>
                <p className="mt-0.5 text-xs text-gray-400">competência</p>
              </Card>
            </div>

            <TableCard>
              <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={TH_CLASS}>Emissão</th>
                      <th className={TH_CLASS}>Lançamento</th>
                      <th className={TH_CLASS}>Código</th>
                      <th className={TH_CLASS}>Fornecedor</th>
                      <th className={TH_CLASS + ' text-right'}>Valor</th>
                      <th className={TH_CLASS + ' text-right'}>Saldo</th>
                      <th className={TH_CLASS}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredResults.map((row, index) => (
                      <tr key={index} className={getRowClass(row.status) + ' transition-colors'}>
                        <td className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">{row.emissao}</td>
                        <td className="px-4 py-3 text-sm font-mono whitespace-nowrap text-gray-500">{row.lancamento || '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono whitespace-nowrap">{row.codigo}</td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{row.fornecedor}</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-right whitespace-nowrap">{row.valor}</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-right whitespace-nowrap">{row.saldo}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge tone={STATUS_TONE[row.status] ?? 'gray'}>{getStatusLabel(row.status)}</Badge>
                        </td>
                      </tr>
                    ))}
                    {filteredResults.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                          Nenhum registro nesta categoria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-400">
                  Exibindo {filteredResults.length} de {data.results.length} {data.results.length === 1 ? 'registro' : 'registros'}
                </p>
              </div>
            </TableCard>
          </>
        )}
      </div>
    </div>
  )
}
