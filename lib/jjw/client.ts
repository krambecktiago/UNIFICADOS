import { getRedeEstablishments } from '@/lib/rede/client'

export interface JjwDuplicata {
  numero: string
  companyNumber: string
  companyName?: string
  cliente: string
  valor: number
  dataEmissao: string
  dataVencimento: string
  formaPagamento: string
  status: 'ABERTO'
}

// TODO: substituir por chamada real assim que a API do JJW (Besser Core)
// estiver disponível — client_id/secret ainda não existem. Mantém a mesma
// assinatura (companyNumbers) pra trocar sem mexer na UI.
// https://jjw.stoplight.io/docs/besser-core
// startDate/endDate aqui são o período de VENCIMENTO da duplicata, não de
// emissão — é o que faz sentido pra quem consulta "duplicatas em aberto".
export async function fetchJjwDuplicatasAberto(
  vencimentoStart: string,
  vencimentoEnd: string,
  companyNumbers?: string[]
): Promise<JjwDuplicata[]> {
  const establishments = await getRedeEstablishments().catch(() => [])
  const targets = companyNumbers?.length
    ? establishments.filter(e => companyNumbers.includes(e.companyNumber))
    : establishments

  if (targets.length === 0) return []

  const start = new Date(vencimentoStart)
  const end = new Date(vencimentoEnd)
  const spanDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000))

  // Gera 2 duplicatas de exemplo por estabelecimento, com vencimento
  // espalhado no período consultado — só pra validar o layout até a
  // integração real existir. Emissão fica 30 dias antes do vencimento
  // (prazo padrão), refletindo aproximadamente a data da venda no cartão.
  const mock: JjwDuplicata[] = []
  targets.forEach((e, i) => {
    ;[0, Math.min(spanDays, 1)].forEach((offset, j) => {
      const vencimento = new Date(start.getTime() + offset * 86_400_000)
      const emissao = new Date(vencimento.getTime() - 30 * 86_400_000)
      mock.push({
        numero: `MOCK-${e.companyNumber}-${j + 1}`,
        companyNumber: e.companyNumber,
        companyName: e.name,
        cliente: `Cliente exemplo ${i + 1}.${j + 1}`,
        valor: 150 + i * 37.5 + j * 12.9,
        dataEmissao: emissao.toISOString().slice(0, 10),
        dataVencimento: vencimento.toISOString().slice(0, 10),
        formaPagamento: 'Cartão de Crédito',
        status: 'ABERTO',
      })
    })
  })

  return mock
}
