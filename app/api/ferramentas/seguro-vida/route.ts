export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { logToolUsage } from '@/lib/supabase/tool-usage'
import { normText } from '@/lib/utils/br-format'

const LABEL_WORDS = new Set(['TOTAL','VALOR','QTD','SEGURADO','DATA','NOME','CPF','CARGO','EMPRESA','FILIAL','GRUPO','APOLICE','NUMERO','CONTRATO','PRODUTO','COBERTURA','CLASSE','EXPRESS','RELATORIO','MOVIMENTACAO','ESTIPULANTE','PAGADOR','DESCONTO'])

function isValidName(s: string): boolean {
  const trimmed = s.trim()
  // Nome de pessoa nunca tem dígito nem passa de ~8 palavras — filtra linhas
  // de endereço/processo da seguradora (ex: "AV REPUBLICA DO CHILE 330...")
  // que passariam pelo resto do filtro por serem só letras.
  if (/\d/.test(trimmed)) return false
  const words = trimmed.split(/\s+/).filter(w => /^[A-ZÀ-Ú]{2,}$/i.test(w))
  if (words.length < 2 || words.length > 8) return false
  const norm = normText(trimmed)
  return !LABEL_WORDS.has(norm) && !Array.from(LABEL_WORDS).some(l => norm.includes(l))
}

async function parsePDF(buffer: Buffer): Promise<Map<string, string>> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  let text: string
  try {
    text = (await parser.getText()).text
  } finally {
    await parser.destroy()
  }

  const result = new Map<string, string>()
  const cpfRegex = /\d{3}\.\d{3}\.\d{3}-\d{2}/g
  const blocks = text.split(cpfRegex)

  blocks.forEach((block, idx) => {
    if (idx === 0) return
    const lines = block.split('\n').map((l: string) => l.trim()).filter(Boolean)

    // O CPF encerra a linha da tabela ANTES do resto das colunas dessa mesma
    // pessoa (data de movimentação, status, valores) — essas colunas só
    // aparecem no início do bloco SEGUINTE, junto com o nome da próxima
    // pessoa. Por isso o status de quem está neste bloco vem das 2 primeiras
    // linhas do próximo bloco, não deste aqui.
    const nextLines = (blocks[idx + 1] ?? '').split('\n').map((l: string) => l.trim()).filter(Boolean).slice(0, 2)
    const marker = nextLines.join(' ').toUpperCase()
    let status = 'ATIVO'
    if (marker.includes('INCLUS')) status = 'INCLUSAO'
    else if (marker.includes('EXCLUS')) status = 'EXCLUSAO'

    // Janela larga o suficiente pra atravessar o cabeçalho/rodapé que se
    // repete a cada quebra de página do relatório (endereço da seguradora,
    // título, campos do estipulante...) até achar o nome de fato.
    for (const line of lines.slice(0, 20)) {
      if (isValidName(line) && line.length > 5) {
        result.set(normText(line), status)
        break
      }
    }
  })
  return result
}

function parseXLSX(buffer: Buffer, coluna: string, linhaInicial: number): Set<string> {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const colIdx = coluna.toUpperCase().charCodeAt(0) - 65
  const result = new Set<string>()

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
    for (let i = linhaInicial - 1; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      const val = String(row[colIdx] ?? '').trim()
      if (val && isValidName(val)) result.add(normText(val))
    }
  }
  return result
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const formData = await request.formData()
    const pdfFile = formData.get('pdf') as File
    const xlsxFile = formData.get('xlsx') as File
    const coluna = String(formData.get('coluna') ?? 'A')
    const linhaInicial = parseInt(String(formData.get('linhaInicial') ?? '1'), 10)

    if (!pdfFile || !xlsxFile) return NextResponse.json({ error: 'Arquivos obrigatórios' }, { status: 400 })

    const pdfMap = await parsePDF(Buffer.from(await pdfFile.arrayBuffer()))
    const xlsxSet = parseXLSX(Buffer.from(await xlsxFile.arrayBuffer()), coluna, linhaInicial)

    type Result = { nome: string; status: string; acao: string; origem: string }
    const results: Result[] = []
    let emAmbos = 0, soPdf = 0, soXlsx = 0, inclusoes = 0, exclusoes = 0

    for (const [normNome, status] of pdfMap) {
      if (status === 'INCLUSAO') { inclusoes++; results.push({ nome: normNome, status: 'INCLUSAO', acao: 'Inclusão pendente', origem: 'PDF' }); continue }
      if (status === 'EXCLUSAO') { exclusoes++; results.push({ nome: normNome, status: 'EXCLUSAO', acao: 'Exclusão pendente', origem: 'PDF' }); continue }
      if (xlsxSet.has(normNome)) { emAmbos++; results.push({ nome: normNome, status: 'ATIVO', acao: 'OK', origem: 'Ambos' }) }
      else { soPdf++; results.push({ nome: normNome, status: 'SOMENTE_PDF', acao: 'Adicionar à planilha', origem: 'PDF' }) }
    }
    for (const normNome of xlsxSet) {
      if (!pdfMap.has(normNome)) { soXlsx++; results.push({ nome: normNome, status: 'SOMENTE_XLSX', acao: 'Verificar saída', origem: 'Planilha' }) }
    }

    // Ativos no PDF = quem não está em inclusão/exclusão pendente — já
    // desconsidera esses dois status, sobrando só quem de fato está no seguro.
    const ativosPdf = Array.from(pdfMap.entries())
      .filter(([, status]) => status === 'ATIVO')
      .map(([nome]) => nome)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))

    // Lista completa da planilha — não dá pra reconstruir só com "Em Ambos" +
    // "Só Planilha": gente em inclusão/exclusão pendente no PDF também pode
    // já estar na planilha, e nesse caso não aparece em nenhum dos dois.
    const ativosXlsx = Array.from(xlsxSet).sort((a, b) => a.localeCompare(b, 'pt-BR'))

    await logToolUsage(supabase, user.id, 'seguro-vida', 2)

    return NextResponse.json({
      results,
      ativosPdf,
      ativosXlsx,
      summary: { total: results.length, emAmbos, soPdf, soXlsx, inclusoes, exclusoes, totalXlsxAtivos: xlsxSet.size },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao processar arquivos' }, { status: 500 })
  }
}
