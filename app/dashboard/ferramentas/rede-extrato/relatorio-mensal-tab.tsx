'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { formatBRL } from '@/lib/utils/br-format'
import { getRedeBrandName } from '@/lib/rede/brands'
import { EstablishmentPicker, type RedeEstablishment } from '@/components/rede/establishment-picker'

interface RedeTransaction {
  status: string
  amount: number
  netAmount: number
  mdrAmount: number
  brandCode: number
}

interface BrandTotal {
  code: number
  label: string
  liquido: number
  count: number
}

interface RelatorioResumo {
  mesLabel: string
  totalBruto: number
  totalMdr: number
  totalLiquido: number
  canceladasNegadas: number
  porBandeira: BrandTotal[]
}

const inputBase = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30'

// "YYYY-MM" (valor do <input type="month">) -> primeiro/último dia do mês,
// no formato "yyyy-mm-dd" esperado pela API da Rede.
function monthRange(monthStr: string): { start: string; end: string } {
  const [y, m] = monthStr.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 0))
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

// Relatório sai depois que o mês fecha — abre já no mês anterior por padrão.
function defaultMonth(): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() - 1)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function RelatorioMensalTab() {
  const [month, setMonth] = useState(defaultMonth())
  const [establishments, setEstablishments] = useState<RedeEstablishment[]>([])
  const [selectedPvs, setSelectedPvs] = useState<string[]>([])
  const [resumo, setResumo] = useState<RelatorioResumo | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
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
      const { start, end } = monthRange(month)
      const params = new URLSearchParams({ startDate: start, endDate: end })
      selectedPvs.forEach(pv => params.append('companyNumber', pv))
      const res = await fetch(`/api/ferramentas/rede-extrato?${params}`)
      const data = await res.json()
      if (Array.isArray(data.establishments)) setEstablishments(data.establishments)
      if (!res.ok) {
        setError(data.error ?? 'Erro ao consultar extrato')
        return
      }

      const transactions = (data.transactions ?? []) as RedeTransaction[]
      const approved = transactions.filter(t => t.status === 'APPROVED')
      const naoAprovadas = transactions.filter(t => t.status !== 'APPROVED')

      const totalBruto = approved.reduce((acc, t) => acc + t.amount, 0)
      const totalMdr = approved.reduce((acc, t) => acc + (t.mdrAmount ?? 0), 0)
      const totalLiquido = approved.reduce((acc, t) => acc + t.netAmount, 0)
      const canceladasNegadas = naoAprovadas.reduce((acc, t) => acc + t.amount, 0)

      const totalsByBrand = new Map<number, { liquido: number; count: number }>()
      for (const t of approved) {
        const entry = totalsByBrand.get(t.brandCode) ?? { liquido: 0, count: 0 }
        entry.liquido += t.netAmount
        entry.count += 1
        totalsByBrand.set(t.brandCode, entry)
      }
      const porBandeira = [...totalsByBrand.entries()]
        .map(([code, v]) => ({ code, label: getRedeBrandName(code), ...v }))
        .sort((a, b) => b.liquido - a.liquido)

      setResumo({ mesLabel: monthLabel(month), totalBruto, totalMdr, totalLiquido, canceladasNegadas, porBandeira })
    } catch {
      setError('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  async function exportar() {
    if (!resumo) return
    setExporting(true)
    setError('')
    try {
      const res = await fetch('/api/ferramentas/rede-extrato/relatorio-mensal/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resumo),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Erro ao exportar planilha')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-mensal-rede-${month}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Erro de rede')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400 text-sm px-4 py-3 rounded-lg mb-6">
        Resumo mensal pra envio à contabilidade — mesmos números do relatório "histórico de vendas" do portal da Rede
        (total bruto, taxas MDR, líquido, canceladas/negadas e líquido por bandeira).
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Mês</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={inputBase} />
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
        {resumo && (
          <Button type="button" onClick={exportar} loading={exporting} variant="secondary">
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </Button>
        )}
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
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 capitalize">{resumo.mesLabel}</p>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total bruto</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatBRL(resumo.totalBruto)}</p>
            </div>
            <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total em taxas de venda (MDR)</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatBRL(resumo.totalMdr)}</p>
            </div>
            <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total líquido</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatBRL(resumo.totalLiquido)}</p>
            </div>
            <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Canceladas/negadas</p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-1">{formatBRL(resumo.canceladasNegadas)}</p>
            </div>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Total líquido por bandeira</p>
          {resumo.porBandeira.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma venda aprovada no período.</p>
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
