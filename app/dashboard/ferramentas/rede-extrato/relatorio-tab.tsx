'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/utils/br-format'
import { getRedeBrandName } from '@/lib/rede/brands'
import { EstablishmentPicker, establishmentLabel, type RedeEstablishment } from '@/components/rede/establishment-picker'

interface RedeTransaction {
  status: string
  amount: number
  netAmount: number
  mdrAmount: number
  brandCode: number
  merchant?: { companyNumber: string }
}

interface RedeInstallment {
  amount: number
  netAmount: number
  mdrAmount: number
  date: string
  brandCode: number
  brandName?: string
  merchant?: { companyNumber: string }
}

interface BrandTotal {
  code: number
  label: string
  liquido: number
  count: number
}

interface VendasMetrics {
  totalBruto: number
  totalMdr: number
  totalLiquido: number
  canceladasNegadas: number
}

interface PrevisaoMetrics {
  totalBruto: number
  totalMdr: number
  totalLiquido: number
  recebidoAteHoje: number
  aReceber: number
}

interface VendasResumo {
  periodoLabel: string
  geral: VendasMetrics
  porBandeira: BrandTotal[]
  porEmpresa: (VendasMetrics & { companyNumber: string; label: string })[]
}

interface PrevisaoResumo {
  periodoLabel: string
  geral: PrevisaoMetrics
  porBandeira: BrandTotal[]
  porEmpresa: (PrevisaoMetrics & { companyNumber: string; label: string })[]
}

const inputBase = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30'

function todayISO(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

// Relatório sai depois que o mês fecha — abre já no mês anterior completo
// por padrão, mas o filtro em si é por dia (não fica preso a meses cheios).
function previousMonthRange(): { start: string; end: string } {
  const d = new Date()
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0))
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

// Datas aqui são strings "yyyy-mm-dd" puras (sem hora) — formata direto por
// string, sem passar por Date/timezone, senão desloca um dia perto da meia-noite.
function formatDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

function periodoLabel(startDate: string, endDate: string): string {
  return `${formatDateBR(startDate)} até ${formatDateBR(endDate)}`
}

function labelPorCompanyNumber(companyNumber: string, establishments: RedeEstablishment[]): string {
  const found = establishments.find(e => e.companyNumber === companyNumber)
  return found ? establishmentLabel(found) : companyNumber
}

function groupByCompany<T extends { merchant?: { companyNumber: string } }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = item.merchant?.companyNumber ?? 'desconhecido'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

function buildVendasMetrics(transactions: RedeTransaction[]): VendasMetrics {
  const approved = transactions.filter(t => t.status === 'APPROVED')
  const naoAprovadas = transactions.filter(t => t.status !== 'APPROVED')
  return {
    totalBruto: approved.reduce((acc, t) => acc + t.amount, 0),
    totalMdr: approved.reduce((acc, t) => acc + (t.mdrAmount ?? 0), 0),
    totalLiquido: approved.reduce((acc, t) => acc + t.netAmount, 0),
    canceladasNegadas: naoAprovadas.reduce((acc, t) => acc + t.amount, 0),
  }
}

function buildVendasBrandTotals(transactions: RedeTransaction[]): BrandTotal[] {
  const approved = transactions.filter(t => t.status === 'APPROVED')
  const totalsByBrand = new Map<number, { liquido: number; count: number }>()
  for (const t of approved) {
    const entry = totalsByBrand.get(t.brandCode) ?? { liquido: 0, count: 0 }
    entry.liquido += t.netAmount
    entry.count += 1
    totalsByBrand.set(t.brandCode, entry)
  }
  return [...totalsByBrand.entries()]
    .map(([code, v]) => ({ code, label: getRedeBrandName(code), ...v }))
    .sort((a, b) => b.liquido - a.liquido)
}

function buildPrevisaoMetrics(installments: RedeInstallment[]): PrevisaoMetrics {
  const hoje = todayISO(0)
  return {
    totalBruto: installments.reduce((acc, i) => acc + i.amount, 0),
    totalMdr: installments.reduce((acc, i) => acc + (i.mdrAmount ?? 0), 0),
    totalLiquido: installments.reduce((acc, i) => acc + i.netAmount, 0),
    recebidoAteHoje: installments.filter(i => i.date <= hoje).reduce((acc, i) => acc + i.netAmount, 0),
    aReceber: installments.filter(i => i.date > hoje).reduce((acc, i) => acc + i.netAmount, 0),
  }
}

function buildPrevisaoBrandTotals(installments: RedeInstallment[]): BrandTotal[] {
  const totalsByBrand = new Map<number, { liquido: number; count: number; label: string }>()
  for (const i of installments) {
    const entry = totalsByBrand.get(i.brandCode) ?? { liquido: 0, count: 0, label: i.brandName || getRedeBrandName(i.brandCode) }
    entry.liquido += i.netAmount
    entry.count += 1
    totalsByBrand.set(i.brandCode, entry)
  }
  return [...totalsByBrand.entries()]
    .map(([code, v]) => ({ code, label: v.label, liquido: v.liquido, count: v.count }))
    .sort((a, b) => b.liquido - a.liquido)
}

function MetricCard({ label, value, valueClassName }: { label: string; value: number; valueClassName?: string }) {
  return (
    <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</p>
      <p className={`text-lg font-bold mt-1 ${valueClassName ?? 'text-gray-900 dark:text-gray-100'}`}>{formatBRL(value)}</p>
    </div>
  )
}

function VendasMetricsRow({ metrics }: { metrics: VendasMetrics }) {
  return (
    <div className="flex flex-wrap gap-4">
      <MetricCard label="Total bruto" value={metrics.totalBruto} />
      <MetricCard label="Total em taxas de venda (MDR)" value={metrics.totalMdr} />
      <MetricCard label="Total líquido" value={metrics.totalLiquido} />
      <MetricCard label="Canceladas/negadas" value={metrics.canceladasNegadas} valueClassName="text-purple-600 dark:text-purple-400" />
    </div>
  )
}

function PrevisaoMetricsRow({ metrics }: { metrics: PrevisaoMetrics }) {
  return (
    <div className="flex flex-wrap gap-4">
      <MetricCard label="Total bruto" value={metrics.totalBruto} />
      <MetricCard label="Total em taxas (MDR)" value={metrics.totalMdr} />
      <MetricCard label="Total líquido" value={metrics.totalLiquido} />
      <MetricCard label="Recebido até hoje" value={metrics.recebidoAteHoje} />
      <MetricCard label="A receber" value={metrics.aReceber} valueClassName="text-brand-navy dark:text-blue-300" />
    </div>
  )
}

function BrandTotalsRow({ porBandeira, emptyLabel }: { porBandeira: BrandTotal[]; emptyLabel: string }) {
  if (porBandeira.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">{emptyLabel}</p>
  }
  return (
    <div className="flex flex-wrap gap-4">
      {porBandeira.map(b => (
        <div key={b.code} className="flex-1 min-w-[160px] bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{b.label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatBRL(b.liquido)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{b.count}x</p>
        </div>
      ))}
    </div>
  )
}

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1 gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            value === opt.value
              ? 'bg-white dark:bg-gray-900 text-brand-navy dark:text-blue-300 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

type Secao = 'vendas' | 'previsao'

export function RelatorioTab() {
  const [establishments, setEstablishments] = useState<RedeEstablishment[]>([])
  const [selectedPvs, setSelectedPvs] = useState<string[]>([])
  const [secaoAtiva, setSecaoAtiva] = useState<Secao>('vendas')

  // Filtro de Vendas — período independente do de Previsão.
  const [vendasStartDate, setVendasStartDate] = useState(() => previousMonthRange().start)
  const [vendasEndDate, setVendasEndDate] = useState(() => previousMonthRange().end)
  const [vendasResumo, setVendasResumo] = useState<VendasResumo | null>(null)
  const [loadingVendas, setLoadingVendas] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [errorVendas, setErrorVendas] = useState('')

  // Filtro de Previsão — período independente do de Vendas.
  const [previsaoStartDate, setPrevisaoStartDate] = useState(() => todayISO(0))
  const [previsaoEndDate, setPrevisaoEndDate] = useState(() => todayISO(90))
  const [previsaoResumo, setPrevisaoResumo] = useState<PrevisaoResumo | null>(null)
  const [loadingPrevisao, setLoadingPrevisao] = useState(false)
  const [errorPrevisao, setErrorPrevisao] = useState('')

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

  async function buscarVendas() {
    setLoadingVendas(true)
    setErrorVendas('')
    setVendasResumo(null)
    try {
      const params = new URLSearchParams({ startDate: vendasStartDate, endDate: vendasEndDate })
      selectedPvs.forEach(pv => params.append('companyNumber', pv))
      const res = await fetch(`/api/ferramentas/rede-extrato?${params}`)
      const data = await res.json()
      if (Array.isArray(data?.establishments)) setEstablishments(data.establishments)

      if (!res.ok) {
        setErrorVendas(data.error ?? 'Erro ao consultar extrato')
        return
      }

      const transactions = (data.transactions ?? []) as RedeTransaction[]
      const porEmpresaMap = groupByCompany(transactions)
      const porEmpresa = [...porEmpresaMap.entries()]
        .map(([companyNumber, items]) => ({
          companyNumber,
          label: labelPorCompanyNumber(companyNumber, Array.isArray(data?.establishments) ? data.establishments : establishments),
          ...buildVendasMetrics(items),
        }))
        .sort((a, b) => b.totalBruto - a.totalBruto)

      setVendasResumo({
        periodoLabel: periodoLabel(vendasStartDate, vendasEndDate),
        geral: buildVendasMetrics(transactions),
        porBandeira: buildVendasBrandTotals(transactions),
        porEmpresa,
      })
    } catch {
      setErrorVendas('Erro de rede')
    } finally {
      setLoadingVendas(false)
    }
  }

  async function buscarPrevisao() {
    setLoadingPrevisao(true)
    setErrorPrevisao('')
    setPrevisaoResumo(null)
    try {
      // O backend (fetchRedeInstallments) já quebra internamente em
      // sub-consultas menores contra a Rede, que rejeita intervalos maiores
      // que ~61 dias por chamada — aqui pode mandar qualquer período.
      const params = new URLSearchParams({ startDate: previsaoStartDate, endDate: previsaoEndDate })
      selectedPvs.forEach(pv => params.append('companyNumber', pv))
      const res = await fetch(`/api/ferramentas/rede-extrato/previsao-recebimentos?${params}`)
      const data = await res.json()
      if (Array.isArray(data?.establishments)) setEstablishments(data.establishments)

      if (!res.ok) {
        setErrorPrevisao(data.error ?? 'Erro ao consultar recebíveis')
        return
      }

      const installments = (data.installments ?? []) as RedeInstallment[]
      const porEmpresaMap = groupByCompany(installments)
      const porEmpresa = [...porEmpresaMap.entries()]
        .map(([companyNumber, items]) => ({
          companyNumber,
          label: labelPorCompanyNumber(companyNumber, Array.isArray(data?.establishments) ? data.establishments : establishments),
          ...buildPrevisaoMetrics(items),
        }))
        .sort((a, b) => b.totalBruto - a.totalBruto)

      setPrevisaoResumo({
        periodoLabel: periodoLabel(previsaoStartDate, previsaoEndDate),
        geral: buildPrevisaoMetrics(installments),
        porBandeira: buildPrevisaoBrandTotals(installments),
        porEmpresa,
      })
    } catch {
      setErrorPrevisao('Erro de rede')
    } finally {
      setLoadingPrevisao(false)
    }
  }

  async function exportar() {
    if (!vendasResumo) return
    setExporting(true)
    setErrorVendas('')
    try {
      const res = await fetch('/api/ferramentas/rede-extrato/relatorio-mensal/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendasResumo),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorVendas(data.error ?? 'Erro ao exportar planilha')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-rede-${vendasStartDate}_a_${vendasEndDate}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setErrorVendas('Erro de rede')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 mb-6 flex flex-wrap items-end gap-4">
        <EstablishmentPicker
          establishments={establishments}
          selected={selectedPvs}
          onToggle={togglePv}
          onClear={() => setSelectedPvs([])}
        />
      </div>

      <div className="mb-6">
        <SegmentedToggle
          value={secaoAtiva}
          onChange={setSecaoAtiva}
          options={[
            { value: 'vendas', label: 'Vendas no Período' },
            { value: 'previsao', label: 'Previsão de Recebimentos' },
          ]}
        />
      </div>

      {secaoAtiva === 'vendas' && (
        <section>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 mb-6 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Data inicial</label>
              <input type="date" value={vendasStartDate} onChange={e => setVendasStartDate(e.target.value)} className={inputBase} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Data final</label>
              <input type="date" value={vendasEndDate} onChange={e => setVendasEndDate(e.target.value)} className={inputBase} />
            </div>
            <Button type="button" onClick={buscarVendas} loading={loadingVendas}>
              {loadingVendas ? 'Buscando…' : 'Buscar'}
            </Button>
            {vendasResumo && (
              <Button type="button" onClick={exportar} loading={exporting} variant="secondary">
                {exporting ? 'Exportando…' : 'Exportar Excel'}
              </Button>
            )}
          </div>

          {errorVendas && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg mb-6">
              {errorVendas}
            </div>
          )}

          {loadingVendas && (
            <div className="flex items-center gap-3 text-sm text-gray-400 dark:text-gray-500">
              <Spinner size="md" />
              Consultando API da Rede...
            </div>
          )}

          {vendasResumo && !loadingVendas && (
            <>
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400 text-sm px-4 py-3 rounded-lg mb-4">
                Resumo pra envio à contabilidade — mesmos números do relatório "histórico de vendas" do portal da Rede.
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Vendas no período — {vendasResumo.periodoLabel}</p>
              <VendasMetricsRow metrics={vendasResumo.geral} />

              {vendasResumo.porEmpresa.length > 1 && (
                <div className="mt-6 space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Por estabelecimento</p>
                  {vendasResumo.porEmpresa.map(empresa => (
                    <div key={empresa.companyNumber}>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">{empresa.label}</p>
                      <VendasMetricsRow metrics={empresa} />
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4 mt-6">Total líquido por bandeira</p>
              <BrandTotalsRow porBandeira={vendasResumo.porBandeira} emptyLabel="Nenhuma venda aprovada no período." />
            </>
          )}
        </section>
      )}

      {secaoAtiva === 'previsao' && (
        <section>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 mb-6 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Data inicial</label>
              <input type="date" value={previsaoStartDate} onChange={e => setPrevisaoStartDate(e.target.value)} className={inputBase} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Data final</label>
              <input type="date" value={previsaoEndDate} onChange={e => setPrevisaoEndDate(e.target.value)} className={inputBase} />
            </div>
            <Button type="button" onClick={buscarPrevisao} loading={loadingPrevisao}>
              {loadingPrevisao ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>

          {errorPrevisao && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg mb-6">
              {errorPrevisao}
            </div>
          )}

          {loadingPrevisao && (
            <div className="flex items-center gap-3 text-sm text-gray-400 dark:text-gray-500">
              <Spinner size="md" />
              Consultando API da Rede...
            </div>
          )}

          {previsaoResumo && !loadingPrevisao && (
            <>
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400 text-sm px-4 py-3 rounded-lg mb-4">
                Previsão das parcelas a receber no período (data prevista de recebimento, não data da venda). Ainda
                não distingue "cancelado" ou "atrasado" — não há evidência de status diferente de "agendado" nos
                dados observados até agora; a divisão abaixo é só entre parcelas já vencidas (recebido até hoje) e
                futuras (a receber).
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Previsão de recebimentos — {previsaoResumo.periodoLabel}</p>
              <PrevisaoMetricsRow metrics={previsaoResumo.geral} />

              {previsaoResumo.porEmpresa.length > 1 && (
                <div className="mt-6 space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Por estabelecimento</p>
                  {previsaoResumo.porEmpresa.map(empresa => (
                    <div key={empresa.companyNumber}>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">{empresa.label}</p>
                      <PrevisaoMetricsRow metrics={empresa} />
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4 mt-6">Total líquido por bandeira</p>
              <BrandTotalsRow porBandeira={previsaoResumo.porBandeira} emptyLabel="Nenhuma parcela encontrada no período." />
            </>
          )}
        </section>
      )}
    </div>
  )
}
