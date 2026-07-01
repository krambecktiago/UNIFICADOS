import { createAdminClient } from '@/lib/supabase/admin'
import { pixConfig } from './config'
import { findReceivableById, baixarTitulo } from './jjw-client'
import { log, buildBaixaRequest, isValueMatch, type PixTransactionRow } from './reconciliation'

export class ToleranceExceededError extends Error {
  constructor(public pixValor: number, public tituloValor: number) {
    super(`Diferença de valor fora da tolerância configurada (PIX: ${pixValor}, título: ${tituloValor})`)
  }
}

export async function reconcileManual(
  pixId: string,
  erpTituloId: string,
  operatorUsername: string,
  force = false
): Promise<void> {
  const supabase = createAdminClient()

  const { data: pix, error } = await supabase
    .from('pix_transactions')
    .select('*')
    .eq('id', pixId)
    .maybeSingle<PixTransactionRow>()

  if (error || !pix) throw new Error('PIX não encontrado')
  if (pix.status === 'RECONCILED') throw new Error('Este PIX já foi conciliado')

  if (!force) {
    const titulo = await findReceivableById(erpTituloId)
    if (titulo?.valor && !isValueMatch(pix.valor, titulo.valor, pixConfig.matchTolerancePct)) {
      throw new ToleranceExceededError(pix.valor, titulo.valor)
    }
  }

  await log(supabase, pix.id, 'MANUAL_MATCH',
    `Conciliação manual. Título: ${erpTituloId}${force ? ' [forçado]' : ''}`, operatorUsername)

  let erpResponse: string
  try {
    erpResponse = await baixarTitulo(erpTituloId, buildBaixaRequest(pix))
  } catch (err) {
    await log(supabase, pix.id, 'BAIXA_ERROR', String((err as Error).message ?? err), operatorUsername)
    await supabase.from('pix_transactions').update({ status: 'ERROR' }).eq('id', pix.id)
    throw err
  }

  await supabase.from('pix_transactions').update({
    erp_titulo_id: erpTituloId,
    erp_baixa_response: erpResponse,
    status: 'RECONCILED',
    reconciliation_source: 'MANUAL',
    reconciled_at: new Date().toISOString(),
    reconciled_by: operatorUsername,
  }).eq('id', pix.id)

  await log(supabase, pix.id, 'BAIXA_OK', `Baixa manual executada com sucesso. Título: ${erpTituloId}`, operatorUsername)
}

export async function ignorePix(pixId: string, operatorUsername: string, motivo: string): Promise<void> {
  const supabase = createAdminClient()

  const { data: pix } = await supabase
    .from('pix_transactions')
    .select('id, status')
    .eq('id', pixId)
    .maybeSingle()

  if (!pix) throw new Error('PIX não encontrado')
  if (pix.status === 'RECONCILED') throw new Error('Este PIX já foi conciliado e não pode ser ignorado')

  await supabase.from('pix_transactions').update({
    status: 'IGNORED',
    reconciled_by: operatorUsername,
    reconciled_at: new Date().toISOString(),
  }).eq('id', pixId)

  await log(supabase, pixId, 'IGNORED', `Motivo: ${motivo}`, operatorUsername)
}
