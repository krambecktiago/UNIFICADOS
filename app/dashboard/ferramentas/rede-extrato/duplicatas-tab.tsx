'use client'

import { useEffect, useRef, useState } from 'react'
import { TableCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
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
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Estabelecimento</label>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={inputBase + ' text-left flex items-center justify-between gap-2 min-w-[200px]'}
      >
        <span className="truncate">{label()}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full min-w-[240px] bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
          <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={selected.length === 0} onChange={onClear} className="rounded border-gray-300" />
            Todos os estabelecimentos
          </label>
          <div className="border-t border-gray-100 my-1" />
          {establishments.map(e => (
            <label key={e.companyNumber} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selected.includes(e.companyNumber)} onChange={() => onToggle(e.companyNumber)} className="rounded border-gray-300" />
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
  const [vendas, setVendas] = useState<RedeTransaction[] | null>(null)
  const [loadingVendas, setLoadingVendas] = useState(false)
  const [errorVendas, setErrorVendas] = useState('')

  // Filtro do lado "Duplicatas em aberto (JJW)" — independente do de vendas
  const [startDateDuplicatas, setStartDateDuplicatas] = useState(todayISO(-1))
  const [endDateDuplicatas, setEndDateDuplicatas] = useState(todayISO(-1))
  const [establishmentsDuplicatas, setEstablishmentsDuplicatas] = useState<RedeEstablishment[]>([])
  const [selectedPvsDuplicatas, setSelectedPvsDuplicatas] = useState<string[]>([])
  const [duplicatas, setDuplicatas] = useState<JjwDuplicata[] | null>(null)
  const [loadingDuplicatas, setLoadingDuplicatas] = useState(false)
  const [errorDuplicatas, setErrorDuplicatas] = useState('')

  // Seleção manual do par venda + duplicata pra puxar os dados da baixa
  const [selectedVendaIdx, setSelectedVendaIdx] = useState<number | null>(null)
  const [selectedDuplicataIdx, setSelectedDuplicataIdx] = useState<number | null>(null)
  const [paresConfirmados, setParesConfirmados] = useState<ParConfirmado[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

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
    setSelectedDuplicataIdx(null)
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

  useEffect(() => {
    buscarVendas()
    buscarDuplicatas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cada coluna mostra o que já tem assim que chega — a conciliação (que
  // precisa dos dois lados) só entra depois, sem travar quem carregou primeiro.
  const conciliacao = vendas && duplicatas ? conciliarDuplicatas(duplicatas, vendas) : null

  const vendasResult: { venda: RedeTransaction; duplicata: JjwDuplicata | null; status: VendaStatus | null }[] =
    conciliacao ? conciliacao.vendasResult : (vendas ?? []).map(v => ({ venda: v, duplicata: null, status: null }))

  const duplicatasResult: { duplicata: JjwDuplicata; venda: RedeTransaction | null; status: DuplicataStatus | null }[] =
    conciliacao ? conciliacao.duplicatasResult : (duplicatas ?? []).map(d => ({ duplicata: d, venda: null, status: null }))

  const conciliadoCount = duplicatasResult.filter(d => d.status === 'conciliado').length
  const divergenteCount = duplicatasResult.filter(d => d.status === 'divergente').length
  const semVendaCount = duplicatasResult.filter(d => d.status === 'sem_venda').length

  const totalVendas = (vendas ?? []).reduce((acc, t) => acc + t.amount, 0)
  const totalDuplicatas = (duplicatas ?? []).reduce((acc, d) => acc + d.valor, 0)

  function selecionarVenda(i: number) {
    setSelectedVendaIdx(i)
  }

  // Clicar numa duplicata já pré-seleciona a venda casada pela heurística
  // (quando existe) — o usuário ainda pode clicar em outra venda pra trocar.
  function selecionarDuplicata(i: number) {
    setSelectedDuplicataIdx(i)
    const d = duplicatasResult[i]
    const idx = d.venda ? vendasResult.findIndex(v => v.venda === d.venda) : -1
    setSelectedVendaIdx(idx !== -1 ? idx : null)
  }

  function limparSelecao() {
    setSelectedVendaIdx(null)
    setSelectedDuplicataIdx(null)
  }

  function confirmarPar() {
    if (selectedVendaIdx === null || selectedDuplicataIdx === null) return
    const venda = vendasResult[selectedVendaIdx].venda
    const duplicata = duplicatasResult[selectedDuplicataIdx].duplicata
    const par: ParConfirmado = {
      duplicataNumero: duplicata.numero,
      cliente: duplicata.cliente,
      nsu: venda.nsu,
      autorizacao: venda.authorizationCode,
      parcelas: venda.installmentQuantity,
      modalidade: modalidadeLabel(venda.modality?.type),
      valor: venda.amount,
    }
    setParesConfirmados(prev => [...prev.filter(p => p.duplicataNumero !== par.duplicataNumero), par])
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
  const duplicataSelecionada = selectedDuplicataIdx !== null ? duplicatasResult[selectedDuplicataIdx]?.duplicata : null

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg">
        Integração com a API do JJW (Besser Core) ainda não está configurada — as duplicatas abaixo são dados de
        exemplo só pra validar o layout. A conciliação por valor + data é uma heurística: hoje não existe um
        identificador comum (NSU/TID) entre a venda no cartão e a duplicata do JJW.
      </div>

      {vendas && duplicatas && !loadingVendas && !loadingDuplicatas && (
        <div className="flex flex-wrap gap-4 text-sm">
          <Badge tone="green">{conciliadoCount} conciliada(s)</Badge>
          <Badge tone="amber">{divergenteCount} divergente(s)</Badge>
          <Badge tone="gray">{semVendaCount} sem venda no cartão</Badge>
        </div>
      )}

      <p className="text-sm text-gray-400">
        Clique numa venda e numa duplicata pra selecionar o par e puxar os dados da baixa.
      </p>

      {(vendaSelecionada || duplicataSelecionada) && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-sky-800">Dados para baixa</h3>
            <button type="button" onClick={limparSelecao} className="text-xs text-sky-700 hover:underline">Limpar seleção</button>
          </div>
          {vendaSelecionada && duplicataSelecionada ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500">Duplicata</p>
                <p className="text-sm font-semibold text-sky-900">{duplicataSelecionada.numero}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500">NSU</p>
                <p className="text-sm font-semibold text-sky-900 font-mono">{vendaSelecionada.nsu}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500">Autorização</p>
                <p className="text-sm font-semibold text-sky-900 font-mono">{vendaSelecionada.authorizationCode}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500">Parcelas</p>
                <p className="text-sm font-semibold text-sky-900">{vendaSelecionada.installmentQuantity}x</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500">Modalidade</p>
                <p className="text-sm font-semibold text-sky-900">{modalidadeLabel(vendaSelecionada.modality?.type)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500">Valor</p>
                <p className="text-sm font-semibold text-sky-900">{formatBRL(vendaSelecionada.amount)}</p>
              </div>
              <div className="col-span-2 sm:col-span-5">
                <Button type="button" onClick={confirmarPar}>Confirmar par</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-sky-700">
              {vendaSelecionada ? 'Agora selecione a duplicata correspondente.' : 'Agora selecione a venda correspondente.'}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Vendas no cartão (Rede)</h3>

          <div className="bg-white rounded-xl p-5 border border-gray-200 flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Data inicial</label>
              <input type="date" value={startDateVendas} onChange={e => setStartDateVendas(e.target.value)} className={inputBase} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Data final</label>
              <input type="date" value={endDateVendas} onChange={e => setEndDateVendas(e.target.value)} className={inputBase} />
            </div>
            <EstablishmentPicker
              establishments={establishmentsVendas}
              selected={selectedPvsVendas}
              onToggle={togglePvVendas}
              onClear={() => setSelectedPvsVendas([])}
            />
            <Button type="button" onClick={buscarVendas} loading={loadingVendas}>
              {loadingVendas ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>

          {errorVendas && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{errorVendas}</div>
          )}

          {loadingVendas ? (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <Spinner size="md" />
              Consultando Rede...
            </div>
          ) : vendas && vendasResult.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma venda encontrada no período.</p>
          ) : vendas && (
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
                      <tr
                        key={`${v.venda.nsu}-${i}`}
                        onClick={() => selecionarVenda(i)}
                        className={cn(
                          'border-b border-gray-100 last:border-0 cursor-pointer hover:bg-sky-50',
                          selectedVendaIdx === i && 'bg-sky-100 ring-1 ring-inset ring-sky-300'
                        )}
                      >
                        <td className="px-3 py-2.5 text-gray-700">{v.venda.movementDate}</td>
                        <td className="px-3 py-2.5 text-right text-gray-900">{formatBRL(v.venda.amount)}</td>
                        <td className="px-3 py-2.5 text-gray-700 font-mono">{v.venda.nsu}</td>
                        <td className="px-3 py-2.5">
                          {v.status ? (
                            <Badge tone={VENDA_STATUS_TONE[v.status]}>{VENDA_STATUS_LABEL[v.status]}</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">Aguardando duplicatas…</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 border-t-2 border-gray-200 bg-gray-50 text-sm font-semibold">
                <span className="text-gray-700">Total ({vendas.length})</span>
                <span className="text-gray-900">{formatBRL(totalVendas)}</span>
              </div>
            </TableCard>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Duplicatas em aberto (JJW)</h3>

          <div className="bg-white rounded-xl p-5 border border-gray-200 flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Vencimento inicial</label>
              <input type="date" value={startDateDuplicatas} onChange={e => setStartDateDuplicatas(e.target.value)} className={inputBase} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Vencimento final</label>
              <input type="date" value={endDateDuplicatas} onChange={e => setEndDateDuplicatas(e.target.value)} className={inputBase} />
            </div>
            <EstablishmentPicker
              establishments={establishmentsDuplicatas}
              selected={selectedPvsDuplicatas}
              onToggle={togglePvDuplicatas}
              onClear={() => setSelectedPvsDuplicatas([])}
            />
            <Button type="button" onClick={buscarDuplicatas} loading={loadingDuplicatas}>
              {loadingDuplicatas ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>

          {errorDuplicatas && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{errorDuplicatas}</div>
          )}

          {loadingDuplicatas ? (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <Spinner size="md" />
              Consultando JJW...
            </div>
          ) : duplicatas && duplicatasResult.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma duplicata em aberto no período.</p>
          ) : duplicatas && (
            <TableCard>
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Nº</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Vencimento</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Valor</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Cliente</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicatasResult.map((d, i) => (
                      <tr
                        key={`${d.duplicata.numero}-${i}`}
                        onClick={() => selecionarDuplicata(i)}
                        className={cn(
                          'border-b border-gray-100 last:border-0 cursor-pointer hover:bg-sky-50',
                          selectedDuplicataIdx === i && 'bg-sky-100 ring-1 ring-inset ring-sky-300'
                        )}
                      >
                        <td className="px-3 py-2.5 text-gray-700 font-mono">{d.duplicata.numero}</td>
                        <td className="px-3 py-2.5 text-gray-700">{d.duplicata.dataVencimento}</td>
                        <td className="px-3 py-2.5 text-right text-gray-900">{formatBRL(d.duplicata.valor)}</td>
                        <td className="px-3 py-2.5 text-gray-700 truncate max-w-[160px]">{d.duplicata.cliente}</td>
                        <td className="px-3 py-2.5">
                          {d.status ? (
                            <Badge tone={DUPLICATA_STATUS_TONE[d.status]}>{DUPLICATA_STATUS_LABEL[d.status]}</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">Aguardando vendas…</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 border-t-2 border-gray-200 bg-gray-50 text-sm font-semibold">
                <span className="text-gray-700">Total ({duplicatas.length})</span>
                <span className="text-gray-900">{formatBRL(totalDuplicatas)}</span>
              </div>
            </TableCard>
          )}
        </div>
      </div>

      {paresConfirmados.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Pares prontos para baixa ({paresConfirmados.length})</h3>
          <TableCard>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Duplicata</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">NSU</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Autorização</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Parcelas</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Modalidade</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Valor</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {paresConfirmados.map((p, i) => (
                    <tr key={p.duplicataNumero} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2.5 text-gray-700 font-mono">{p.duplicataNumero}</td>
                      <td className="px-3 py-2.5 text-gray-700 truncate max-w-[160px]">{p.cliente}</td>
                      <td className="px-3 py-2.5 text-gray-700 font-mono">{p.nsu}</td>
                      <td className="px-3 py-2.5 text-gray-700 font-mono">{p.autorizacao}</td>
                      <td className="px-3 py-2.5 text-gray-700">{p.parcelas}x</td>
                      <td className="px-3 py-2.5 text-gray-700">{p.modalidade}</td>
                      <td className="px-3 py-2.5 text-right text-gray-900">{formatBRL(p.valor)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button type="button" onClick={() => copiarPar(p, i)} className="text-xs text-brand-navy hover:underline mr-3">
                          {copiedIdx === i ? 'Copiado!' : 'Copiar'}
                        </button>
                        <button type="button" onClick={() => removerPar(p.duplicataNumero)} className="text-xs text-red-600 hover:underline">
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
