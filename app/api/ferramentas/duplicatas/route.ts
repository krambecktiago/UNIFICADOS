export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { parseBRL, normDup, formatBRL } from '@/lib/utils/br-format'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const formData = await request.formData()
    const xlsxFile = formData.get('xlsx') as File
    const txtFile = formData.get('txt') as File
    if (!xlsxFile || !txtFile) return NextResponse.json({ error: 'Arquivos obrigatórios' }, { status: 400 })

    // Parse XLSX (bank return) - data starts at row 8 (index 7)
    const xlsxBuffer = Buffer.from(await xlsxFile.arrayBuffer())
    const wb = XLSX.read(xlsxBuffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })

    type BankEntry = { seuNumero: string; vencimento: string; liquidacao: string; valorTitulo: number; valorCobrado: number; pagador: string }
    const bankEntries: BankEntry[] = []
    for (let i = 7; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      if (!row || !row[0]) continue
      bankEntries.push({
        seuNumero: normDup(String(row[0] ?? '')),
        vencimento: String(row[3] ?? ''),
        liquidacao: String(row[4] ?? ''),
        valorTitulo: parseBRL(row[5]),
        valorCobrado: parseBRL(row[6]),
        pagador: String(row[7] ?? ''),
      })
    }

    // Parse TXT (ERP) - find all duplicata numbers
    const txtBuffer = Buffer.from(await txtFile.arrayBuffer())
    const txtContent = txtBuffer.toString('latin1')
    const dupPattern = /([0-9]{6,}.[0-9]+)/g
    const erpSet = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = dupPattern.exec(txtContent)) !== null) {
      erpSet.add(normDup(m[1]))
    }

    // Compare
    let baixadas = 0, naoBaixadas = 0
    const results = bankEntries.map(e => {
      const found = erpSet.has(e.seuNumero)
      if (found) baixadas++; else naoBaixadas++
      return {
        duplicata: e.seuNumero,
        pagador: e.pagador,
        vencimento: e.vencimento,
        liquidacao: e.liquidacao,
        valorTitulo: formatBRL(e.valorTitulo),
        valorCobrado: formatBRL(e.valorCobrado),
        juros: formatBRL(e.valorCobrado - e.valorTitulo),
        status: found ? 'BAIXADA' : 'NAO_BAIXADA',
      }
    })

    return NextResponse.json({ results, summary: { baixadas, naoBaixadas, total: results.length } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao processar arquivos' }, { status: 500 })
  }
}
