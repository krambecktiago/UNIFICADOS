export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logToolUsage } from '@/lib/supabase/tool-usage'
import { parseBRL, formatBRL, normText } from '@/lib/utils/br-format'

function tryDecode(buf: Buffer): string {
  try { return buf.toString('utf-8') } catch { return buf.toString('latin1') }
}

function parseCSVVendas(content: string): Array<{ data: string; valor: number }> {
  const clean = content.replace(/^﻿/, '')
  const lines = clean.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => normText(h))

  const statusIdx = headers.findIndex(h => h.includes('STATUS') || h.includes('SITUAC'))
  const valorIdx = headers.findIndex(h => h === 'VALOR' || h.includes('VALOR_BRUTO') || h.includes('VALOR BRUTO'))
  const dataIdx = headers.findIndex(h => h.includes('DATA') && !h.includes('VENCIM'))

  const results: Array<{ data: string; valor: number }> = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep)
    if (statusIdx >= 0 && !normText(cols[statusIdx] ?? '').includes('APROVAD')) continue
    const valor = parseBRL(cols[valorIdx] ?? '')
    if (!valor) continue
    results.push({ data: (cols[dataIdx] ?? '').trim(), valor })
  }
  return results
}

function parseTXTDuplicatas(content: string) {
  type Dup = { empresa: string; duplicata: string; emissao: string; vencimento: string; valor: number }
  const results: Dup[] = []
  const lines = content.split('\n')
  let currentEmpresa = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const dupMatch = trimmed.match(/^(\d{1,3}(?:\.\d{3})*\/\d+\.\d+|\d+\.\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/)
    if (dupMatch) {
      const valueMatch = trimmed.match(/([\d.]+,\d{2})\s*$/)
      if (valueMatch) {
        results.push({
          empresa: currentEmpresa,
          duplicata: dupMatch[1],
          emissao: dupMatch[2],
          vencimento: dupMatch[3],
          valor: parseBRL(valueMatch[1]),
        })
      }
    } else if (!/^\d/.test(trimmed) && trimmed.length > 3) {
      currentEmpresa = trimmed
    }
  }
  return results
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const formData = await request.formData()
    const csvFile = formData.get('csv') as File
    const txtFile = formData.get('txt') as File
    if (!csvFile || !txtFile) return NextResponse.json({ error: 'Arquivos obrigatórios' }, { status: 400 })

    const vendas = parseCSVVendas(tryDecode(Buffer.from(await csvFile.arrayBuffer())))
    const duplicatas = parseTXTDuplicatas(tryDecode(Buffer.from(await txtFile.arrayBuffer())))

    let confirmados = 0, aVerificar = 0, naoEncontrados = 0
    let totalEmAberto = 0, totalConfirmado = 0

    const results = duplicatas.map(dup => {
      totalEmAberto += dup.valor
      const byValue = vendas.filter(v => Math.abs(v.valor - dup.valor) < 0.01)

      if (byValue.length === 0) {
        naoEncontrados++
        return { ...dup, valor: formatBRL(dup.valor), status: 'NAO_ENCONTRADO', vendaData: '', vendaValor: '' }
      }

      const exact = byValue.find(v => v.data === dup.emissao || v.data.includes(dup.emissao.split('/')[0]))
      const status = exact ? 'CONFIRMADO' : 'A_VERIFICAR'
      if (status === 'CONFIRMADO') { confirmados++; totalConfirmado += dup.valor }
      else aVerificar++

      const venda = exact ?? byValue[0]
      return { ...dup, valor: formatBRL(dup.valor), status, vendaData: venda.data, vendaValor: formatBRL(venda.valor) }
    })

    await logToolUsage(supabase, user.id, 'conciliacao-cartao', 2)

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        confirmados,
        aVerificar,
        naoEncontrados,
        totalEmAberto: formatBRL(totalEmAberto),
        totalConfirmado: formatBRL(totalConfirmado),
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao processar arquivos' }, { status: 500 })
  }
}
