export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { parseBRL, formatBRL, parseDataBR } from '@/lib/utils/br-format'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const formData = await request.formData()
    const txtFile = formData.get('txt') as File
    const xlsxFile = formData.get('xlsx') as File
    if (!txtFile || !xlsxFile) return NextResponse.json({ error: 'Arquivos obrigatórios' }, { status: 400 })

    // Parse TXT (baixadas/pagas)
    const txtContent = Buffer.from(await txtFile.arrayBuffer()).toString('latin1')

    // Extract period
    const periodMatch = txtContent.match(/Pagamento de (\d{2}\/\d{2}\/\d{4}) até (\d{2}\/\d{2}\/\d{4})/)
    const dtIni = periodMatch ? parseDataBR(periodMatch[1]) : null
    const dtFim = periodMatch ? parseDataBR(periodMatch[2]) : null

    // Extract pessoa blocks and their values
    const baixados = new Map<string, Set<number>>()
    const pessoaBlocks = txtContent.split(/Pessoa:\s+/)
    for (const block of pessoaBlocks.slice(1)) {
      const pessoaMatch = block.match(/^(\d+)/)
      if (!pessoaMatch) continue
      const pessoa = pessoaMatch[1]
      const valores = new Set<number>()
      const valuePattern = /([\d.]+,\d{2})/g
      let vm: RegExpExecArray | null
      while ((vm = valuePattern.exec(block)) !== null) {
        valores.add(parseBRL(vm[1]))
      }
      baixados.set(pessoa, valores)
    }
    const todosBaixados = new Set<number>()
    for (const vals of baixados.values()) {
      for (const v of vals) todosBaixados.add(v)
    }

    // Parse XLSX (créditos em aberto) from row 3 (index 2)
    const xlsxBuffer = Buffer.from(await xlsxFile.arrayBuffer())
    const wb = XLSX.read(xlsxBuffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })

    let confirmados = 0, suspeitos = 0, emAberto = 0
    const results: unknown[] = []

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      if (!row || !row[4]) continue
      const emissao = String(row[0] ?? '')
      const codigo = String(row[2] ?? '').trim()
      const fornecedor = String(row[3] ?? '').trim()
      const valor = parseBRL(row[4])
      const saldo = parseBRL(row[5])
      if (!valor) continue

      let status = 'EM_ABERTO'
      const pessoaVals = baixados.get(codigo)

      if (pessoaVals) {
        for (const v of pessoaVals) {
          if (Math.abs(v - valor) < 0.01) { status = 'CONFIRMADO'; break }
        }
      }
      if (status === 'EM_ABERTO') {
        for (const v of todosBaixados) {
          if (Math.abs(v - valor) < 0.01) { status = 'SUSPEITO'; break }
        }
      }

      if (status === 'CONFIRMADO') confirmados++
      else if (status === 'SUSPEITO') suspeitos++
      else emAberto++

      results.push({ emissao, codigo, fornecedor, valor: formatBRL(valor), saldo: formatBRL(saldo), status })
    }

    const periodo = dtIni && dtFim
      ? `${periodMatch![1]} a ${periodMatch![2]}`
      : 'Não identificado'

    return NextResponse.json({
      results,
      summary: { confirmados, suspeitos, emAberto, total: results.length, periodo },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao processar arquivos' }, { status: 500 })
  }
}
