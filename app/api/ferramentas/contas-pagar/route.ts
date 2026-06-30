export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatBRL } from '@/lib/utils/br-format'

type Lojas = 'L01' | 'L02' | 'L03' | 'L04' | 'L05'
type Bancos = 'VIACREDI' | 'BRADESCO' | 'SANTANDER' | 'ITAU'

interface Payload {
  webhook: string
  template: string
  data: string
  pagamentos: Record<Lojas, number>
  saldos: Record<Lojas, Record<Bancos, number>>
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body: Payload = await request.json()
    const { webhook, template, data, pagamentos, saldos } = body

    if (!webhook.startsWith('https://discord.com/api/webhooks/')) {
      return NextResponse.json({ error: 'URL do webhook inválida' }, { status: 400 })
    }

    const lojas: Lojas[] = ['L01', 'L02', 'L03', 'L04', 'L05']
    const bancos: Bancos[] = ['VIACREDI', 'BRADESCO', 'SANTANDER', 'ITAU']

    const vars: Record<string, string> = { '{DATA}': data }
    for (const l of lojas) {
      const pag = pagamentos[l] ?? 0
      const totalSaldo = bancos.reduce((s, b) => s + (saldos[l]?.[b] ?? 0), 0)
      vars[`{${l}_PAG}`] = formatBRL(pag)
      vars[`{${l}_SALDO}`] = formatBRL(totalSaldo)
      vars[`{${l}_DIF}`] = formatBRL(totalSaldo - pag)
      for (const b of bancos) {
        vars[`{${l}_${b}}`] = formatBRL(saldos[l]?.[b] ?? 0)
      }
    }

    let message = template
    for (const [k, v] of Object.entries(vars)) {
      message = message.replaceAll(k, v)
    }

    // Split into 2000-char chunks
    const chunks: string[] = []
    while (message.length > 0) {
      chunks.push(message.slice(0, 2000))
      message = message.slice(2000)
    }

    for (const chunk of chunks) {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chunk, username: 'Contas a Pagar' }),
      })
      if (!res.ok) return NextResponse.json({ error: 'Erro ao enviar para Discord' }, { status: 500 })
    }

    return NextResponse.json({ success: true, chunks: chunks.length })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
