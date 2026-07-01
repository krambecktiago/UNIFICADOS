function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

export const pixConfig = {
  bradescoBaseUrl: process.env.BRADESCO_BASE_URL ?? 'https://proxy.api.prebanco.com.br',
  bradescoClientId: process.env.BRADESCO_CLIENT_ID ?? '',
  bradescoClientSecret: process.env.BRADESCO_CLIENT_SECRET ?? '',
  bradescoChavePix: process.env.BRADESCO_CHAVE_PIX ?? '',
  bradescoCertP12Base64: process.env.BRADESCO_CERT_P12_BASE64 ?? '',
  bradescoCertPassword: process.env.BRADESCO_CERT_PASSWORD ?? '',
  jjwErpBaseUrl: process.env.JJW_ERP_BASE_URL ?? '',
  jjwErpApiKey: process.env.JJW_ERP_API_KEY ?? '',
  matchTolerancePct: envInt('PIX_MATCH_TOLERANCE_PCT', 2),
  matchToleranceDays: envInt('PIX_MATCH_TOLERANCE_DAYS', 30),
  lookbackMinutes: envInt('PIX_LOOKBACK_MINUTES', 30),
  reconcileBatchLimit: envInt('PIX_RECONCILE_BATCH_LIMIT', 20),
  staleReconcilingMinutes: envInt('PIX_STALE_RECONCILING_MINUTES', 5),
  cronSecret: process.env.PIX_CRON_SECRET ?? '',
  webhookToken: process.env.PIX_WEBHOOK_TOKEN ?? '',
}
