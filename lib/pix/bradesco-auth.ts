import { pixConfig } from './config'
import { bradescoRequest } from './bradesco-client'

interface BradescoTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

// Sem cache em memória: em serverless o cache de módulo não é confiável
// entre invocações concorrentes/frias, e refresh-on-401 seria necessário
// de todo jeito — busca um token novo a cada chamada.
export async function getBradescoAccessToken(): Promise<string> {
  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: pixConfig.bradescoClientId,
    client_secret: pixConfig.bradescoClientSecret,
    scope: 'pix.read webhook.read webhook.write',
  })

  const { status, body } = await bradescoRequest('/auth/server/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })

  if (status !== 200) {
    throw new Error(`Falha ao obter token Bradesco: ${status} ${body}`)
  }

  const data = JSON.parse(body) as BradescoTokenResponse
  return data.access_token
}
