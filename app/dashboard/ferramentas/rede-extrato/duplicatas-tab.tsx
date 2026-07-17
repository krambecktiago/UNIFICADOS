'use client'

import { useEffect, useRef, useState } from 'react'
import { TableCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { CurrencyInput } from '@/components/ui/currency-input'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/utils/br-format'
import { conciliarDuplicatas, type DuplicataStatus, type VendaStatus } from '@/lib/jjw/conciliacao'
import type { JjwDuplicata } from '@/lib/jjw/client'
import type { RedeTransaction } from '@/lib/rede/client'

interface ParConfirmado {
  duplicataNumero: string
  cliente: string
  nsu: number
  autorizacao: number
  parcelas: number
  modalidade: string
  valor: number
}

function modalidadeLabel(type?: string): string {
  if (type === 'CREDITO') return 'Crédito'
  if (type === 'DEBITO') return 'Débito'
  return type ?? '—'
}

function formatarParaCopia(p: ParConfirmado): string {
  return `NSU: ${p.nsu} | Autorização: ${p.autorizacao} | Parcelas: ${p.parcelas}x | Modalidade: ${p.modalidade} | Valor: ${formatBRL(p.valor)}`
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

const inputBase = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30'

function EstablishmentPicker({
  establishments,
  selected,
  onToggle,
  onClear,
}: {
  establishments: RedeEstablishment[]
  selected: string[]
  onToggle: (companyNumber: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function label(): string {
    if (selected.length === 0) return 'Todos os estabelecimentos'
    if (selected.length === 1) {
      const found = establishments.find(e => e.companyNumber === selected[0])
      return found ? establishmentLabel(found) : selected[0]
    }
    return `${selected.length} estabelecimentos selecionados`
  }

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Estabelecimento</label>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={inputBase + ' text-left flex items-center justify-between gap-2 min-w-[200px]'}
      >
        <span className="truncate">{label()}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full min-w-[240px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
          <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
            <input type="checkbox" checked={selected.length === 0} onChange={onClear} className="rounded border-gray-300 dark:border-gray-600" />
            Todos os estabelecimentos
          </label>
          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          {establishments.map(e => (
            <label key={e.companyNumber} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input type="checkbox" checked={selected.includes(e.companyNumber)} onChange={() => onToggle(e.companyNumber)} className="rounded border-gray-300 dark:border-gray-600" />
              {establishmentLabel(e)}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export function DuplicatasTab() {
  // Filtro do lado "Vendas no cartão (Rede)"
  const [startDateVendas, setStartDateVendas] = useState(todayISO(-1))
  const [endDateVendas, setEndDateVendas] = useState(todayISO(-1))
  const [establishmentsVendas, setEstablishmentsVendas] = useState<RedeEstablishment[]>([])
  const [selectedPvsVendas, setSelectedPvsVendas] = useState<string[]>([])
  const [minValorVendas, setMinValorVendas] = useState<number | null>(null)
  const [maxValorVendas, setMaxValorVendas] = useState<number | null>(null)
  const [vendas, setVendas] = useState<RedeTransaction[] | null>(null)
  const [loadingVendas, setLoadingVendas] = useState(false)
  const [errorVendas, setErrorVendas] = useState('')

  // Filtro do lado "Duplicatas em aberto (JJW)" — independente do de vendas
  const [startDateDuplicatas, setStartDateDuplicatas] = useState(todayISO(-1))
  const [endDateDuplicatas, setEndDateDuplicatas] = useState(todayISO(-1))
  const [establishmentsDuplicatas, setEstablishmentsDuplicatas] = useState<RedeEstablishment[]>([])
  const [selectedPvsDuplicatas, setSelectedPvsDuplicatas] = useState<string[]>([])
  const [minValorDuplicatas, setMinValorDuplicatas] = useState<number | null>(null)
  const [maxValorDuplicatas, setMaxValorDuplicatas] = useState<number | null>(null)
  const [duplicatas, setDuplicatas] = useState<JjwDuplicata[] | null>(null)
  const [loadingDuplicatas, setLoadingDuplicatas] = useState(false)
  const [errorDuplicatas, setErrorDuplicatas] = useState('')

  // Seleção manual do par venda + duplicata(s) pra puxar os dados da baixa —
  // uma venda pode cobrir várias duplicatas (ex: valor dividido), por isso
  // a venda é seleção única e a duplicata é múltipla.
  const [selectedVendaIdx, setSelectedVendaIdx] = useState<number | null>(null)
  const [selectedDuplicataIdxs, setSelectedDuplicataIdxs] = useState<number[]>([])
  const [paresConfirmados, setParesConfirmados] = useState<ParConfirmado[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  // Lista de PVs (matriz + filiais) já disponível antes de qualquer busca,
  // pra poder filtrar por estabelecimento desde a primeira consulta.
  useEffect(() => {
    fetch('/api/ferramentas/rede-extrato/establishments')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.establishments)) {
          setEstablishmentsVendas(data.establishments)
          setEstablishmentsDuplicatas(data.establishments)
        }
      })
      .catch(() => {})
  }, [])

  function togglePvVendas(companyNumber: string) {
    setSelectedPvsVendas(prev => (prev.includes(companyNumber) ? prev.filter(p => p !== companyNumber) : [...prev, companyNumber]))
  }

  function togglePvDuplicatas(companyNumber: string) {
    setSelectedPvsDuplicatas(prev => (prev.includes(companyNumber) ? prev.filter(p => p !== companyNumber) : [...prev, companyNumber]))
  }

  async function buscarVendas() {
    setLoadingVendas(true)
    setErrorVendas('')
    setVendas(null)
    setSelectedVendaIdx(null)
    try {
      const params = new URLSearchParams({ startDate: startDateVendas, endDate: endDateVendas })
      selectedPvsVendas.forEach(pv => params.append('companyNumber', pv))
      const res = await fetch(`/api/ferramentas/rede-extrato?${params}`)
      const data = await res.json()
      if (Array.isArray(data.establishments)) setEstablishmentsVendas(data.establishments)
      if (!res.ok) {
        setErrorVendas(data.error ?? 'Erro ao consultar vendas da Rede')
        return
      }
      // Duplicata só é gerada pra venda física (POS) ou Link de Pagamento
      // (a Rede identifica como "ECOMMERCE") — PDV e outros tipos ficam fora.
      const vendasFiltradas = (data.transactions as RedeTransaction[]).filter(
        t => t.captureType === 'POS' || t.captureType === 'ECOMMERCE'
      )
      setVendas(vendasFiltradas)
    } catch {
      setErrorVendas('Erro de rede')
    } finally {
      setLoadingVendas(false)
    }
  }

  async function buscarDuplicatas() {
    setLoadingDuplicatas(true)
    setErrorDuplicatas('')
    setDuplicatas(null)
    setSelectedDuplicataIdxs([])
    try {
      const params = new URLSearchParams({ startDate: startDateDuplicatas, endDate: endDateDuplicatas })
      selectedPvsDuplicatas.forEach(pv => params.append('companyNumber', pv))
      const res = await fetch(`/api/ferramentas/rede-extrato/duplicatas?${params}`)
      const data = await res.json()
      if (Array.isArray(data.establishments)) setEstablishmentsDuplicatas(data.establishments)
      if (!res.ok) {
        setErrorDuplicatas(data.error ?? 'Erro ao consultar duplicatas do JJW')
        return
      }
      setDuplicatas(data.duplicatas)
    } catch {
      setErrorDuplicatas('Erro de rede')
    } finally {
      setLoadingDuplicatas(false)
    }
  }

  // Filtro de valor bruto é aplicado em cima do que já veio da API — não
  // precisa de nova consulta pra trocar a faixa de valor.
  const vendasFiltradasPorValor: RedeTransaction[] | null = vendas
    ? vendas.filter(t => {
        if (minValorVendas !== null && t.amount < minValorVendas) return false
        if (maxValorVendas !== null && t.amount > maxValorVendas) return false
        return true
      })
    : null

  const duplicatasFiltradasPorValor: JjwDuplicata[] | null = duplicatas
    ? duplicatas.filter(d => {
        if (minValorDuplicatas !== null && d.valor < minValorDuplicatas) return false
        if (maxValorDuplicatas !== null && d.valor > maxValorDuplicatas) return false
        return true
      })
    : null

  // Cada coluna mostra o que já tem assim que chega — a conciliação (que
  // precisa dos dois lados) só entra depois, sem travar quem carregou primeiro.
  const conciliacao = vendasFiltradasPorValor && duplicatasFiltradasPorValor
    ? conciliarDuplicatas(duplicatasFiltradasPorValor, vendasFiltradasPorValor)
    : null

  const vendasResult: { venda: RedeTransaction; duplicata: JjwDuplicata | null; status: VendaStatus | null }[] =
    conciliacao ? conciliacao.vendasResult : (vendasFiltradasPorValor ?? []).map(v => ({ venda: v, duplicata: null, status: null }))

  const duplicatasResult: { duplicata: JjwDuplicata; venda: RedeTransaction | null; status: DuplicataStatus | null }[] =
    conciliacao ? conciliacao.duplicatasResult : (duplicatasFiltradasPorValor ?? []).map(d => ({ duplicata: d, venda: null, status: null }))

  // Uma duplicata (ou venda) só é considerada vinculada quando entra de fato
  // num par confirmado — o status da heurística (conciliado/divergente/
  // sem_venda) só serve pra pré-selecionar a venda, não pra decidir a cor.
  const duplicataNumerosConfirmados = new Set(paresConfirmados.map(p => p.duplicataNumero))
  const vendaNsusConfirmados = new Set(paresConfirmados.map(p => p.nsu))
  const vinculadasCount = duplicatasResult.filter(d => duplicataNumerosConfirmados.has(d.duplicata.numero)).length
  const naoVinculadasCount = duplicatasResult.length - vinculadasCount

  const totalVendas = (vendasFiltradasPorValor ?? []).reduce((acc, t) => acc + t.amount, 0)
  const totalDuplicatas = (duplicatasFiltradasPorValor ?? []).reduce((acc, d) => acc + d.valor, 0)

  function selecionarVenda(i: number) {
    // Venda já vinculada a um par confirmado fica bloqueada — só permite um
    // lançamento, igual a duplicata.
    if (vendaNsusConfirmados.has(vendasResult[i].venda.nsu)) return
    setSelectedVendaIdx(prev => (prev === i ? null : i))
  }

  // Duplicata é seleção múltipla (várias duplicatas podem cair numa mesma
  // venda). A primeira duplicata clicada, se já tiver a venda casada pela
  // heurística e nenhuma venda estiver selecionada ainda, pré-seleciona essa
  // venda — o usuário pode clicar em outra pra trocar.
  function selecionarDuplicata(i: number) {
    // Duplicata já vinculada a um par confirmado fica bloqueada — não pode
    // ser puxada pra outra venda até ser removida da lista de pares.
    if (duplicataNumerosConfirmados.has(duplicatasResult[i].duplicata.numero)) return
    const jaSelecionada = selectedDuplicataIdxs.includes(i)
    setSelectedDuplicataIdxs(prev => (jaSelecionada ? prev.filter(x => x !== i) : [...prev, i]))
    if (!jaSelecionada && selectedVendaIdx === null) {
      const d = duplicatasResult[i]
      const idx = d.venda ? vendasResult.findIndex(v => v.venda === d.venda) : -1
      if (idx !== -1) setSelectedVendaIdx(idx)
    }
  }

  function limparSelecao() {
    setSelectedVendaIdx(null)
    setSelectedDuplicataIdxs([])
  }

  function confirmarPar() {
    if (selectedVendaIdx === null || selectedDuplicataIdxs.length === 0) return
    const venda = vendasResult[selectedVendaIdx].venda
    const novosPares: ParConfirmado[] = selectedDuplicataIdxs.map(idx => {
      const duplicata = duplicatasResult[idx].duplicata
      return {
        duplicataNumero: duplicata.numero,
        cliente: duplicata.cliente,
        nsu: venda.nsu,
        autorizacao: venda.authorizationCode,
        parcelas: venda.installmentQuantity,
        modalidade: modalidadeLabel(venda.modality?.type),
        valor: duplicata.valor,
      }
    })
    const numeros = new Set(novosPares.map(p => p.duplicataNumero))
    setParesConfirmados(prev => [...prev.filter(p => !numeros.has(p.duplicataNumero)), ...novosPares])
    limparSelecao()
  }

  function removerPar(duplicataNumero: string) {
    setParesConfirmados(prev => prev.filter(p => p.duplicataNumero !== duplicataNumero))
  }

  async function copiarPar(p: ParConfirmado, idx: number) {
    await navigator.clipboard.writeText(formatarParaCopia(p))
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  const vendaSelecionada = selectedVendaIdx !== null ? vendasResult[selectedVendaIdx]?.venda : null
  const duplicatasSelecionadas = selectedDuplicataIdxs
    .map(i => duplicatasResult[i]?.duplicata)
    .filter((d): d is JjwDuplicata => !!d)
  const totalDuplicatasSelecionadas = duplicatasSelecionadas.reduce((acc, d) => acc + d.valor, 0)

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400 text-sm px-4 py-3 rounded-lg">
        Integração com a API do JJW (Besser Core) ainda não está configurada — as duplicatas abaixo são dados de
        exemplo só pra validar o layout. A conciliação por valor + data é uma heurística: hoje não existe um
        identificador comum (NSU/TID) entre a venda no cartão e a duplicata do JJW.
      </div>

      {duplicatasFiltradasPorValor && !loadingDuplicatas && (
        <div className="flex flex-wrap gap-4 text-sm">
          <Badge tone="green">{vinculadasCount} vinculada(s)</Badge>
          <Badge tone="red">{naoVinculadasCount} não vinculada(s)</Badge>
        </div>
      )}

      <p className="text-sm text-gray-400 dark:text-gray-500">
        Clique numa venda e em uma ou mais duplicatas pra selecionar o par e puxar os dados da baixa.
      </p>

      {(vendaSelecionada || duplicatasSelecionadas.length > 0) && (
        <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-sky-800 dark:text-sky-300">Dados para baixa</h3>
            <button type="button" onClick={limparSelecao} className="text-xs text-sky-700 dark:text-sky-400 hover:underline">Limpar seleção</button>
          </div>
          {vendaSelecionada && duplicatasSelecionadas.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500 dark:text-sky-400">NSU</p>
                  <p className="text-sm font-semibold text-sky-900 dark:text-sky-200 font-mono">{vendaSelecionada.nsu}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500 dark:text-sky-400">Autorização</p>
                  <p className="text-sm font-semibold text-sky-900 dark:text-sky-200 font-mono">{vendaSelecionada.authorizationCode}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500 dark:text-sky-400">Parcelas</p>
                  <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">{vendaSelecionada.installmentQuantity}x</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500 dark:text-sky-400">Modalidade</p>
                  <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">{modalidadeLabel(vendaSelecionada.modality?.type)}</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500 dark:text-sky-400 mb-1">
                  Duplicata(s) selecionada(s) — {duplicatasSelecionadas.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {duplicatasSelecionadas.map(d => (
                    <span key={d.numero} className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-sky-200 dark:border-sky-800 rounded-lg px-2.5 py-1 text-xs text-sky-900 dark:text-sky-200">
                      <span className="font-mono">{d.numero}</span>
                      <span className="text-sky-500 dark:text-sky-400">·</span>
                      <span>{formatBRL(d.valor)}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-sky-700 dark:text-sky-400">
                  Total das duplicatas: <span className="font-semibold text-sky-900 dark:text-sky-200">{formatBRL(totalDuplicatasSelecionadas)}</span>
                  {' '}· Valor da venda: <span className="font-semibold text-sky-900 dark:text-sky-200">{formatBRL(vendaSelecionada.amount)}</span>
                  {Math.abs(totalDuplicatasSelecionadas - vendaSelecionada.amount) > 0.05 && (
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                      {' '}· Diferença: {formatBRL(Math.abs(totalDuplicatasSelecionadas - vendaSelecionada.amount))}
                      {' '}({totalDuplicatasSelecionadas > vendaSelecionada.amount ? 'duplicatas maior que a venda' : 'venda maior que as duplicatas'})
                    </span>
                  )}
                </span>
                <Button type="button" onClick={confirmarPar}>Confirmar par</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-sky-700 dark:text-sky-400">
              {vendaSelecionada ? 'Agora selecione uma ou mais duplicatas correspondentes.' : 'Agora selecione a venda correspondente.'}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Vendas no cartão (Rede)</h3>

          <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Data inicial</label>
              <input type="date" value={startDateVendas} onChange={e => setStartDateVendas(e.target.value)} className={inputBase} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Data final</label>
              <input type="date" value={endDateVendas} onChange={e => setEndDateVendas(e.target.value)} className={inputBase} />
            </div>
            <EstablishmentPicker
              establishments={establishmentsVendas}
              selected={selectedPvsVendas}
              onToggle={togglePvVendas}
              onClear={() => setSelectedPvsVendas([])}
            />
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Valor bruto mínimo</label>
              <CurrencyInput
                value={minValorVendas}
                onChange={v => { setMinValorVendas(v); limparSelecao() }}
                className={inputBase + ' w-32'}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Valor bruto máximo</label>
              <CurrencyInput
                value={maxValorVendas}
                onChange={v => { setMaxValorVendas(v); limparSelecao() }}
                className={inputBase + ' w-32'}
              />
            </div>
            <Button type="button" onClick={buscarVendas} loading={loadingVendas}>
              {loadingVendas ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>

          {errorVendas && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg mb-4">{errorVendas}</div>
          )}

          {loadingVendas ? (
            <div className="flex items-center gap-3 text-sm text-gray-400 dark:text-gray-500">
              <Spinner size="md" />
              Consultando Rede...
            </div>
          ) : vendasFiltradasPorValor && vendasResult.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma venda encontrada no período.</p>
          ) : vendasFiltradasPorValor && (
            <TableCard>
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Data</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Bruto</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">NSU</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendasResult.map((v, i) => {
                      const vinculada = vendaNsusConfirmados.has(v.venda.nsu)
                      return (
                        <tr
                          key={`${v.venda.nsu}-${i}`}
                          onClick={() => selecionarVenda(i)}
                          title={vinculada ? 'Já vinculada a uma duplicata — remova o par pra liberar' : undefined}
                          className={cn(
                            'border-b border-gray-100 dark:border-gray-800 last:border-0',
                            vinculada
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/30',
                            !vinculada && selectedVendaIdx === i && 'bg-sky-100 dark:bg-sky-900/40 ring-1 ring-inset ring-sky-300 dark:ring-sky-700'
                          )}
                        >
                          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{v.venda.movementDate}</td>
                          <td className="px-3 py-2.5 text-right text-gray-900 dark:text-gray-100">{formatBRL(v.venda.amount)}</td>
                          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 font-mono">{v.venda.nsu}</td>
                          <td className="px-3 py-2.5">
                            {vinculada ? (
                              <Badge tone="green">Vinculada</Badge>
                            ) : v.status === null ? (
                              <span className="text-xs text-gray-400 dark:text-gray-500">Aguardando duplicatas…</span>
                            ) : (
                              <Badge tone="red">Não vinculada</Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Total ({vendasFiltradasPorValor.length})</span>
                <span className="text-gray-900 dark:text-gray-100">{formatBRL(totalVendas)}</span>
              </div>
            </TableCard>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Duplicatas em aberto (JJW)</h3>

          <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Vencimento inicial</label>
              <input type="date" value={startDateDuplicatas} onChange={e => setStartDateDuplicatas(e.target.value)} className={inputBase} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Vencimento final</label>
              <input type="date" value={endDateDuplicatas} onChange={e => setEndDateDuplicatas(e.target.value)} className={inputBase} />
            </div>
            <EstablishmentPicker
              establishments={establishmentsDuplicatas}
              selected={selectedPvsDuplicatas}
              onToggle={togglePvDuplicatas}
              onClear={() => setSelectedPvsDuplicatas([])}
            />
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Valor mínimo</label>
              <CurrencyInput
                value={minValorDuplicatas}
                onChange={v => { setMinValorDuplicatas(v); limparSelecao() }}
                className={inputBase + ' w-32'}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Valor máximo</label>
              <CurrencyInput
                value={maxValorDuplicatas}
                onChange={v => { setMaxValorDuplicatas(v); limparSelecao() }}
                className={inputBase + ' w-32'}
              />
            </div>
            <Button type="button" onClick={buscarDuplicatas} loading={loadingDuplicatas}>
              {loadingDuplicatas ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>

          {errorDuplicatas && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg mb-4">{errorDuplicatas}</div>
          )}

          {loadingDuplicatas ? (
            <div className="flex items-center gap-3 text-sm text-gray-400 dark:text-gray-500">
              <Spinner size="md" />
              Consultando JJW...
            </div>
          ) : duplicatasFiltradasPorValor && duplicatasResult.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma duplicata em aberto no período.</p>
          ) : duplicatasFiltradasPorValor && (
            <TableCard>
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Nº</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Vencimento</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Valor</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Cliente</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicatasResult.map((d, i) => {
                      const vinculada = duplicataNumerosConfirmados.has(d.duplicata.numero)
                      return (
                        <tr
                          key={`${d.duplicata.numero}-${i}`}
                          onClick={() => selecionarDuplicata(i)}
                          title={vinculada ? 'Já vinculada a uma venda — remova o par pra liberar' : undefined}
                          className={cn(
                            'border-b border-gray-100 dark:border-gray-800 last:border-0',
                            vinculada
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/30',
                            !vinculada && selectedDuplicataIdxs.includes(i) && 'bg-sky-100 dark:bg-sky-900/40 ring-1 ring-inset ring-sky-300 dark:ring-sky-700'
                          )}
                        >
                          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 font-mono">{d.duplicata.numero}</td>
                          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{d.duplicata.dataVencimento}</td>
                          <td className="px-3 py-2.5 text-right text-gray-900 dark:text-gray-100">{formatBRL(d.duplicata.valor)}</td>
                          <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 truncate max-w-[160px]">{d.duplicata.cliente}</td>
                          <td className="px-3 py-2.5">
                            {vinculada ? (
                              <Badge tone="green">Vinculada</Badge>
                            ) : d.status === null ? (
                              <span className="text-xs text-gray-400 dark:text-gray-500">Aguardando vendas…</span>
                            ) : (
                              <Badge tone="red">Não vinculada</Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Total ({duplicatasFiltradasPorValor.length})</span>
                <span className="text-gray-900 dark:text-gray-100">{formatBRL(totalDuplicatas)}</span>
              </div>
            </TableCard>
          )}
        </div>
      </div>

      {paresConfirmados.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Pares prontos para baixa ({paresConfirmados.length})</h3>
          <TableCard>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Duplicata</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">NSU</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Autorização</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Parcelas</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Modalidade</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Valor</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {paresConfirmados.map((p, i) => (
                    <tr key={p.duplicataNumero} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 font-mono">{p.duplicataNumero}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 truncate max-w-[160px]">{p.cliente}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 font-mono">{p.nsu}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 font-mono">{p.autorizacao}</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{p.parcelas}x</td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{p.modalidade}</td>
                      <td className="px-3 py-2.5 text-right text-gray-900 dark:text-gray-100">{formatBRL(p.valor)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button type="button" onClick={() => copiarPar(p, i)} className="text-xs text-brand-navy dark:text-blue-300 hover:underline mr-3">
                          {copiedIdx === i ? 'Copiado!' : 'Copiar'}
                        </button>
                        <button type="button" onClick={() => removerPar(p.duplicataNumero)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCard>
        </div>
      )}
    </div>
  )
}
