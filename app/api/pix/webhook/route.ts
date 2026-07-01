export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { pixConfig } from '@/lib/pix/config'
import { ingestItems } from '@/lib/pix/ingestion'
import { reconcilePending } from '@/lib/pix/reconciliation'
import type { BradescoPixItem } from '@/lib/pix/bradesco-client'

// Recebe push do Bradesco com PIX recém-recebidos. Não confirmado se o
// produto de webhook do Bradesco realmente suporta um header customizado
// como este — verificar na documentação/portal antes de depender deste
// caminho como único mecanismo (o cron via GitHub Actions é o pilar confiável).
export async function POST(request: NextRequest) {
  const token = request.headers.get('x-webhook-token')
  if (!pixConfig.webhookToken || token !== pixConfig.webhookToken) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let payload: { pix?: BradescoPixItem[] }
  try {
    payload = await request.json()
  } catch {
    // Corpo inválido — responde 200 mesmo assim pra evitar retry agressivo do Bradesco.
    return NextResponse.json({ ok: true, ingested: 0 })
  }

  const items = (payload.pix ?? []).filter(i => !!i.endToEndId)
  const ingested = await ingestItems(items)
  const reconciliation = await reconcilePending()

  return NextResponse.json({ ok: true, ingested, ...reconciliation })
}
