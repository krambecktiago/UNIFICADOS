export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logToolUsage } from '@/lib/supabase/tool-usage'

interface ErpEntry {
  date: string
  lanc: string
  valor: number
}

interface BankEntry {
  date: string
  desc: string
  ref: string
  valor: number
}

interface MatchedEntry {
  type: '1:1' | 'N:1'
  banks: BankEntry[]
  erp: ErpEntry
}

type ErpIndexed = ErpEntry & { _used: boolean }

function convFloat(s: string): number {
  if (!s || !s.trim()) return 0
  return parseFloat(s.trim().replace(/\./g, '').replace(',', '.')) || 0
}

function parseErp(text: string): ErpEntry[] {
  const seen = new Set<string>()
  const result: ErpEntry[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/^ (\d{2}\/\d{2}\/\d{4})\s+(\d{7,})/)
    if (!m) continue
    const [, date, lanc] = m
    if (seen.has(lanc)) continue
    seen.add(lanc)
    if (line.length <= 42) continue
    const zona = line.substring(42, Math.min(55, line.length))
    const vm = zona.match(/([\d.]+,\d{2})/)
    if (vm) {
      const valor = convFloat(vm[1])
      if (valor > 0) result.push({ date, lanc, valor })
    }
  }
  return result
}

function parseBank(text: string): BankEntry[] {
  const result: BankEntry[] = []
  for (const line of text.split('\n').slice(1)) {
    if (!line.trim()) continue
    const p = line.split(';')
    if (p.length < 5) continue
    if (p[4].trim() !== 'C') continue
    result.push({ date: p[0].trim(), desc: p[1].trim(), ref: p[2].trim(), valor: convFloat(p[3]) })
  }
  return result
}

function reconcile(erp: ErpEntry[], bank: BankEntry[]) {
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
    let found = false

    pairLoop: for (let i = 0; i < cands.length && !found; i++) {
      for (let j = i + 1; j < cands.length; j++) {
        if (Math.round(cands[i].valor * 100) + Math.round(cands[j].valor * 100) === target) {
          erpE._used = true
          usedInGroup.add(cands[i]); usedInGroup.add(cands[j])
          matched.push({ type: 'N:1', banks: [cands[i], cands[j]], erp: erpE })
          found = true; break pairLoop
        }
      }
    }

    if (!found) {
      trioLoop: for (let i = 0; i < cands.length && !found; i++) {
        for (let j = i + 1; j < cands.length; j++) {
          for (let k2 = j + 1; k2 < cands.length; k2++) {
            if (Math.round(cands[i].valor*100)+Math.round(cands[j].valor*100)+Math.round(cands[k2].valor*100) === target) {
              erpE._used = true
              usedInGroup.add(cands[i]); usedInGroup.add(cands[j]); usedInGroup.add(cands[k2])
              matched.push({ type: 'N:1', banks: [cands[i], cands[j], cands[k2]], erp: erpE })
              found = true; break trioLoop
            }
          }
        }
      }
    }
  }

  const missing = phase1miss.filter(t => !usedInGroup.has(t))
  const pending = Object.values(erpIdx).flat().filter(e => !e._used)

  missing.sort((a, b) => a.date.localeCompare(b.date))
  matched.sort((a, b) => a.banks[0].date.localeCompare(b.banks[0].date))
  pending.sort((a, b) => a.date.localeCompare(b.date))

  return { missing, matched, pending }
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

    const erp = parseErp(erpText)
    const bank = parseBank(bankText)
    const { missing, matched, pending } = reconcile(erp, bank)

    const s = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

    await logToolUsage(supabase, user.id, 'comparar-extrato', 2)

    return NextResponse.json({
      missing,
      matched,
      pending,
      summary: {
        bankTotal:  s(bank.map(t => t.valor)),
        bankCount:  bank.length,
        okTotal:    s(matched.flatMap(r => r.banks.map(b => b.valor))),
        okCount:    matched.length,
        missTotal:  s(missing.map(t => t.valor)),
        missCount:  missing.length,
        pendTotal:  s(pending.map(t => t.valor)),
        pendCount:  pending.length,
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao processar arquivos.' }, { status: 500 })
  }
}
