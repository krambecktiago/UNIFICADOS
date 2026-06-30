export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseBRL, formatBRL, normText } from '@/lib/utils/br-format'

const FIDC_KEYWORDS = ['FIDC', 'BANCO', 'FUNDO', 'CRED', 'SECURIT', 'CAPITAL']

function fmtCNPJ(raw: string): string {
  const d = String(raw).replace(/\D/g, '')
  if (d.length !== 14) return raw
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

function sigTokens(name: string): Set<string> {
  return new Set(normText(name).split(/\s+/).filter(t => t.length >= 4))
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const formData = await request.formData()
    const txtFile = formData.get('txt') as File
    const csvFile = formData.get('csv') as File
    if (!txtFile || !csvFile) return NextResponse.json({ error: 'Arquivos obrigatórios' }, { status: 400 })

    // Parse TXT (Contas a Pagar)
    const txtContent = Buffer.from(await txtFile.arrayBuffer()).toString('latin1')
    type CPEntry = { fornecedor: string; duplicata: string; valor: number }
    const cpEntries: CPEntry[] = []
    for (const line of txtContent.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || !/^\d/.test(trimmed)) continue
      const valMatch = trimmed.match(/([\d.]+,\d{2})\s*$/)
      if (!valMatch) continue
      const valor = parseBRL(valMatch[1])
      if (!valor) continue
      const parts = trimmed.split(/\s+/)
      cpEntries.push({ fornecedor: parts.slice(0, -2).join(' '), duplicata: parts[parts.length - 2] ?? '', valor })
    }

    // Parse CSV (DDA) - semicolon delimiter, UTF-8 with BOM
    const csvContent = Buffer.from(await csvFile.arrayBuffer()).toString('utf-8').replace(/^﻿/, '')
    const csvLines = csvContent.split('\n').filter(l => l.trim())
    if (csvLines.length < 2) return NextResponse.json({ error: 'CSV inválido' }, { status: 400 })

    const headers = csvLines[0].split(';').map(h => normText(h))
    type DDAEntry = { beneficiario: string; cnpj: string; vencimento: string; nossoNumero: string; valor: number }
    const ddaEntries: DDAEntry[] = []

    for (let i = 1; i < csvLines.length; i++) {
      const cols = csvLines[i].split(';')
      const get = (keyword: string) => {
        const idx = headers.findIndex(h => h.includes(normText(keyword)))
        return idx >= 0 ? (cols[idx] ?? '').trim() : ''
      }
      const valor = parseBRL(get('valor') || get('VALOR'))
      if (!valor) continue
      ddaEntries.push({
        beneficiario: get('benefici') || get('CEDENTE') || get('EMPRESA'),
        cnpj: fmtCNPJ(get('cnpj') || get('CNPJ')),
        vencimento: get('venciment') || get('VENCIMENTO'),
        nossoNumero: get('nosso') || get('NUMERO'),
        valor,
      })
    }

    // Match
    let conciliados = 0, cedidos = 0, semMatch = 0
    const results: unknown[] = []

    for (const dda of ddaEntries) {
      const matches = cpEntries.filter(cp => Math.abs(cp.valor - dda.valor) < 0.01)
      if (matches.length === 0) {
        semMatch++
        results.push({ ...dda, valor: formatBRL(dda.valor), status: 'SEM_MATCH', cpFornecedor: '', cpDuplicata: '', cpValor: '' })
        continue
      }
      const cp = matches[0]
      const normBenef = normText(dda.beneficiario)
      const isFIDC = FIDC_KEYWORDS.some(k => normBenef.includes(k))
      const ddaTokens = sigTokens(dda.beneficiario)
      const cpTokens = sigTokens(cp.fornecedor)
      const overlap = [...ddaTokens].filter(t => cpTokens.has(t)).length

      let status: string
      if (isFIDC) { status = 'CEDIDO_ALTA'; cedidos++ }
      else if (overlap === 0 && ddaTokens.size > 0) { status = 'CEDIDO_VERIFICACAO'; cedidos++ }
      else { status = 'CONCILIADO'; conciliados++ }

      results.push({
        beneficiario: dda.beneficiario,
        cnpj: dda.cnpj,
        vencimento: dda.vencimento,
        nossoNumero: dda.nossoNumero,
        valor: formatBRL(dda.valor),
        status,
        cpFornecedor: cp.fornecedor,
        cpDuplicata: cp.duplicata,
        cpValor: formatBRL(cp.valor),
      })
    }

    return NextResponse.json({
      results,
      summary: { total: results.length, conciliados, cedidos, semMatch },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao processar arquivos' }, { status: 500 })
  }
}
