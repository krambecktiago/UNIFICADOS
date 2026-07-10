'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { TableCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { formatBRL } from '@/lib/utils/br-format'

interface RedeTransaction {
  status: string
  nsu: number
  authorizationCode: number
  amount: number
  netAmount: number
  feeTotal: number
  installmentQuantity: number
  captureType: string
  cardNumber: string
  brandCode: number
  movementDate: string
  saleHour?: string
  modality: { type: string; product: string }
  merchant?: { companyNumber: string; companyName?: string; tradeName?: string }
}

interface RedeEstablishment {
  companyNumber: string
  name?: string
}

function establishmentLabel(e: RedeEstablishment): string {
  return e.name ? `${e.name} (${e.companyNumber})` : e.companyNumber
}

function todayISO(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function statusTone(status: string): 'green' | 'red' | 'gray' {
  if (status === 'APPROVED') return 'green'
  if (status === 'CANCELLED') return 'red'
  return 'gray'
}

export default function RedeExtratoPage() {
  const [startDate, setStartDate] = useState(todayISO(-1))
  const [endDate, setEndDate] = useState(todayISO(-1))
  const [companyNumber, setCompanyNumber] = useState('') // '' = todos os estabelecimentos
  const [establishments, setEstablishments] = useState<RedeEstablishment[]>([])
  const [transactions, setTransactions] = useState<RedeTransaction[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function buscar() {
    setLoading(true)
    setError('')
    setTransactions(null)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (companyNumber) params.set('companyNumber', companyNumber)
      const res = await fetch(`/api/ferramentas/rede-extrato?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao consultar extrato')
        return
      }
      setTransactions(data.transactions)
      if (Array.isArray(data.establishments)) setEstablishments(data.establishments)
    } catch {
      setError('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  // Ao abrir a ferramenta, já carrega as vendas do dia anterior (padrão),
  // sem precisar clicar em "Buscar".
  useEffect(() => {
    buscar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalBruto = transactions?.reduce((acc, t) => acc + t.amount, 0) ?? 0
  const totalLiquido = transactions?.reduce((acc, t) => acc + t.netAmount, 0) ?? 0
  // Não soma `feeTotal` — nessa rota da Rede esse campo vem como taxa
  // percentual (mesmo formato de `mdrFee`), não como valor em R$. O valor
  // real descontado é bruto − líquido de cada transação.
  const totalTaxa = totalBruto - totalLiquido

  const inputBase = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30'

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Extrato Rede"
        subtitle="Consulta direta na API da Rede — sem upload de planilha"
      />

      <div className="px-8 py-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Data inicial</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputBase} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Data final</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputBase} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Estabelecimento</label>
            <select value={companyNumber} onChange={e => setCompanyNumber(e.target.value)} className={inputBase}>
              <option value="">Todos os estabelecimentos</option>
              {establishments.map(e => (
                <option key={e.companyNumber} value={e.companyNumber}>{establishmentLabel(e)}</option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={buscar} loading={loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <Spinner size="md" />
            Consultando API da Rede...
          </div>
        )}

        {transactions && !loading && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Valor bruto</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatBRL(totalBruto)}</p>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Taxas</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatBRL(totalTaxa)}</p>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Valor líquido</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatBRL(totalLiquido)}</p>
              </div>
            </div>

            {transactions.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma transação encontrada no período.</p>
            ) : (
              <TableCard>
                <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                      <tr>
                        {!companyNumber && (
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Estabelecimento</th>
                        )}
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Data</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Modalidade</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Cartão</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">NSU</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Autorização</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Parcelas</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Bruto</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Taxa</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Líquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t, i) => (
                        <tr key={`${t.nsu}-${t.authorizationCode}-${i}`} className="border-b border-gray-100 last:border-0">
                          {!companyNumber && (
                            <td className="px-4 py-2.5 text-gray-700">
                              {t.merchant?.companyName ?? t.merchant?.companyNumber ?? '—'}
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-gray-700">
                            {t.movementDate}{t.saleHour ? ` ${t.saleHour}` : ''}
                          </td>
                          <td className="px-4 py-2.5"><Badge tone={statusTone(t.status)}>{t.status}</Badge></td>
                          <td className="px-4 py-2.5 text-gray-700">{t.modality?.type} · {t.captureType}</td>
                          <td className="px-4 py-2.5 text-gray-700 font-mono">{t.cardNumber}</td>
                          <td className="px-4 py-2.5 text-gray-700 font-mono">{t.nsu}</td>
                          <td className="px-4 py-2.5 text-gray-700 font-mono">{t.authorizationCode}</td>
                          <td className="px-4 py-2.5 text-gray-700">{t.installmentQuantity}x</td>
                          <td className="px-4 py-2.5 text-right text-gray-900">{formatBRL(t.amount)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{formatBRL(t.amount - t.netAmount)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{formatBRL(t.netAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TableCard>
            )}
          </>
        )}
      </div>
    </div>
  )
}
