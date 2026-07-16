import type { JjwDuplicata } from '@/lib/jjw/client'
import type { RedeTransaction } from '@/lib/rede/client'

export type DuplicataStatus = 'conciliado' | 'divergente' | 'sem_venda'
export type VendaStatus = 'conciliado' | 'divergente' | 'sem_duplicata'

export interface DuplicataConciliada {
  duplicata: JjwDuplicata
  venda: RedeTransaction | null
  status: DuplicataStatus
}

export interface VendaConciliada {
  venda: RedeTransaction
  duplicata: JjwDuplicata | null
  status: VendaStatus
}

const DIAS_TOLERANCIA_ESTREITA = 3
const DIAS_TOLERANCIA_AMPLA = 7
const VALOR_TOLERANCIA_ESTREITA = 0.05

function diffDias(a: string, b: string): number {
  const ta = new Date(a).getTime()
  const tb = new Date(b).getTime()
  return Math.abs(ta - tb) / 86_400_000
}

function toleranciaAmplaValor(valor: number): number {
  return Math.max(1, valor * 0.05)
}

// Casa cada duplicata em aberto (JJW) com a venda de cartão (Rede) mais
// próxima por valor + data de emissão. Sem chave forte em comum (NSU/TID não
// existe do lado do JJW ainda) — é heurística até a API real trazer um
// identificador melhor pra cruzar.
export function conciliarDuplicatas(
  duplicatas: JjwDuplicata[],
  vendas: RedeTransaction[]
): { duplicatasResult: DuplicataConciliada[]; vendasResult: VendaConciliada[] } {
  const vendaUsada = new Array(vendas.length).fill(false)
  const vendaParaDuplicata = new Map<number, { duplicata: JjwDuplicata; status: DuplicataStatus }>()

  const duplicatasResult: DuplicataConciliada[] = duplicatas.map(duplicata => {
    let melhorIdx = -1
    let melhorScore = Infinity
    let melhorDentroDaAmpla = false

    vendas.forEach((venda, idx) => {
      if (vendaUsada[idx]) return
      const dDias = diffDias(duplicata.dataEmissao, venda.movementDate)
      const dValor = Math.abs(duplicata.valor - venda.amount)
      const dentroDaAmpla = dDias <= DIAS_TOLERANCIA_AMPLA && dValor <= toleranciaAmplaValor(duplicata.valor)
      if (!dentroDaAmpla) return
      const score = dDias + dValor * 0.1
      if (score < melhorScore) {
        melhorScore = score
        melhorIdx = idx
        melhorDentroDaAmpla = dentroDaAmpla
      }
    })

    if (melhorIdx === -1 || !melhorDentroDaAmpla) {
      return { duplicata, venda: null, status: 'sem_venda' as const }
    }

    vendaUsada[melhorIdx] = true
    const venda = vendas[melhorIdx]
    const dDias = diffDias(duplicata.dataEmissao, venda.movementDate)
    const dValor = Math.abs(duplicata.valor - venda.amount)
    const status: DuplicataStatus =
      dDias <= DIAS_TOLERANCIA_ESTREITA && dValor <= VALOR_TOLERANCIA_ESTREITA ? 'conciliado' : 'divergente'
    vendaParaDuplicata.set(melhorIdx, { duplicata, status })
    return { duplicata, venda, status }
  })

  const vendasResult: VendaConciliada[] = vendas.map((venda, idx) => {
    const match = vendaParaDuplicata.get(idx)
    if (!match) return { venda, duplicata: null, status: 'sem_duplicata' as const }
    return { venda, duplicata: match.duplicata, status: match.status === 'conciliado' ? 'conciliado' : 'divergente' }
  })

  return { duplicatasResult, vendasResult }
}
