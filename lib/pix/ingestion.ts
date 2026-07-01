import { createAdminClient } from '@/lib/supabase/admin'
import { pixConfig } from './config'
import { getBradescoAccessToken } from './bradesco-auth'
import { fetchReceivedPix, pagadorCpfCnpj, type BradescoPixItem } from './bradesco-client'

function toRow(item: BradescoPixItem) {
  return {
    end_to_end_id: item.endToEndId,
    txid: item.txid ?? null,
    valor: item.valor,
    pagador_cpf_cnpj: pagadorCpfCnpj(item),
    pagador_nome: item.pagador?.nome ?? null,
    chave_pix: item.chave,
    data_hora_pagamento: new Date(item.horario).toISOString(),
    info_pagador: item.infoPagador ?? null,
    raw_payload: item,
  }
}

// Upsert com ignoreDuplicates: o unique constraint em end_to_end_id garante
// que reprocessar o mesmo PIX (via webhook e via cron, por exemplo) não gera
// linha duplicada. Retorna quantas linhas foram REALMENTE inseridas (novas).
export async function ingestItems(items: BradescoPixItem[]): Promise<number> {
  if (items.length === 0) return 0

  const supabase = createAdminClient()
  const rows = items.filter(i => !!i.endToEndId).map(toRow)

  const { data, error } = await supabase
    .from('pix_transactions')
    .upsert(rows, { onConflict: 'end_to_end_id', ignoreDuplicates: true })
    .select('id')

  if (error) throw new Error(`Falha ao ingerir PIX: ${error.message}`)
  return data?.length ?? 0
}

export async function ingestRecentPix(lookbackMinutes: number = pixConfig.lookbackMinutes): Promise<number> {
  const fim = new Date()
  const inicio = new Date(fim.getTime() - lookbackMinutes * 60_000)

  const accessToken = await getBradescoAccessToken()
  const items = await fetchReceivedPix(accessToken, inicio, fim)
  return ingestItems(items)
}
