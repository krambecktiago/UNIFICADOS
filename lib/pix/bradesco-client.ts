import https from 'node:https'
import { URL } from 'node:url'
import { pixConfig } from './config'

interface BradescoRequestOptions {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
}

interface BradescoResponse {
  status: number
  body: string
}

// Agente https com certificado mTLS (.p12), se configurado. Reutilizar o
// mesmo Agent entre chamadas é só otimização de pool de conexão — não guarda
// nenhum estado sensível a expiração (diferente do token OAuth2).
let cachedAgent: https.Agent | undefined | null = null

function getBradescoAgent(): https.Agent | undefined {
  if (cachedAgent !== null) return cachedAgent ?? undefined
  if (!pixConfig.bradescoCertP12Base64) {
    cachedAgent = undefined
    return undefined
  }
  cachedAgent = new https.Agent({
    pfx: Buffer.from(pixConfig.bradescoCertP12Base64, 'base64'),
    passphrase: pixConfig.bradescoCertPassword || undefined,
  })
  return cachedAgent
}

export function bradescoRequest(pathWithQuery: string, options: BradescoRequestOptions = {}): Promise<BradescoResponse> {
  const url = new URL(pathWithQuery, pixConfig.bradescoBaseUrl)

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: options.method ?? 'GET',
        headers: options.headers,
        agent: getBradescoAgent(),
        timeout: 9000,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
      }
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('Timeout na chamada ao Bradesco')))
    if (options.body) req.write(options.body)
    req.end()
  })
}

interface BradescoPagador {
  cpf?: string
  cnpj?: string
  nome?: string
}

export interface BradescoPixItem {
  endToEndId: string
  txid?: string
  valor: number
  chave: string
  horario: string
  infoPagador?: string
  pagador?: BradescoPagador
}

interface BradescoPixResponse {
  pix?: BradescoPixItem[]
  parametros?: {
    paginacao?: {
      paginaAtual: number
      quantidadeDePaginas: number
    }
  }
}

function hasMorePages(response: BradescoPixResponse): boolean {
  const paginacao = response.parametros?.paginacao
  if (!paginacao) return false
  return paginacao.paginaAtual < paginacao.quantidadeDePaginas - 1
}

export async function fetchReceivedPix(
  accessToken: string,
  inicio: Date,
  fim: Date
): Promise<BradescoPixItem[]> {
  const items: BradescoPixItem[] = []
  let page = 0

  while (true) {
    const query = new URLSearchParams({
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      status: 'CONCLUIDA',
      'paginacao.paginaAtual': String(page),
      'paginacao.itensPorPagina': '100',
    })

    const { status, body } = await bradescoRequest(`/pix/v2/pix?${query.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (status !== 200) {
      throw new Error(`Falha ao buscar PIX no Bradesco: ${status} ${body}`)
    }

    const parsed = JSON.parse(body) as BradescoPixResponse
    items.push(...(parsed.pix ?? []))

    if (!hasMorePages(parsed)) break
    page += 1
  }

  return items
}

export function pagadorCpfCnpj(item: BradescoPixItem): string | null {
  return item.pagador?.cpf || item.pagador?.cnpj || null
}
