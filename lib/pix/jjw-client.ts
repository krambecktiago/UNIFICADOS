import { pixConfig } from './config'

export interface JjwReceivableDto {
  id: string
  numero?: string
  cpfCnpjPagador?: string
  nomePagador?: string
  valor: number
  dataVencimento?: string
  status: string
  descricao?: string
}

export interface JjwBaixaRequest {
  dataPagamento: string
  valorPagamento: number
  formaPagamento: 'PIX'
  endToEndId: string
  infoPagador?: string | null
  pagadorNome?: string | null
  pagadorCpfCnpj?: string | null
}

function jjwHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    // Assume header X-API-Key — confirme com o time do ERP JJW qual é o
    // esquema real de autenticação (pode ser Authorization: Bearer, etc.)
    'X-API-Key': pixConfig.jjwErpApiKey,
  }
}

// Retry simplificado: até 2 tentativas, sem backoff (chamada de HTTP em
// função serverless com orçamento de tempo curto), só reintenta erro de
// rede/timeout/5xx — nunca em 4xx (rejeição de negócio não muda tentando de novo).
async function jjwFetch(path: string, init: RequestInit): Promise<Response> {
  let lastError: unknown

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${pixConfig.jjwErpBaseUrl}${path}`, {
        ...init,
        headers: { ...jjwHeaders(), ...(init.headers as Record<string, string> | undefined) },
        signal: AbortSignal.timeout(9000),
      })

      if (res.status >= 500 && attempt < 2) {
        lastError = new Error(`JJW ERP retornou ${res.status}`)
        continue
      }

      return res
    } catch (err) {
      lastError = err
      if (attempt >= 2) throw err
    }
  }

  throw lastError
}

export async function findOpenReceivables(cpfCnpj: string, valorAproximado: number): Promise<JjwReceivableDto[]> {
  const query = new URLSearchParams({
    cpfCnpj,
    valorApx: String(valorAproximado),
    status: 'ABERTO',
  })

  const res = await jjwFetch(`/api/titulos?${query.toString()}`, { method: 'GET' })
  if (!res.ok) throw new Error(`Falha ao buscar títulos abertos: ${res.status}`)
  return res.json() as Promise<JjwReceivableDto[]>
}

export async function findReceivableById(tituloId: string): Promise<JjwReceivableDto | null> {
  const res = await jjwFetch(`/api/titulos/${encodeURIComponent(tituloId)}`, { method: 'GET' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Falha ao buscar título ${tituloId}: ${res.status}`)
  return res.json() as Promise<JjwReceivableDto>
}

export async function baixarTitulo(tituloId: string, request: JjwBaixaRequest): Promise<string> {
  const res = await jjwFetch(`/api/titulos/${encodeURIComponent(tituloId)}/baixar`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
  if (!res.ok) throw new Error(`Falha ao dar baixa no título ${tituloId}: ${res.status} ${await res.text()}`)
  return res.text()
}
