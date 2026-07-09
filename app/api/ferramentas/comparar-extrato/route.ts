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
  type: '1:1' | 'N:1' | '1:N' | 'M:N' | 'ajuste'
  banks: BankEntry[]
  erp: ErpEntry
  // Em type '1:N' e 'M:N': os demais lançamentos do ERP que, somados a
  // `erp`, batem com o(s) lançamento(s) do banco.
  erpGroup?: ErpEntry[]
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

// Resolve subset-sum determinístico (cada item usado no máximo uma vez): qual
// combinação de `candidates` soma exatamente `targetCents`? Usa "meet in the
// middle" — divide os candidatos em duas metades, calcula todas as somas
// possíveis de cada metade (O(2^(n/2)) cada) e combina — em vez de um DP que
// escala com o VALOR-alvo (explode pra lotes de R$ 500 mil+) ou que aborta
// por excesso de somas alcançáveis mesmo quando a resposta existe. Cobre
// desde 1 lançamento até um lote inteiro (ex: pagamento de fornecedores em
// lote no ERP contra dezenas de PIX/boletos individuais no banco). Retorna
// null se não achar combinação.
function findSubsetSum<T extends { valor: number }>(candidates: T[], targetCents: number): T[] | null {
  if (targetCents <= 0 || candidates.length === 0) return null
  // Cada metade tem no máximo ~20 itens (2^20 somas — rápido e leve). Um
  // único dia com mais de 40 lançamentos sem par não é um cenário real de
  // conciliação bancária.
  if (candidates.length > 40) return null

  const withCents = candidates
    .map((c, i) => ({ i, v: Math.round(c.valor * 100) }))
    .filter(x => x.v > 0 && x.v <= targetCents)

  const mid = Math.ceil(withCents.length / 2)
  const left = withCents.slice(0, mid)
  const right = withCents.slice(mid)

  // soma alcançável (centavos) -> bitmask local (bit k = k-ésimo item de `items`)
  function subsetSums(items: { i: number; v: number }[]): Map<number, number> {
    const sums = new Map<number, number>([[0, 0]])
    for (let k = 0; k < items.length; k++) {
      const v = items[k].v
      for (const [s, mask] of [...sums]) {
        const next = s + v
        if (next <= targetCents && !sums.has(next)) sums.set(next, mask | (1 << k))
      }
    }
    return sums
  }

  const leftSums = subsetSums(left)
  const rightSums = subsetSums(right)

  for (const [lSum, lMask] of leftSums) {
    const rMask = rightSums.get(targetCents - lSum)
    if (rMask === undefined) continue

    const used: T[] = []
    for (let k = 0; k < left.length; k++) if (lMask & (1 << k)) used.push(candidates[left[k].i])
    for (let k = 0; k < right.length; k++) if (rMask & (1 << k)) used.push(candidates[right[k].i])
    if (used.length > 0) return used
  }
  return null
}

// Caso mais geral que findSubsetSum: quando nem um único lançamento (de
// nenhum lado) fecha isolado, mas um lote de vários débitos ERP soma
// exatamente ao lote de vários débitos do banco (ex: DDA + PIX + taxas do
// mesmo lote batidos contra dezenas de lançamentos individuais do banco).
// Mistura ERP (valor positivo) e banco (valor negativo) num só pool e busca
// um subconjunto não-vazio somando zero — mesma técnica meet-in-the-middle.
// Um subconjunto não-vazio só soma zero se tiver pelo menos um item de cada
// lado (valores são sempre > 0, então só-ERP ou só-banco nunca zera).
function findZeroSumMix(
  erpItems: ErpIndexed[],
  bankItems: BankEntry[]
): { erp: ErpIndexed[]; bank: BankEntry[] } | null {
  const items = [
    ...erpItems.map((e, idx) => ({ side: 'erp' as const, idx, v: Math.round(e.valor * 100) })),
    ...bankItems.map((b, idx) => ({ side: 'bank' as const, idx, v: -Math.round(b.valor * 100) })),
  ]
  if (items.length < 2 || items.length > 40) return null

  const mid = Math.ceil(items.length / 2)
  const left = items.slice(0, mid)
  const right = items.slice(mid)

  function subsetSums(part: typeof left): Map<number, number> {
    const sums = new Map<number, number>([[0, 0]])
    for (let k = 0; k < part.length; k++) {
      const v = part[k].v
      for (const [s, mask] of [...sums]) {
        const next = s + v
        if (!sums.has(next)) sums.set(next, mask | (1 << k))
      }
    }
    return sums
  }

  const leftSums = subsetSums(left)
  const rightSums = subsetSums(right)

  for (const [lSum, lMask] of leftSums) {
    if (lSum === 0 && lMask === 0) continue // ignora o subconjunto vazio
    const rMask = rightSums.get(-lSum)
    if (rMask === undefined) continue

    const erpOut: ErpIndexed[] = []
    const bankOut: BankEntry[] = []
    for (let k = 0; k < left.length; k++) {
      if (!(lMask & (1 << k))) continue
      if (left[k].side === 'erp') erpOut.push(erpItems[left[k].idx])
      else bankOut.push(bankItems[left[k].idx])
    }
    for (let k = 0; k < right.length; k++) {
      if (!(rMask & (1 << k))) continue
      if (right[k].side === 'erp') erpOut.push(erpItems[right[k].idx])
      else bankOut.push(bankItems[right[k].idx])
    }
    if (erpOut.length > 0 && bankOut.length > 0) return { erp: erpOut, bank: bankOut }
  }
  return null
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

  const afterPhase2Missing = phase1miss.filter(t => !usedInGroup.has(t))
  const afterPhase2Pending = Object.values(erpIdx).flat().filter(e => !e._used)

  // Fase 3: matching 1:N (soma de lançamentos ERP = 1 banco) — caso inverso
  // da Fase 2: quando o banco lança em uma única linha o que o ERP separou
  // em vários (ex: mais de um pagamento de saída no mesmo dia agrupado
  // numa só transferência bancária).
  const pendingByDate: Record<string, ErpIndexed[]> = {}
  for (const e of afterPhase2Pending) {
    if (!pendingByDate[e.date]) pendingByDate[e.date] = []
    pendingByDate[e.date].push(e)
  }
  const erpUsedInGroup = new Set<ErpIndexed>()
  const bankUsedInErpGroup = new Set<BankEntry>()

  for (const bt of afterPhase2Missing) {
    const cands = (pendingByDate[bt.date] || []).filter(e => !erpUsedInGroup.has(e))
    const target = Math.round(bt.valor * 100)
    const group = findSubsetSum(cands, target)
    if (group) {
      group.forEach(e => erpUsedInGroup.add(e))
      bankUsedInErpGroup.add(bt)
      matched.push({ type: '1:N', banks: [bt], erp: group[0], erpGroup: group })
    }
  }

  const afterPhase3Missing = afterPhase2Missing.filter(t => !bankUsedInErpGroup.has(t))
  const afterPhase3Pending = afterPhase2Pending.filter(e => !erpUsedInGroup.has(e))

  // Fase 4: matching M:N — quando nem um único lançamento (de nenhum lado)
  // fecha isolado, mas um lote de vários débitos ERP soma exatamente ao
  // lote de vários débitos do banco que restaram no dia (ex: DDA + PIX +
  // taxas do mesmo lote batidos contra dezenas de lançamentos individuais
  // do banco). Repete por data até não achar mais nenhum grupo.
  const missingByDate: Record<string, BankEntry[]> = {}
  for (const b of afterPhase3Missing) {
    if (!missingByDate[b.date]) missingByDate[b.date] = []
    missingByDate[b.date].push(b)
  }
  const pendingByDate2: Record<string, ErpIndexed[]> = {}
  for (const e of afterPhase3Pending) {
    if (!pendingByDate2[e.date]) pendingByDate2[e.date] = []
    pendingByDate2[e.date].push(e)
  }
  const bankUsedPhase4 = new Set<BankEntry>()
  const erpUsedPhase4 = new Set<ErpIndexed>()

  for (const date of Object.keys(pendingByDate2)) {
    for (let guard = 0; guard < 20; guard++) {
      const erpCands = pendingByDate2[date].filter(e => !erpUsedPhase4.has(e))
      const bankCands = (missingByDate[date] || []).filter(b => !bankUsedPhase4.has(b))
      const found = findZeroSumMix(erpCands, bankCands)
      if (!found) break
      found.erp.forEach(e => erpUsedPhase4.add(e))
      found.bank.forEach(b => bankUsedPhase4.add(b))
      matched.push({ type: 'M:N', banks: found.bank, erp: found.erp[0], erpGroup: found.erp })
    }
  }

  const missing = afterPhase3Missing.filter(t => !bankUsedPhase4.has(t))
  const pending = afterPhase3Pending.filter(e => !erpUsedPhase4.has(e))

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
