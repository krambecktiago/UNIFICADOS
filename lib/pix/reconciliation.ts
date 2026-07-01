import { createAdminClient } from '@/lib/supabase/admin'
import { pixConfig } from './config'
import { findOpenReceivables, findReceivableById, baixarTitulo, type JjwReceivableDto, type JjwBaixaRequest } from './jjw-client'

type AdminClient = ReturnType<typeof createAdminClient>

export interface PixTransactionRow {
  id: string
  end_to_end_id: string
  valor: number
  pagador_cpf_cnpj: string | null
  pagador_nome: string | null
  data_hora_pagamento: string
  info_pagador: string | null
  status: string
}

export async function log(
  supabase: AdminClient,
  pixTransactionId: string,
  action: string,
  detail: string,
  performedBy: string
) {
  await supabase.from('pix_reconciliation_log').insert({
    pix_transaction_id: pixTransactionId,
    action,
    detail,
    performed_by: performedBy,
  })
}

// Reivindicação atômica: só uma execução concorrente (webhook x cron) consegue
// mover a linha de RECEIVED para RECONCILING. A segunda tentativa não encontra
// a linha mais (status já mudou) e desiste sem chamar o ERP — evita baixa duplicada.
async function claimForReconciliation(supabase: AdminClient, id: string): Promise<PixTransactionRow | null> {
  const { data, error } = await supabase
    .from('pix_transactions')
    .update({ status: 'RECONCILING', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'RECEIVED')
    .select()
    .maybeSingle()

  if (error) throw new Error(`Falha ao reivindicar PIX ${id}: ${error.message}`)
  return data
}

export function isValueMatch(pixValor: number, tituloValor: number, tolerancePct: number): boolean {
  if (!tituloValor) return false
  const diff = Math.abs(pixValor - tituloValor)
  const tolerance = tituloValor * (tolerancePct / 100)
  return diff <= tolerance
}

export function isDateMatch(pagamento: Date, dataVencimento: string | null | undefined, toleranceDays: number): boolean {
  if (!dataVencimento) return true
  const vencimento = new Date(`${dataVencimento}T00:00:00-03:00`)
  if (Number.isNaN(vencimento.getTime())) return true
  const daysDiff = Math.abs((pagamento.getTime() - vencimento.getTime()) / 86_400_000)
  return daysDiff <= toleranceDays
}

async function findBestMatch(pix: PixTransactionRow): Promise<JjwReceivableDto | null> {
  const tolerancePct = pixConfig.matchTolerancePct
  const toleranceDays = pixConfig.matchToleranceDays

  // Estratégia 1: CPF/CNPJ + valor (tolerância %) + vencimento (tolerância dias)
  if (pix.pagador_cpf_cnpj) {
    const candidates = await findOpenReceivables(pix.pagador_cpf_cnpj, pix.valor)
    const match = candidates.find(
      t =>
        isValueMatch(pix.valor, t.valor, tolerancePct) &&
        isDateMatch(new Date(pix.data_hora_pagamento), t.dataVencimento, toleranceDays)
    )
    if (match) return match
  }

  // Estratégia 2: infoPagador contém o ID do título diretamente
  if (pix.info_pagador?.trim()) {
    const byId = await findReceivableById(pix.info_pagador.trim())
    if (byId && byId.status === 'ABERTO') return byId
  }

  return null
}

export function buildBaixaRequest(pix: PixTransactionRow): JjwBaixaRequest {
  return {
    dataPagamento: pix.data_hora_pagamento.slice(0, 10),
    valorPagamento: pix.valor,
    formaPagamento: 'PIX',
    endToEndId: pix.end_to_end_id,
    infoPagador: pix.info_pagador,
    pagadorNome: pix.pagador_nome,
    pagadorCpfCnpj: pix.pagador_cpf_cnpj,
  }
}

async function markError(supabase: AdminClient, id: string, detail: string) {
  await supabase.from('pix_transactions').update({ status: 'ERROR' }).eq('id', id)
  await log(supabase, id, 'ERROR', detail, 'sistema')
}

// Concilia uma única transação PIX (chamada tanto pelo cron em lote quanto
// pelo webhook para o item recém-recebido). Nunca reverte para RECEIVED depois
// de tentar a baixa no ERP — se a chamada falhar, marca ERROR pra revisão
// manual, porque não dá pra saber com certeza se o ERP processou antes de falhar.
export async function reconcileSingle(supabase: AdminClient, pixId: string): Promise<boolean> {
  const claimed = await claimForReconciliation(supabase, pixId)
  if (!claimed) return false

  await log(supabase, claimed.id, 'MATCH_ATTEMPT',
    `Buscando título no ERP. CPF/CNPJ: ${claimed.pagador_cpf_cnpj ?? '—'}, Valor: ${claimed.valor}`, 'sistema')

  let titulo: JjwReceivableDto | null
  try {
    titulo = await findBestMatch(claimed)
  } catch (err) {
    await markError(supabase, claimed.id, `Erro ao consultar ERP: ${(err as Error).message}`)
    return false
  }

  if (!titulo) {
    await log(supabase, claimed.id, 'MATCH_NOT_FOUND', 'Nenhum título compatível encontrado no ERP', 'sistema')
    // Seguro reverter: a baixa nunca foi chamada nesse caminho.
    await supabase.from('pix_transactions').update({ status: 'RECEIVED' }).eq('id', claimed.id)
    return false
  }

  await supabase.from('pix_transactions').update({ status: 'MATCHED', erp_titulo_id: titulo.id }).eq('id', claimed.id)
  await log(supabase, claimed.id, 'MATCH_SUCCESS', `Título encontrado: ${titulo.id} | ${titulo.numero ?? ''}`, 'sistema')

  await log(supabase, claimed.id, 'BAIXA_SENT', `Enviando baixa para ERP. Título: ${titulo.id}`, 'sistema')

  let erpResponse: string
  try {
    erpResponse = await baixarTitulo(titulo.id, buildBaixaRequest(claimed))
  } catch (err) {
    await markError(supabase, claimed.id, `Erro ao dar baixa no ERP: ${(err as Error).message}`)
    return false
  }

  await supabase.from('pix_transactions').update({
    status: 'RECONCILED',
    erp_baixa_response: erpResponse,
    reconciliation_source: 'AUTOMATIC',
    reconciled_at: new Date().toISOString(),
    reconciled_by: 'sistema',
  }).eq('id', claimed.id)
  await log(supabase, claimed.id, 'BAIXA_OK', 'Baixa automática executada com sucesso', 'sistema')

  return true
}

export interface ReconciliationResult {
  total: number
  reconciled: number
  errors: number
}

// Processa um lote limitado de pendentes (não "todos de uma vez") — a Vercel
// Hobby tem teto de 60s por invocação, então um backlog grande precisa de
// várias chamadas de cron em sequência, não uma só travando o tempo todo.
export async function reconcilePending(limit: number = pixConfig.reconcileBatchLimit): Promise<ReconciliationResult> {
  const supabase = createAdminClient()

  const { data: pending, error } = await supabase
    .from('pix_transactions')
    .select('id')
    .eq('status', 'RECEIVED')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Falha ao buscar PIX pendentes: ${error.message}`)

  let reconciled = 0
  let errors = 0

  for (const row of pending ?? []) {
    try {
      const ok = await reconcileSingle(supabase, row.id)
      if (ok) reconciled++
    } catch {
      errors++
    }
  }

  return { total: pending?.length ?? 0, reconciled, errors }
}

// Linhas presas em RECONCILING (processo caiu no meio) são movidas para ERROR
// para revisão manual — NUNCA revertidas para RECEIVED automaticamente, pois
// não sabemos se a baixa no ERP já foi de fato aplicada antes da falha.
export async function sweepStaleReconciling(): Promise<number> {
  const supabase = createAdminClient()
  const staleBefore = new Date(Date.now() - pixConfig.staleReconcilingMinutes * 60_000).toISOString()

  const { data, error } = await supabase
    .from('pix_transactions')
    .update({ status: 'ERROR' })
    .eq('status', 'RECONCILING')
    .lt('updated_at', staleBefore)
    .select('id')

  if (error) throw new Error(`Falha ao varrer PIX presos em RECONCILING: ${error.message}`)

  for (const row of data ?? []) {
    await log(supabase, row.id, 'STALE_RECONCILING',
      'Linha presa em RECONCILING por tempo excessivo — possível settlement pendente, revisar manualmente', 'sistema')
  }

  return data?.length ?? 0
}
