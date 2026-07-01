export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { pixConfig } from '@/lib/pix/config'
import { ingestRecentPix } from '@/lib/pix/ingestion'
import { sweepStaleReconciling, reconcilePending } from '@/lib/pix/reconciliation'

// Chamado por um workflow agendado do GitHub Actions (a Vercel Hobby só
// permite cron nativo 1x/dia, insuficiente pro polling de PIX). Autenticado
// por um secret separado do das env vars da Vercel — configurar em
// GitHub → Settings → Secrets → Actions.
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!pixConfig.cronSecret || auth !== `Bearer ${pixConfig.cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const staleReverted = await sweepStaleReconciling()

  let ingested = 0
  let ingestError: string | null = null
  try {
    ingested = await ingestRecentPix()
  } catch (err) {
    ingestError = (err as Error).message
  }

  const reconciliation = await reconcilePending()

  return NextResponse.json({ staleReverted, ingested, ingestError, ...reconciliation })
}
