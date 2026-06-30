export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseBRL, formatBRL, normText } from '@/lib/utils/br-format'

interface CreditoAberto {
  codigo: string
  fornecedor: string
  emissao: string
  lancamento: string
  valor: number
  saldo: number
}

interface DuplicataBaixada {
  duplicata: string
  pessoa: string
  emissao: string
  pagamento: string
  valor: number
  valorMovimento: number
}

// Formato: "CREDITO FORN EM ABERTO.txt"
// Blocos por "Fornecedor: XXXX - NOME" com linhas: DD/MM/YYYY [lançamento] valor saldo
function parseCreditoFornAberto(content: string): CreditoAberto[] {
  const credits: CreditoAberto[] = []
  const lines = content.split('\n')
  let currentCodigo = ''
  let currentFornecedor = ''
  let inBlock = false

  for (const line of lines) {
    const trimmed = line.trim()

    const fornMatch = trimmed.match(/Fornecedor:\s+(\d+)\s+-\s+(.+)/)
    if (fornMatch) {
      currentCodigo = fornMatch[1].trim()
      currentFornecedor = fornMatch[2].trim()
      inBlock = true
      continue
    }

    if (!inBlock || trimmed.startsWith('Emiss') || trimmed.startsWith('Total')) continue

    const dateMatch = trimmed.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.*)/)
    if (!dateMatch) continue

    const emissao = dateMatch[1]
    const rest = dateMatch[2]
    const decNums = [...rest.matchAll(/([\d.]+,\d{2})/g)]
    if (decNums.length < 1) continue

    const saldo = parseBRL(decNums[decNums.length - 1][0])
    const valor = decNums.length >= 2 ? parseBRL(decNums[decNums.length - 2][0]) : saldo
    const firstDecIdx = rest.indexOf(decNums[0][0])
    const lancamento = firstDecIdx > 0 ? rest.substring(0, firstDecIdx).trim().replace(/\s+/g, ' ') : ''

    if (saldo > 0 || valor > 0) {
      credits.push({ codigo: currentCodigo, fornecedor: currentFornecedor, emissao, lancamento, valor, saldo })
    }
  }

  return credits
}

// Formato: "DPL PAGA POR MOVIMENTO.txt"
// Linhas de duplicata com datas, seguidas de "Pessoa:NOME  Situação:..."
function parseDplPagaMovimento(content: string): DuplicataBaixada[] {
  const baixados: DuplicataBaixada[] = []
  const lines = content.split('\n')
  let pending: Partial<DuplicataBaixada> | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('Pessoa:') && pending) {
      const parts = trimmed.split(/\s{2,}/)
      const pessoaPart = parts.find(p => p.startsWith('Pessoa:'))
      if (pessoaPart) {
        pending.pessoa = pessoaPart.replace(/^Pessoa:\s*/, '').trim()
        if (pending.duplicata !== undefined && pending.valor !== undefined) {
          baixados.push(pending as DuplicataBaixada)
        }
      }
      pending = null
      continue
    }

    const dupMatch = trimmed.match(/^\d+\s+(\S+)\s+.*?(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+(\d{2}\/\d{2}\/\d{4})/)
    if (dupMatch) {
      const decNums = [...trimmed.matchAll(/([\d.]+,\d{2})/g)]
      if (decNums.length >= 1) {
        pending = {
          duplicata: dupMatch[1],
          emissao: dupMatch[2],
          pagamento: dupMatch[3],
          valor: parseBRL(decNums[0][0]),
          valorMovimento: decNums.length >= 2 ? parseBRL(decNums[1][0]) : parseBRL(decNums[0][0]),
          pessoa: '',
        }
      }
    }
  }

  return baixados
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file1 = formData.get('txtAberto') as File
    const file2 = formData.get('txtBaixadas') as File

    if (!file1 || !file2) return NextResponse.json({ error: 'Arquivos obrigatórios' }, { status: 400 })

    const content1 = Buffer.from(await file1.arrayBuffer()).toString('latin1')
    const content2 = Buffer.from(await file2.arrayBuffer()).toString('latin1')

    // Auto-detecta qual arquivo é qual pelo conteúdo
    const aberto = content1.includes('Fornecedor:') ? content1 : content2
    const baixadas = content1.includes('Pagamento de') || content1.includes('Pessoa:') ? content1 : content2

    const credits = parseCreditoFornAberto(aberto)
    const dups = parseDplPagaMovimento(baixadas)

    const periodMatch = baixadas.match(/Pagamento de\s+(\d{2}\/\d{2}\/\d{4})\s+até\s+(\d{2}\/\d{2}\/\d{4})/)
    const periodo = periodMatch ? `${periodMatch[1]} a ${periodMatch[2]}` : 'Não identificado'

    // Índice de baixadas por pessoa (nome normalizado)
    type ValPair = { valor: number; valorMovimento: number }
    const byPessoa = new Map<string, ValPair[]>()
    for (const dup of dups) {
      const key = normText(dup.pessoa)
      if (!byPessoa.has(key)) byPessoa.set(key, [])
      byPessoa.get(key)!.push({ valor: dup.valor, valorMovimento: dup.valorMovimento })
    }
    const allVals = new Set<number>(dups.flatMap(d => [d.valor, d.valorMovimento]))

    const valMatch = (vals: ValPair[], cv: number, cs: number): boolean =>
      vals.some(v =>
        Math.abs(v.valorMovimento - cs) < 0.01 || Math.abs(v.valor - cs) < 0.01 ||
        Math.abs(v.valorMovimento - cv) < 0.01 || Math.abs(v.valor - cv) < 0.01
      )

    let confirmados = 0, suspeitos = 0, emAberto = 0
    const results: unknown[] = []

    for (const credit of credits) {
      const normForn = normText(credit.fornecedor)
      const fornTokens = normForn.split(/\s+/).filter(t => t.length >= 4)
      let status = 'EM_ABERTO'

      // Correspondência exata por nome
      const exactVals = byPessoa.get(normForn)
      if (exactVals && valMatch(exactVals, credit.valor, credit.saldo)) {
        status = 'CONFIRMADO'
      }

      // Correspondência por tokens do nome (parcial)
      if (status === 'EM_ABERTO') {
        for (const [pessoaNorm, vals] of byPessoa) {
          const pessoaTokens = pessoaNorm.split(/\s+/).filter(t => t.length >= 4)
          const overlap = fornTokens.filter(t => pessoaTokens.includes(t)).length
          if (overlap > 0 && valMatch(vals, credit.valor, credit.saldo)) {
            status = 'CONFIRMADO'
            break
          }
        }
      }

      // Correspondência fraca apenas por valor (SUSPEITO)
      if (status === 'EM_ABERTO') {
        const looseMatch = [...allVals].some(v =>
          Math.abs(v - credit.saldo) < 0.01 || Math.abs(v - credit.valor) < 0.01
        )
        if (looseMatch) status = 'SUSPEITO'
      }

      if (status === 'CONFIRMADO') confirmados++
      else if (status === 'SUSPEITO') suspeitos++
      else emAberto++

      results.push({
        emissao: credit.emissao,
        lancamento: credit.lancamento,
        codigo: credit.codigo,
        fornecedor: credit.fornecedor,
        valor: formatBRL(credit.valor),
        saldo: formatBRL(credit.saldo),
        status,
      })
    }

    return NextResponse.json({
      results,
      summary: { confirmados, suspeitos, emAberto, total: results.length, periodo },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao processar arquivos' }, { status: 500 })
  }
}
