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
  mesLabel: string
  geral: VendasMetrics
  porBandeira: BrandTotal[]
  porEmpresa: (VendasMetrics & { companyNumber: string; label: string })[]
}

interface PrevisaoJanela {
  dias: number
  label: string
  geral: PrevisaoMetrics
  porEmpresa: (PrevisaoMetrics & { companyNumber: string; label: string })[]
}

interface PrevisaoResumo {
  janelas: PrevisaoJanela[]
  porBandeira: BrandTotal[]
}

const JANELAS_PREVISAO = [
  { dias: 90, label: 'Próximos 90 dias' },
  { dias: 180, label: 'Próximos 180 dias' },
  { dias: 365, label: 'Próximos 365 dias' },
]

const inputBase = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30'

function todayISO(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

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

function SegmentedToggle<T extends string | number>({
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
  const [month, setMonth] = useState(defaultMonth())
  const [establishments, setEstablishments] = useState<RedeEstablishment[]>([])
  const [selectedPvs, setSelectedPvs] = useState<string[]>([])
  const [vendasResumo, setVendasResumo] = useState<VendasResumo | null>(null)
  const [previsaoResumo, setPrevisaoResumo] = useState<PrevisaoResumo | null>(null)
  const [secaoAtiva, setSecaoAtiva] = useState<Secao>('vendas')
  const [janelaAtiva, setJanelaAtiva] = useState(90)
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
    setVendasResumo(null)
    setPrevisaoResumo(null)
    try {
      const { start, end } = monthRange(month)
      const paramsVendas = new URLSearchParams({ startDate: start, endDate: end })
      selectedPvs.forEach(pv => paramsVendas.append('companyNumber', pv))

      // Busca de uma vez os 365 dias mais largos — o backend (fetchRedeInstallments)
      // já quebra isso em sub-consultas menores contra a Rede, que rejeita
      // intervalos maiores que ~61 dias por chamada.
      const paramsPrevisao = new URLSearchParams({ startDate: todayISO(0), endDate: todayISO(365) })
      selectedPvs.forEach(pv => paramsPrevisao.append('companyNumber', pv))

      const [resVendas, resPrevisao] = await Promise.all([
        fetch(`/api/ferramentas/rede-extrato?${paramsVendas}`),
        fetch(`/api/ferramentas/rede-extrato/previsao-recebimentos?${paramsPrevisao}`),
      ])
      const dataVendas = await resVendas.json()
      const dataPrevisao = await resPrevisao.json()

      const currentEstablishments: RedeEstablishment[] = Array.isArray(dataVendas?.establishments)
        ? dataVendas.establishments
        : establishments
      setEstablishments(currentEstablishments)

      if (!resVendas.ok) {
        setError(dataVendas.error ?? 'Erro ao consultar extrato')
        return
      }
      if (!resPrevisao.ok) {
        setError(dataPrevisao.error ?? 'Erro ao consultar recebíveis')
        return
      }

      const transactions = (dataVendas.transactions ?? []) as RedeTransaction[]
      const vendasPorEmpresaMap = groupByCompany(transactions)
      const vendasPorEmpresa = [...vendasPorEmpresaMap.entries()]
        .map(([companyNumber, items]) => ({
          companyNumber,
          label: labelPorCompanyNumber(companyNumber, currentEstablishments),
          ...buildVendasMetrics(items),
        }))
        .sort((a, b) => b.totalBruto - a.totalBruto)

      setVendasResumo({
        mesLabel: monthLabel(month),
        geral: buildVendasMetrics(transactions),
        porBandeira: buildVendasBrandTotals(transactions),
        porEmpresa: vendasPorEmpresa,
      })

      const installments = (dataPrevisao.installments ?? []) as RedeInstallment[]

      const janelas = JANELAS_PREVISAO.map(({ dias, label }) => {
        const limite = todayISO(dias)
        const doPeriodo = installments.filter(i => i.date <= limite)
        const porEmpresaMap = groupByCompany(doPeriodo)
        const porEmpresa = [...porEmpresaMap.entries()]
          .map(([companyNumber, items]) => ({
            companyNumber,
            label: labelPorCompanyNumber(companyNumber, currentEstablishments),
            ...buildPrevisaoMetrics(items),
          }))
          .sort((a, b) => b.totalBruto - a.totalBruto)

        return { dias, label, geral: buildPrevisaoMetrics(doPeriodo), porEmpresa }
      })

      setPrevisaoResumo({
        janelas,
        // Bandeira calculada sobre a janela mais ampla (365 dias) — não repete
        // a mesma tabela em cada uma das 3 janelas.
        porBandeira: buildPrevisaoBrandTotals(installments),
      })
    } catch {
      setError('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  async function exportar() {
    if (!vendasResumo) return
    setExporting(true)
    setError('')
    try {
      const res = await fetch('/api/ferramentas/rede-extrato/relatorio-mensal/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendasResumo),
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
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Mês (vendas)</label>
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
        {vendasResumo && (
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

      {(vendasResumo || previsaoResumo) && !loading && (
        <div className="mb-6">
          <SegmentedToggle
            value={secaoAtiva}
            onChange={setSecaoAtiva}
            options={[
              { value: 'vendas', label: 'Vendas do Mês' },
              { value: 'previsao', label: 'Previsão de Recebimentos' },
            ]}
          />
        </div>
      )}

      {vendasResumo && !loading && secaoAtiva === 'vendas' && (
        <section>
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400 text-sm px-4 py-3 rounded-lg mb-4">
            Resumo mensal pra envio à contabilidade — mesmos números do relatório "histórico de vendas" do portal da Rede.
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Vendas do mês — <span className="capitalize">{vendasResumo.mesLabel}</span></p>
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
        </section>
      )}

      {previsaoResumo && !loading && secaoAtiva === 'previsao' && (
        <section>
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400 text-sm px-4 py-3 rounded-lg mb-4">
            Previsão das parcelas a receber (data prevista de recebimento, não data da venda — cada janela é
            cumulativa, inclui a anterior). Ainda não distingue "cancelado" ou "atrasado" — não há evidência de
            status diferente de "agendado" nos dados observados até agora.
          </div>

          <div className="mb-4">
            <SegmentedToggle
              value={janelaAtiva}
              onChange={setJanelaAtiva}
              options={previsaoResumo.janelas.map(j => ({ value: j.dias, label: j.label }))}
            />
          </div>

          {previsaoResumo.janelas
            .filter(janela => janela.dias === janelaAtiva)
            .map(janela => (
              <div key={janela.dias}>
                <PrevisaoMetricsRow metrics={janela.geral} />

                {janela.porEmpresa.length > 1 && (
                  <div className="mt-6 space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Por estabelecimento</p>
                    {janela.porEmpresa.map(empresa => (
                      <div key={empresa.companyNumber}>
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">{empresa.label}</p>
                        <PrevisaoMetricsRow metrics={empresa} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4 mt-8">Total líquido por bandeira (365 dias)</p>
          <BrandTotalsRow porBandeira={previsaoResumo.porBandeira} emptyLabel="Nenhuma parcela encontrada no período." />
        </section>
      )}
    </div>
  )
}
