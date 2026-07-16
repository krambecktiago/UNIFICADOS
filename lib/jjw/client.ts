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
// assinatura (startDate/endDate/companyNumbers) pra trocar sem mexer na UI.
// https://jjw.stoplight.io/docs/besser-core
export async function fetchJjwDuplicatasAberto(
  startDate: string,
  endDate: string,
  companyNumbers?: string[]
): Promise<JjwDuplicata[]> {
  const establishments = await getRedeEstablishments().catch(() => [])
  const targets = companyNumbers?.length
    ? establishments.filter(e => companyNumbers.includes(e.companyNumber))
    : establishments

  if (targets.length === 0) return []

  const start = new Date(startDate)
  const end = new Date(endDate)
  const spanDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000))

  // Gera 2 duplicatas de exemplo por estabelecimento, espalhadas no período
  // consultado — só pra validar o layout até a integração real existir.
  const mock: JjwDuplicata[] = []
  targets.forEach((e, i) => {
    ;[0, Math.min(spanDays, 1)].forEach((offset, j) => {
      const emissao = new Date(start.getTime() + offset * 86_400_000)
      const vencimento = new Date(emissao.getTime() + 30 * 86_400_000)
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
