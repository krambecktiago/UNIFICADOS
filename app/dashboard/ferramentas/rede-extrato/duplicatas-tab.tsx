'use client'

import { useEffect, useRef, useState } from 'react'
import { TableCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { formatBRL } from '@/lib/utils/br-format'
import { conciliarDuplicatas, type DuplicataStatus, type VendaStatus } from '@/lib/jjw/conciliacao'
import type { JjwDuplicata } from '@/lib/jjw/client'
import type { RedeTransaction } from '@/lib/rede/client'

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

const DUPLICATA_STATUS_LABEL: Record<DuplicataStatus, string> = {
  conciliado: 'Conciliado',
  divergente: 'Divergente',
  sem_venda: 'Sem venda no cartão',
}
const DUPLICATA_STATUS_TONE: Record<DuplicataStatus, 'green' | 'amber' | 'gray'> = {
  conciliado: 'green',
  divergente: 'amber',
  sem_venda: 'gray',
}

const VENDA_STATUS_LABEL: Record<VendaStatus, string> = {
  conciliado: 'Conciliado',
  divergente: 'Divergente',
  sem_duplicata: 'Sem duplicata aberta',
}
const VENDA_STATUS_TONE: Record<VendaStatus, 'green' | 'amber' | 'gray'> = {
  conciliado: 'green',
  divergente: 'amber',
  sem_duplicata: 'gray',
}

const inputBase = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30'

export function DuplicatasTab() {
  const [startDate, setStartDate] = useState(todayISO(-1))
  const [endDate, setEndDate] = useState(todayISO(-1))
  const [establishments, setEstablishments] = useState<RedeEstablishment[]>([])
  const [selectedPvs, setSelectedPvs] = useState<string[]>([])
  const [showPvMenu, setShowPvMenu] = useState(false)
  const pvMenuRef = useRef<HTMLDivElement>(null)

  const [vendas, setVendas] = useState<RedeTransaction[] | null>(null)
  const [duplicatas, setDuplicatas] = useState<JjwDuplicata[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pvMenuRef.current && !pvMenuRef.current.contains(e.target as Node)) setShowPvMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function togglePv(companyNumber: string) {
    setSelectedPvs(prev => (prev.includes(companyNumber) ? prev.filter(p => p !== companyNumber) : [...prev, companyNumber]))
  }

  function pvMenuLabel(): string {
    if (selectedPvs.length === 0) return 'Todos os estabelecimentos'
    if (selectedPvs.length === 1) {
      const found = establishments.find(e => e.companyNumber === selectedPvs[0])
      return found ? establishmentLabel(found) : selectedPvs[0]
    }
    return `${selectedPvs.length} estabelecimentos selecionados`
  }

  async function buscar() {
    setLoading(true)
    setError('')
    setVendas(null)
    setDuplicatas(null)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      selectedPvs.forEach(pv => params.append('companyNumber', pv))

      const [vendasRes, duplicatasRes] = await Promise.all([
        fetch(`/api/ferramentas/rede-extrato?${params}`),
        fetch(`/api/ferramentas/rede-extrato/duplicatas?${params}`),
      ])
      const vendasData = await vendasRes.json()
      const duplicatasData = await duplicatasRes.json()

      if (Array.isArray(vendasData.establishments)) setEstablishments(vendasData.establishments)

      if (!vendasRes.ok) {
        setError(vendasData.error ?? 'Erro ao consultar vendas da Rede')
        return
      }
      if (!duplicatasRes.ok) {
        setError(duplicatasData.error ?? 'Erro ao consultar duplicatas do JJW')
        return
      }

      setVendas(vendasData.transactions)
      setDuplicatas(duplicatasData.duplicatas)
    } catch {
      setError('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    buscar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { duplicatasResult, vendasResult } =
    vendas && duplicatas ? conciliarDuplicatas(duplicatas, vendas) : { duplicatasResult: [], vendasResult: [] }

  const conciliadoCount = duplicatasResult.filter(d => d.status === 'conciliado').length
  const divergenteCount = duplicatasResult.filter(d => d.status === 'divergente').length
  const semVendaCount = duplicatasResult.filter(d => d.status === 'sem_venda').length

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg">
        Integração com a API do JJW (Besser Core) ainda não está configurada — as duplicatas abaixo são dados de
        exemplo só pra validar o layout. A conciliação por valor + data é uma heurística: hoje não existe um
        identificador comum (NSU/TID) entre a venda no cartão e a duplicata do JJW.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <div className="bg-white rounded-xl p-6 border border-gray-200 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Data inicial</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputBase} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Data final</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputBase} />
        </div>
        <div className="relative" ref={pvMenuRef}>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Estabelecimento</label>
          <button
            type="button"
            onClick={() => setShowPvMenu(v => !v)}
            className={inputBase + ' text-left flex items-center justify-between gap-2 min-w-[220px]'}
          >
            <span className="truncate">{pvMenuLabel()}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
          </button>
          {showPvMenu && (
            <div className="absolute z-10 mt-1 w-full min-w-[240px] bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
              <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selectedPvs.length === 0} onChange={() => setSelectedPvs([])} className="rounded border-gray-300" />
                Todos os estabelecimentos
              </label>
              <div className="border-t border-gray-100 my-1" />
              {establishments.map(e => (
                <label key={e.companyNumber} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selectedPvs.includes(e.companyNumber)} onChange={() => togglePv(e.companyNumber)} className="rounded border-gray-300" />
                  {establishmentLabel(e)}
                </label>
              ))}
            </div>
          )}
        </div>
        <Button type="button" onClick={buscar} loading={loading}>
          {loading ? 'Buscando…' : 'Buscar'}
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Spinner size="md" />
          Consultando Rede e JJW...
        </div>
      )}

      {duplicatas && vendas && !loading && (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <Badge tone="green">{conciliadoCount} conciliada(s)</Badge>
            <Badge tone="amber">{divergenteCount} divergente(s)</Badge>
            <Badge tone="gray">{semVendaCount} sem venda no cartão</Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Vendas no cartão (Rede)</h3>
              {vendasResult.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma venda encontrada no período.</p>
              ) : (
                <TableCard>
                  <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Data</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Bruto</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">NSU</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendasResult.map((v, i) => (
                          <tr key={`${v.venda.nsu}-${i}`} className="border-b border-gray-100 last:border-0">
                            <td className="px-3 py-2.5 text-gray-700">{v.venda.movementDate}</td>
                            <td className="px-3 py-2.5 text-right text-gray-900">{formatBRL(v.venda.amount)}</td>
                            <td className="px-3 py-2.5 text-gray-700 font-mono">{v.venda.nsu}</td>
                            <td className="px-3 py-2.5"><Badge tone={VENDA_STATUS_TONE[v.status]}>{VENDA_STATUS_LABEL[v.status]}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TableCard>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Duplicatas em aberto (JJW)</h3>
              {duplicatasResult.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma duplicata em aberto no período.</p>
              ) : (
                <TableCard>
                  <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Nº</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Emissão</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Valor</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Cliente</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duplicatasResult.map((d, i) => (
                          <tr key={`${d.duplicata.numero}-${i}`} className="border-b border-gray-100 last:border-0">
                            <td className="px-3 py-2.5 text-gray-700 font-mono">{d.duplicata.numero}</td>
                            <td className="px-3 py-2.5 text-gray-700">{d.duplicata.dataEmissao}</td>
                            <td className="px-3 py-2.5 text-right text-gray-900">{formatBRL(d.duplicata.valor)}</td>
                            <td className="px-3 py-2.5 text-gray-700 truncate max-w-[160px]">{d.duplicata.cliente}</td>
                            <td className="px-3 py-2.5"><Badge tone={DUPLICATA_STATUS_TONE[d.status]}>{DUPLICATA_STATUS_LABEL[d.status]}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TableCard>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
