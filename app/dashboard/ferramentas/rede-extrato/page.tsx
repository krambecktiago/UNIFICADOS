'use client'

import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { TableCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { TabPanel } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/utils/br-format'
import { DuplicatasTab } from './duplicatas-tab'

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

// Na API da Rede, vendas via Link de Pagamento vêm com captureType "ECOMMERCE"
// (não existe um valor próprio pra Link de Pagamento) — só troca o rótulo exibido.
function captureTypeLabel(captureType: string): string {
  if (captureType === 'ECOMMERCE') return 'Link de Pagamento'
  return captureType
}

// Tipos fixos que essa rota da Rede cobre — não depende do resultado da
// busca, pra já aparecer selecionável antes de qualquer consulta.
const CAPTURE_TYPES = ['PDV', 'POS', 'ECOMMERCE']

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

type Tab = 'extrato' | 'duplicatas'

const TAB_DEFS: { key: Tab; label: string }[] = [
  { key: 'extrato', label: 'Extrato' },
  { key: 'duplicatas', label: 'Conciliação de Duplicatas' },
]

export default function RedeExtratoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('extrato')
  const [startDate, setStartDate] = useState(todayISO(-1))
  const [endDate, setEndDate] = useState(todayISO(-1))
  const [selectedPvs, setSelectedPvs] = useState<string[]>([]) // [] = todos os estabelecimentos
  const [showPvMenu, setShowPvMenu] = useState(false)
  const pvMenuRef = useRef<HTMLDivElement>(null)
  const [selectedCaptureTypes, setSelectedCaptureTypes] = useState<string[]>([]) // [] = todos os tipos (PDV, POS, etc)
  const [showCaptureMenu, setShowCaptureMenu] = useState(false)
  const captureMenuRef = useRef<HTMLDivElement>(null)
  const [establishments, setEstablishments] = useState<RedeEstablishment[]>([])
  const [transactions, setTransactions] = useState<RedeTransaction[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pvMenuRef.current && !pvMenuRef.current.contains(e.target as Node)) {
        setShowPvMenu(false)
      }
      if (captureMenuRef.current && !captureMenuRef.current.contains(e.target as Node)) {
        setShowCaptureMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Lista de PVs (matriz + filiais) já disponível antes de qualquer busca,
  // pra poder filtrar por estabelecimento desde a primeira consulta.
  useEffect(() => {
    fetch('/api/ferramentas/rede-extrato/establishments')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.establishments)) setEstablishments(data.establishments)
      })
      .catch(() => {})
  }, [])

  function togglePv(companyNumber: string) {
    setSelectedPvs(prev =>
      prev.includes(companyNumber) ? prev.filter(p => p !== companyNumber) : [...prev, companyNumber]
    )
  }

  function pvMenuLabel(): string {
    if (selectedPvs.length === 0) return 'Todos os estabelecimentos'
    if (selectedPvs.length === 1) {
      const found = establishments.find(e => e.companyNumber === selectedPvs[0])
      return found ? establishmentLabel(found) : selectedPvs[0]
    }
    return `${selectedPvs.length} estabelecimentos selecionados`
  }

  function toggleCaptureType(captureType: string) {
    setSelectedCaptureTypes(prev =>
      prev.includes(captureType) ? prev.filter(c => c !== captureType) : [...prev, captureType]
    )
  }

  function captureMenuLabel(): string {
    if (selectedCaptureTypes.length === 0) return 'Todos os tipos'
    if (selectedCaptureTypes.length === 1) return captureTypeLabel(selectedCaptureTypes[0])
    return `${selectedCaptureTypes.length} tipos selecionados`
  }

  async function buscar() {
    setLoading(true)
    setError('')
    setTransactions(null)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      selectedPvs.forEach(pv => params.append('companyNumber', pv))
      const res = await fetch(`/api/ferramentas/rede-extrato?${params}`)
      const data = await res.json()
      if (Array.isArray(data.establishments)) setEstablishments(data.establishments)
      if (!res.ok) {
        setError(data.error ?? 'Erro ao consultar extrato')
        return
      }
      setTransactions(data.transactions)
    } catch {
      setError('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  // Filtro de tipo de captura é aplicado em cima do que já veio da API —
  // não precisa de nova consulta pra trocar o filtro.
  const filteredTransactions = (transactions ?? []).filter(
    t => selectedCaptureTypes.length === 0 || selectedCaptureTypes.includes(t.captureType)
  )

  const totalBruto = filteredTransactions.reduce((acc, t) => acc + t.amount, 0)
  const totalLiquido = filteredTransactions.reduce((acc, t) => acc + t.netAmount, 0)
  // Não soma `feeTotal` — nessa rota da Rede esse campo vem como taxa
  // percentual (mesmo formato de `mdrFee`), não como valor em R$. O valor
  // real descontado é bruto − líquido de cada transação.
  const totalTaxa = totalBruto - totalLiquido

  const inputBase = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30'

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Extrato Rede"
        subtitle="Consulta direta na API da Rede — sem upload de planilha"
      />

      <div className="px-8 pt-4">
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          {TAB_DEFS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-5 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-brand-navy text-brand-navy dark:text-blue-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'extrato' && (
      <div className="px-8 py-8">
        <TabPanel tabKey="extrato">
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400 text-sm px-4 py-3 rounded-lg mb-6">
          Esse extrato cobre vendas em cartão — PDV, POS e Link de Pagamento (identificado pela Rede como
          "ECOMMERCE"). Vendas via Pix não aparecem aqui: a API de gestão de vendas da Rede usada nessa
          ferramenta não inclui Pix, que exigiria integrar uma API separada da Rede.
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Data inicial</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputBase} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Data final</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputBase} />
          </div>
          <div className="relative" ref={pvMenuRef}>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Estabelecimento</label>
            <button
              type="button"
              onClick={() => setShowPvMenu(v => !v)}
              className={inputBase + ' text-left flex items-center justify-between gap-2 min-w-[220px]'}
            >
              <span className="truncate">{pvMenuLabel()}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {showPvMenu && (
              <div className="absolute z-10 mt-1 w-full min-w-[240px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
                <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPvs.length === 0}
                    onChange={() => setSelectedPvs([])}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Todos os estabelecimentos
                </label>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                {establishments.map(e => (
                  <label key={e.companyNumber} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPvs.includes(e.companyNumber)}
                      onChange={() => togglePv(e.companyNumber)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    {establishmentLabel(e)}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="relative" ref={captureMenuRef}>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Tipo de venda</label>
            <button
              type="button"
              onClick={() => setShowCaptureMenu(v => !v)}
              className={inputBase + ' text-left flex items-center justify-between gap-2 min-w-[180px]'}
            >
              <span className="truncate">{captureMenuLabel()}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {showCaptureMenu && (
              <div className="absolute z-10 mt-1 w-full min-w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
                <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCaptureTypes.length === 0}
                    onChange={() => setSelectedCaptureTypes([])}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Todos os tipos
                </label>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                {CAPTURE_TYPES.map(c => (
                  <label key={c} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCaptureTypes.includes(c)}
                      onChange={() => toggleCaptureType(c)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    {captureTypeLabel(c)}
                  </label>
                ))}
              </div>
            )}
          </div>
          <Button type="button" onClick={buscar} loading={loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 text-sm text-gray-400 dark:text-gray-500">
            <Spinner size="md" />
            Consultando API da Rede...
          </div>
        )}

        {transactions && !loading && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Valor bruto</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatBRL(totalBruto)}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Taxas</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatBRL(totalTaxa)}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Valor líquido</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatBRL(totalLiquido)}</p>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma transação encontrada no período.</p>
            ) : (
              <TableCard>
                <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        {selectedPvs.length !== 1 && (
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Estabelecimento</th>
                        )}
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Data</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Modalidade</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Cartão</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">NSU</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Autorização</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Parcelas</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Bruto</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Taxa</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Líquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((t, i) => (
                        <tr key={`${t.nsu}-${t.authorizationCode}-${i}`} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                          {selectedPvs.length !== 1 && (
                            <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                              {t.merchant?.companyName ?? t.merchant?.companyNumber ?? '—'}
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                            {t.movementDate}{t.saleHour ? ` ${t.saleHour}` : ''}
                          </td>
                          <td className="px-4 py-2.5"><Badge tone={statusTone(t.status)}>{t.status}</Badge></td>
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{t.modality?.type} · {captureTypeLabel(t.captureType)}</td>
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-mono">{t.cardNumber}</td>
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-mono">{t.nsu}</td>
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-mono">{t.authorizationCode}</td>
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{t.installmentQuantity}x</td>
                          <td className="px-4 py-2.5 text-right text-gray-900 dark:text-gray-100">{formatBRL(t.amount)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">{formatBRL(t.amount - t.netAmount)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">{formatBRL(t.netAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TableCard>
            )}
          </>
        )}
        </TabPanel>
      </div>
      )}

      {activeTab === 'duplicatas' && (
        <div className="px-8 py-8">
          <TabPanel tabKey="duplicatas">
            <DuplicatasTab />
          </TabPanel>
        </div>
      )}
    </div>
  )
}
