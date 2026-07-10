import { createAdminClient } from '@/lib/supabase/admin'

const REDE_BASE_URL = 'https://api.userede.com.br/redelabs'

interface RedeCredentials {
  clientId: string
  clientSecret: string
  companyNumber: string
}

export interface RedeTransaction {
  status: string
  nsu: number
  authorizationCode: number
  tid?: string
  amount: number
  netAmount: number
  feeTotal: number
  mdrAmount: number
  mdrFee: number
  discountAmount: number
  installmentQuantity: number
  captureType: string
  deviceType?: string
  device?: string
  cardNumber: string
  brandCode: number
  saleDate?: string
  movementDate: string
  saleHour?: string
  modality: {
    type: string
    product: string
  }
}

function parseRedeCredentials(value: string): RedeCredentials {
  try {
    const parsed = JSON.parse(value) as Partial<RedeCredentials>
    if (!parsed.clientId || !parsed.clientSecret || !parsed.companyNumber) {
      throw new Error('missing fields')
    }
    return parsed as RedeCredentials
  } catch {
    throw new Error('Credenciais da Rede mal formatadas — esperado JSON com clientId, clientSecret e companyNumber.')
  }
}

async function getRedeCredentials(): Promise<RedeCredentials> {
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('integrations')
    .select('value')
    .eq('slug', 'rede-producao')
    .maybeSingle()

  if (error || !data?.value) {
    throw new Error('Conexão "Rede — API Produção (Extrato)" não configurada em Administração → Conexões.')
  }

  return parseRedeCredentials(data.value)
}

// Usado pelo botão "Testar" em Administração → Conexões — só valida que o
// client_id/client_secret geram um token, sem consultar vendas.
export async function testRedeConnection(value: string): Promise<void> {
  const credentials = parseRedeCredentials(value)
  await getRedeToken(credentials)
}

async function getRedeToken(credentials: RedeCredentials): Promise<string> {
  const basicAuth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')

  const res = await fetch(`${REDE_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    throw new Error(`Falha ao gerar token da Rede (status ${res.status}).`)
  }

  const data = await res.json() as { access_token?: string }
  if (!data.access_token) throw new Error('Resposta de token da Rede sem access_token.')
  return data.access_token
}

// startDate/endDate no formato "yyyy-mm-dd".
export async function fetchRedeSales(startDate: string, endDate: string): Promise<RedeTransaction[]> {
  const credentials = await getRedeCredentials()
  const token = await getRedeToken(credentials)

  const params = new URLSearchParams({
    parentCompanyNumber: credentials.companyNumber,
    subsidiaries: credentials.companyNumber,
    startDate,
    endDate,
  })

  const res = await fetch(`${REDE_BASE_URL}/merchant-statement/v1/sales?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Falha ao consultar extrato da Rede (status ${res.status}).`)
  }

  const data = await res.json() as { content?: { transactions?: RedeTransaction[] } }
  return data.content?.transactions ?? []
}
