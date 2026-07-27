'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { formatBRL } from '@/lib/utils/br-format'
import { getRedeBrandName } from '@/lib/rede/brands'
import { EstablishmentPicker, type RedeEstablishment } from '@/components/rede/establishment-picker'

interface RedeInstallment {
  amount: number
  netAmount: number
  mdrAmount: number
  date: string
  brandCode: number
  brandName?: string
}

interface BrandTotal {
  code: number
  label: string
  liquido: number
  count: number
}

interface PrevisaoResumo {
  totalBruto: number
  totalMdr: number
  totalLiquido: number
  recebidoAteHoje: number
  aReceber: number
  porBandeira: BrandTotal[]
}

const inputBase = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30'

function todayISO(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export function PrevisaoRecebimentosTab() {
  const [startDate, setStartDate] = useState(todayISO(0))
  const [endDate, setEndDate] = useState(todayISO(90))
  const [establishments, setEstablishments] = useState<RedeEstablishment[]>([])
  const [selectedPvs, setSelectedPvs] = useState<string[]>([])
  const [resumo, setResumo] = useState<PrevisaoResumo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/ferramentas/rede-extrato/establishments')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.establishments)) setEstablishments(data.establishments)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/profile/me')
      .then(res => res.json())
      .then(data => {
        if (data.companyNumber) setSelectedPvs([data.companyNumber])
      })
      .catch(() => {})
  }, [])

  function togglePv(companyNumber: string) {
    setSelectedPvs(prev =>
      prev.includes(companyNumber) ? prev.filter(p => p !== companyNumber) : [...prev, companyNumber]
    )
  }

  async function buscar() {
    setLoading(true)
    setError('')
    setResumo(null)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      selectedPvs.forEach(pv => params.append('companyNumber', pv))
      const res = await fetch(`/api/ferramentas/rede-extrato/previsao-recebimentos?${params}`)
      const data = await res.json()
      if (Array.isArray(data.establishments)) setEstablishments(data.establishments)
      if (!res.ok) {
        setError(data.error ?? 'Erro ao consultar recebíveis')
        return
      }

      const installments = (data.installments ?? []) as RedeInstallment[]
      const hoje = todayISO(0)

      const totalBruto = installments.reduce((acc, i) => acc + i.amount, 0)
      const totalMdr = installments.reduce((acc, i) => acc + (i.mdrAmount ?? 0), 0)
      const totalLiquido = installments.reduce((acc, i) => acc + i.netAmount, 0)
      const recebidoAteHoje = installments.filter(i => i.date <= hoje).reduce((acc, i) => acc + i.netAmount, 0)
      const aReceber = installments.filter(i => i.date > hoje).reduce((acc, i) => acc + i.netAmount, 0)

      const totalsByBrand = new Map<number, { liquido: number; count: number; label: string }>()
      for (const i of installments) {
        const entry = totalsByBrand.get(i.brandCode) ?? { liquido: 0, count: 0, label: i.brandName || getRedeBrandName(i.brandCode) }
        entry.liquido += i.netAmount
        entry.count += 1
        totalsByBrand.set(i.brandCode, entry)
      }
      const porBandeira = [...totalsByBrand.entries()]
        .map(([code, v]) => ({ code, label: v.label, liquido: v.liquido, count: v.count }))
        .sort((a, b) => b.liquido - a.liquido)

      setResumo({ totalBruto, totalMdr, totalLiquido, recebidoAteHoje, aReceber, porBandeira })
    } catch {
      setError('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400 text-sm px-4 py-3 rounded-lg mb-6">
        Previsão das parcelas a receber no período (data prevista de recebimento, não data da venda). Ainda não
        distingue "cancelado" ou "atrasado" — não há evidência de status diferente de "agendado" nos dados
        observados até agora; a divisão abaixo é só entre parcelas já vencidas (recebido até hoje) e futuras (a
        receber).
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
        <EstablishmentPicker
          establishments={establishments}
          selected={selectedPvs}
          onToggle={togglePv}
          onClear={() => setSelectedPvs([])}
        />
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

      {resumo && !loading && (
        <>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total bruto</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatBRL(resumo.totalBruto)}</p>
            </div>
            <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total em taxas (MDR)</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatBRL(resumo.totalMdr)}</p>
            </div>
            <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total líquido</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatBRL(resumo.totalLiquido)}</p>
            </div>
            <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Recebido até hoje</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatBRL(resumo.recebidoAteHoje)}</p>
            </div>
            <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">A receber</p>
              <p className="text-lg font-bold text-brand-navy dark:text-blue-300 mt-1">{formatBRL(resumo.aReceber)}</p>
            </div>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Total líquido por bandeira</p>
          {resumo.porBandeira.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma parcela encontrada no período.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {resumo.porBandeira.map(b => (
                <div key={b.code} className="flex-1 min-w-[160px] bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{b.label}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatBRL(b.liquido)}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{b.count}x</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
