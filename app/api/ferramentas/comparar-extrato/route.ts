export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logToolUsage } from '@/lib/supabase/tool-usage'

interface ErpEntry {
  date: string
  lanc: string
  valor: number
  desc: string
}

interface BankEntry {
  date: string
  desc: string
  ref: string
  valor: number
}

interface MatchedEntry {
  type: '1:1' | 'N:1' | 'ajuste'
  banks: BankEntry[]
  erp: ErpEntry
  // Só em type 'ajuste': cheque(s) devolvido(s) descontado(s) do depósito
  // original do ERP até o valor bater com o crédito líquido do banco.
  devolvidos?: ErpEntry[]
}

type ErpIndexed = ErpEntry & { _used: boolean }

function convFloat(s: string): number {
  if (!s || !s.trim()) return 0
  return parseFloat(s.trim().replace(/\./g, '').replace(',', '.')) || 0
}

// Débito fica alinhado à direita numa coluna mais à esquerda (~col 30-38);
// Crédito numa coluna mais à direita (~col 42-53) — nunca os dois na mesma
// linha. A posição do primeiro valor decide de qual lado o lançamento é.
const CREDITO_COL_THRESHOLD = 40

// Lê TODOS os lançamentos do ERP (crédito e débito), com descrição — usada
// tanto pra conciliar Entradas quanto Saídas, e pra identificar cheques
// devolvidos ("CHEQUES DEVOLVIDOS...") dentro do lado de débito.
function parseErpLancamentos(text: string): { creditos: ErpEntry[]; debitos: ErpEntry[] } {
  const seen = new Set<string>()
  const creditos: ErpEntry[] = []
  const debitos: ErpEntry[] = []

  for (const line of text.split('\n')) {
    const m = line.match(/^ (\d{2}\/\d{2}\/\d{4})\s+(\d{7,})/)
    if (!m) continue
    const [, date, lanc] = m
    if (seen.has(lanc)) continue

    // Cada linha só tem um valor populado (Débito OU Crédito) antes do
    // Saldo — precisa de pelo menos 2 números (valor + saldo) pra ser uma
    // linha de lançamento de verdade (não cabeçalho/rodapé).
    const matches = [...line.matchAll(/([\d.]+,\d{2})/g)]
    if (matches.length < 2) continue
    const [valorMatch] = matches
    const valor = convFloat(valorMatch[1])
    if (valor <= 0) continue

    seen.add(lanc)
    const last = matches[matches.length - 1]
    const desc = line.slice((last.index ?? 0) + last[0].length).trim()
    const entry: ErpEntry = { date, lanc, valor, desc }

    if ((valorMatch.index ?? 0) >= CREDITO_COL_THRESHOLD) creditos.push(entry)
    else debitos.push(entry)
  }

  return { creditos, debitos }
}

function parseBankEntries(text: string): { creditos: BankEntry[]; debitos: BankEntry[] } {
  const creditos: BankEntry[] = []
  const debitos: BankEntry[] = []
  for (const line of text.split('\n').slice(1)) {
    if (!line.trim()) continue
    const p = line.split(';')
    if (p.length < 5) continue
    const entry: BankEntry = { date: p[0].trim(), desc: p[1].trim(), ref: p[2].trim(), valor: convFloat(p[3]) }
    if (p[4].trim() === 'C') creditos.push(entry)
    else if (p[4].trim() === 'D') debitos.push(entry)
  }
  return { creditos, debitos }
}

// Resolve subset-sum determinístico (DP 0/1, cada item usado no máximo uma
// vez): qual combinação de `candidates` soma exatamente `targetCents`? Sem
// limite de quantidade — cobre desde 1 lançamento até um lote inteiro (ex:
// um pagamento de fornecedores em lote no ERP contra dezenas de PIX/boletos
// individuais no extrato do banco). Retorna null se não achar combinação.
function findSubsetSum(candidates: BankEntry[], targetCents: number): BankEntry[] | null {
  if (targetCents <= 0 || candidates.length === 0) return null
  // Trava de segurança contra entradas patológicas (não deve ocorrer no
  // movimento normal de um dia) — evita DP gigante travando a requisição.
  if (targetCents > 50_000_000 || candidates.length > 300) return null

  const reach = new Int32Array(targetCents + 1).fill(-1) // índice do item que completou a soma s
  reach[0] = -2 // soma 0 alcançável sem nenhum item

  for (let i = 0; i < candidates.length; i++) {
    const v = Math.round(candidates[i].valor * 100)
    if (v <= 0 || v > targetCents) continue
    for (let s = targetCents; s >= v; s--) {
      if (reach[s] === -1 && reach[s - v] !== -1) reach[s] = i
    }
  }

  if (reach[targetCents] === -1) return null

  const used: BankEntry[] = []
  let s = targetCents
  while (s > 0) {
    const i = reach[s]
    if (i < 0) break
    used.push(candidates[i])
    s -= Math.round(candidates[i].valor * 100)
  }
  return used
}

// Motor de conciliação genérico — usado tanto pra Entradas (crédito ERP x
// crédito banco) quanto pra Saídas (débito ERP x débito banco).
function matchSide(erp: ErpEntry[], bank: BankEntry[]) {
  const erpIdx: Record<string, ErpIndexed[]> = {}
  for (const t of erp) {
    const k = `${t.date}|${Math.round(t.valor * 100)}`
    if (!erpIdx[k]) erpIdx[k] = []
    erpIdx[k].push({ ...t, _used: false })
  }

  const matched: MatchedEntry[] = []
  const phase1miss: BankEntry[] = []

  // Fase 1: matching 1:1 exato (mesma data + mesmo valor)
  for (const bt of bank) {
    const k = `${bt.date}|${Math.round(bt.valor * 100)}`
    const free = (erpIdx[k] || []).find(e => !e._used)
    if (free) {
      free._used = true
      matched.push({ type: '1:1', banks: [bt], erp: free })
    } else {
      phase1miss.push(bt)
    }
  }

  // Fase 2: matching N:1 (soma de lançamentos banco = 1 ERP)
  const byDate: Record<string, BankEntry[]> = {}
  for (const t of phase1miss) {
    if (!byDate[t.date]) byDate[t.date] = []
    byDate[t.date].push(t)
  }

  const erpFree = Object.values(erpIdx).flat().filter(e => !e._used)
  const usedInGroup = new Set<BankEntry>()

  for (const erpE of erpFree) {
    const cands = (byDate[erpE.date] || []).filter(t => !usedInGroup.has(t))
    const target = Math.round(erpE.valor * 100)
    const group = findSubsetSum(cands, target)
    if (group) {
      erpE._used = true
      group.forEach(b => usedInGroup.add(b))
      matched.push({ type: 'N:1', banks: group, erp: erpE })
    }
  }

  const missing = phase1miss.filter(t => !usedInGroup.has(t))
  const pending = Object.values(erpIdx).flat().filter(e => !e._used)

  missing.sort((a, b) => a.date.localeCompare(b.date))
  matched.sort((a, b) => a.banks[0].date.localeCompare(b.banks[0].date))
  pending.sort((a, b) => a.date.localeCompare(b.date))

  return { matched, missing, pending }
}

// Ajustes específicos do lado de Entradas: depósito de cheque que sobrou
// pendente pode ter vindo líquido de cheque(s) devolvido(s) do mesmo lote —
// o ERP lança o valor cheio do depósito e, à parte, um débito "CHEQUES
// DEVOLVIDOS"; o banco só creditou o líquido. Quando não dá pra descontar
// de nenhum depósito, tenta confirmar o devolvido contra um débito do banco
// (ex: "DEV.CH.DEP.11") — um estorno separado em vez de líquido na hora.
function applyChequeDevolvidoAdjustments(
  matched: MatchedEntry[],
  missing: BankEntry[],
  pending: ErpEntry[],
  devolvidos: ErpEntry[],
  bankDebits: BankEntry[]
) {
  const bankUsedFase3 = new Set<BankEntry>()
  const pendingUsedFase3 = new Set<ErpEntry>()
  const devUsed = new Set<ErpEntry>()

  for (const erpE of pending) {
    const sameDateBank = missing.filter(b => b.date === erpE.date && !bankUsedFase3.has(b))
    const devCands = devolvidos.filter(d => d.date === erpE.date && !devUsed.has(d))
    let matchedThis = false

    single: for (const dev of devCands) {
      const target = Math.round((erpE.valor - dev.valor) * 100)
      for (const b of sameDateBank) {
        if (Math.round(b.valor * 100) === target) {
          matched.push({ type: 'ajuste', banks: [b], erp: erpE, devolvidos: [dev] })
          devUsed.add(dev); bankUsedFase3.add(b); pendingUsedFase3.add(erpE)
          matchedThis = true
          break single
        }
      }
    }

    if (matchedThis) continue

    pair: for (let i = 0; i < devCands.length; i++) {
      for (let j = i + 1; j < devCands.length; j++) {
        const target = Math.round((erpE.valor - devCands[i].valor - devCands[j].valor) * 100)
        for (const b of sameDateBank) {
          if (Math.round(b.valor * 100) === target) {
            matched.push({ type: 'ajuste', banks: [b], erp: erpE, devolvidos: [devCands[i], devCands[j]] })
            devUsed.add(devCands[i]); devUsed.add(devCands[j]); bankUsedFase3.add(b); pendingUsedFase3.add(erpE)
            matchedThis = true
            break pair
          }
        }
      }
    }
  }

  const missingLeft = missing.filter(b => !bankUsedFase3.has(b))
  const pendingLeft = pending.filter(e => !pendingUsedFase3.has(e))
  const leftoverDevolvidos = devolvidos.filter(d => !devUsed.has(d))

  const bankDebitUsed = new Set<BankEntry>()
  const confirmedDevolvidos: { erp: ErpEntry; bankDebit: BankEntry }[] = []
  for (const dev of leftoverDevolvidos) {
    const hit = bankDebits.find(bd =>
      !bankDebitUsed.has(bd) && bd.date === dev.date && Math.round(bd.valor * 100) === Math.round(dev.valor * 100)
    )
    if (hit) {
      bankDebitUsed.add(hit)
      confirmedDevolvidos.push({ erp: dev, bankDebit: hit })
    }
  }

  missingLeft.sort((a, b) => a.date.localeCompare(b.date))
  matched.sort((a, b) => a.banks[0].date.localeCompare(b.banks[0].date))
  pendingLeft.sort((a, b) => a.date.localeCompare(b.date))

  return {
    missing: missingLeft,
    pending: pendingLeft,
    confirmedDevolvidos,
    // Cheque devolvido "resolvido" (descontado de um depósito ou confirmado
    // por estorno do banco) sai do jogo geral de Saídas — já foi contabilizado
    // aqui. Os que sobrarem seguem soltos e aparecem normalmente na
    // conciliação de Saídas (como qualquer outro débito sem par).
    usedDevolvidoLancs: new Set([...devUsed, ...confirmedDevolvidos.map(c => c.erp)].map(d => d.lanc)),
    usedBankDebitRefs: new Set([...bankDebitUsed].map(b => b.ref)),
  }
}

function buildSummary(bank: BankEntry[], matched: MatchedEntry[], missing: BankEntry[], pending: ErpEntry[]) {
  const s = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  return {
    bankTotal: s(bank.map(t => t.valor)),
    bankCount: bank.length,
    okTotal: s(matched.flatMap(r => r.banks.map(b => b.valor))),
    okCount: matched.length,
    missTotal: s(missing.map(t => t.valor)),
    missCount: missing.length,
    pendTotal: s(pending.map(t => t.valor)),
    pendCount: pending.length,
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const formData = await request.formData()
    const erpFile = formData.get('erpFile') as File
    const bankFile = formData.get('bankFile') as File

    if (!erpFile || !bankFile) {
      return NextResponse.json({ error: 'Ambos os arquivos são obrigatórios.' }, { status: 400 })
    }

    const erpText = Buffer.from(await erpFile.arrayBuffer()).toString('latin1')
    const bankText = Buffer.from(await bankFile.arrayBuffer()).toString('latin1')

    const { creditos: erpCreditos, debitos: erpDebitosAll } = parseErpLancamentos(erpText)
    const { creditos: bankCreditos, debitos: bankDebitosAll } = parseBankEntries(bankText)
    const devolvidos = erpDebitosAll.filter(d => /CHEQUES DEVOLVIDOS/i.test(d.desc))

    // Entradas (créditos)
    const creditoMatch = matchSide(erpCreditos, bankCreditos)
    const ajustes = applyChequeDevolvidoAdjustments(
      creditoMatch.matched, creditoMatch.missing, creditoMatch.pending, devolvidos, bankDebitosAll
    )

    // Saídas (débitos) — exclui os cheques devolvidos já resolvidos acima
    const erpDebitosRest = erpDebitosAll.filter(d => !ajustes.usedDevolvidoLancs.has(d.lanc))
    const bankDebitosRest = bankDebitosAll.filter(b => !ajustes.usedBankDebitRefs.has(b.ref))
    const saidaMatch = matchSide(erpDebitosRest, bankDebitosRest)

    await logToolUsage(supabase, user.id, 'comparar-extrato', 2)

    return NextResponse.json({
      entradas: {
        missing: ajustes.missing,
        matched: creditoMatch.matched,
        pending: ajustes.pending,
        confirmedDevolvidos: ajustes.confirmedDevolvidos,
        summary: buildSummary(bankCreditos, creditoMatch.matched, ajustes.missing, ajustes.pending),
      },
      saidas: {
        missing: saidaMatch.missing,
        matched: saidaMatch.matched,
        pending: saidaMatch.pending,
        summary: buildSummary(bankDebitosRest, saidaMatch.matched, saidaMatch.missing, saidaMatch.pending),
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao processar arquivos.' }, { status: 500 })
  }
}
