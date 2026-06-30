'use client'

import { useState, useCallback, useEffect } from 'react'

const LOJAS = ['L01', 'L02', 'L03', 'L04', 'L05'] as const
const LOJAS_LABELS: Record<string, string> = {
  L01: 'Loja 01',
  L02: 'Loja 02',
  L03: 'Loja 03',
  L04: 'Loja 04',
  L05: 'Loja 05',
}
const BANCOS = ['VIACREDI', 'BRADESCO', 'SANTANDER', 'ITAU'] as const

const DEFAULT_TEMPLATE = `📋 **Resumo Diário — {DATA}**

**Loja 01:** Pag: {L01_PAG} | Saldo: {L01_SALDO} | Dif: {L01_DIF}
**Loja 02:** Pag: {L02_PAG} | Saldo: {L02_SALDO} | Dif: {L02_DIF}
**Loja 03:** Pag: {L03_PAG} | Saldo: {L03_SALDO} | Dif: {L03_DIF}
**Loja 04:** Pag: {L04_PAG} | Saldo: {L04_SALDO} | Dif: {L04_DIF}
**Loja 05:** Pag: {L05_PAG} | Saldo: {L05_SALDO} | Dif: {L05_DIF}`

function getTodayBR(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function parseCurrency(raw: string): number {
  const cleaned = raw.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.')
  const val = parseFloat(cleaned)
  return isNaN(val) ? 0 : val
}

type SaldoRow = Record<typeof BANCOS[number], string>
type PagamentosState = Record<typeof LOJAS[number], string>
type SaldosState = Record<typeof LOJAS[number], SaldoRow>

function emptyPagamentos(): PagamentosState {
  return Object.fromEntries(LOJAS.map((l) => [l, ''])) as PagamentosState
}

function emptySaldos(): SaldosState {
  return Object.fromEntries(
    LOJAS.map((l) => [l, Object.fromEntries(BANCOS.map((b) => [b, ''])) as SaldoRow])
  ) as SaldosState
}

export default function ContasPagarPage() {
  const [data, setData] = useState(getTodayBR())
  const [pagamentos, setPagamentos] = useState<PagamentosState>(emptyPagamentos())
  const [saldos, setSaldos] = useState<SaldosState>(emptySaldos())
  const [webhook, setWebhook] = useState('')
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [testSuccess, setTestSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/ferramentas/settings?tool=contas-pagar')
      .then(async r => {
        const json = await r.json()
        if (!r.ok) { console.error('[Settings] Erro ao carregar:', json); return }
        if (json.settings?.webhook) setWebhook(json.settings.webhook)
        if (json.settings?.template) setTemplate(json.settings.template)
      })
      .catch(e => console.error('[Settings] Falha de rede ao carregar:', e))
  }, [])

  async function handleSaveSettings() {
    setSettingsSaving(true)
    setSettingsMsg(null)
    try {
      const r = await fetch('/api/ferramentas/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'contas-pagar', settings: { webhook, template } }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        console.error('[Settings] Erro ao salvar:', err)
        setSettingsMsg({ type: 'error', text: err?.error ?? 'Erro ao salvar configurações.' })
      } else {
        setSettingsMsg({ type: 'success', text: 'Configurações salvas com sucesso.' })
      }
    } catch (e) {
      console.error('[Settings] Falha de rede ao salvar:', e)
      setSettingsMsg({ type: 'error', text: 'Falha de rede ao salvar.' })
    } finally {
      setSettingsSaving(false)
    }
  }

  const handlePagamento = useCallback((loja: typeof LOJAS[number], value: string) => {
    setPagamentos((prev) => ({ ...prev, [loja]: value }))
  }, [])

  const handleSaldo = useCallback(
    (loja: typeof LOJAS[number], banco: typeof BANCOS[number], value: string) => {
      setSaldos((prev) => ({
        ...prev,
        [loja]: { ...prev[loja], [banco]: value },
      }))
    },
    []
  )

  function buildPayload() {
    const pagamentosNum = Object.fromEntries(
      LOJAS.map((l) => [l, parseCurrency(pagamentos[l])])
    ) as Record<typeof LOJAS[number], number>

    const saldosNum = Object.fromEntries(
      LOJAS.map((l) => [
        l,
        Object.fromEntries(BANCOS.map((b) => [b, parseCurrency(saldos[l][b])])),
      ])
    ) as Record<typeof LOJAS[number], Record<typeof BANCOS[number], number>>

    return {
      webhook,
      template,
      data,
      pagamentos: pagamentosNum,
      saldos: saldosNum,
    }
  }

  async function handleSend() {
    setError(null)
    setSuccess(false)
    if (!webhook.trim()) {
      setError('Informe a URL do Webhook Discord antes de enviar.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ferramentas/contas-pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Erro ${res.status}`)
      }
      setSuccess(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar mensagem.')
    } finally {
      setLoading(false)
    }
  }

  async function handleTest() {
    setTestError(null)
    setTestSuccess(false)
    if (!webhook.trim()) {
      setTestError('Informe a URL do Webhook antes de testar.')
      return
    }
    setTestLoading(true)
    try {
      const res = await fetch('/api/ferramentas/contas-pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook,
          template: '🔔 **Teste de conexão** — Webhook configurado com sucesso.',
          data,
          pagamentos: Object.fromEntries(LOJAS.map((l) => [l, 0])),
          saldos: Object.fromEntries(
            LOJAS.map((l) => [l, Object.fromEntries(BANCOS.map((b) => [b, 0]))])
          ),
          test: true,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Erro ${res.status}`)
      }
      setTestSuccess(true)
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : 'Erro ao testar webhook.')
    } finally {
      setTestLoading(false)
    }
  }

  const inputBase =
    'block w-full text-sm text-gray-900 border border-gray-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow'
  const currencyInput =
    inputBase + ' font-variant-numeric tabular-nums text-right'
  const buttonPrimary =
    'px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer'
  const buttonSecondary =
    'px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="h-[68px] bg-white border-b border-gray-200 px-8 flex items-center">
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Resumo Diário de Pagamentos</h1>
          <p className="text-xs text-gray-400 leading-tight mt-0.5">Preencha os dados e envie o resumo ao canal Discord via webhook.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6 pb-32">

        {/* Section 1: Data de Referência */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1 h-5 bg-blue-500 rounded-full flex-shrink-0" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Data de Referência
            </h2>
          </div>
          <div className="max-w-xs">
            <label className="block text-xs text-gray-500 mb-1.5">Data (DD/MM/AAAA)</label>
            <input
              type="text"
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder="DD/MM/AAAA"
              className={inputBase + ' tabular-nums'}
            />
          </div>
        </section>

        {/* Section 2: Pagamentos por Loja */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1 h-5 bg-blue-500 rounded-full flex-shrink-0" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Pagamentos por Loja
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-32">
                    Loja
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Valor Pago (R$)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {LOJAS.map((loja) => (
                  <tr key={loja} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-gray-700">{LOJAS_LABELS[loja]}</span>
                    </td>
                    <td className="px-3 py-2.5 w-56">
                      <input
                        type="text"
                        value={pagamentos[loja]}
                        onChange={(e) => handlePagamento(loja, e.target.value)}
                        placeholder="0,00"
                        className={currencyInput}
                        inputMode="decimal"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Saldos por Banco */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1 h-5 bg-blue-500 rounded-full flex-shrink-0" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Saldos por Banco
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-28">
                    Loja
                  </th>
                  {BANCOS.map((banco) => (
                    <th
                      key={banco}
                      className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      {banco}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {LOJAS.map((loja) => (
                  <tr key={loja} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-gray-700">{LOJAS_LABELS[loja]}</span>
                    </td>
                    {BANCOS.map((banco) => (
                      <td key={banco} className="px-3 py-2.5">
                        <input
                          type="text"
                          value={saldos[loja][banco]}
                          onChange={(e) => handleSaldo(loja, banco, e.target.value)}
                          placeholder="0,00"
                          className={currencyInput}
                          inputMode="decimal"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Webhook Discord */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1 h-5 bg-blue-500 rounded-full flex-shrink-0" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Webhook Discord
            </h2>
          </div>
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1.5">URL do Webhook</label>
              <input
                type="url"
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className={inputBase}
              />
            </div>
            <div className="pt-6">
              <button
                type="button"
                onClick={handleTest}
                disabled={testLoading}
                className={buttonSecondary}
              >
                {testLoading ? 'Testando…' : 'Testar'}
              </button>
            </div>
          </div>
          {testSuccess && (
            <p className="mt-2 text-sm text-green-700 font-medium">
              Mensagem de teste enviada com sucesso.
            </p>
          )}
          {testError && (
            <p className="mt-2 text-sm text-red-600">{testError}</p>
          )}
        </section>

        {/* Section 5: Template da Mensagem */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="w-1 h-5 bg-blue-500 rounded-full flex-shrink-0" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Template da Mensagem
            </h2>
          </div>
          <p className="text-xs text-gray-400 mb-3 ml-4">
            Placeholders disponíveis:{' '}
            <span className="font-mono">
              {'{DATA}'}, {'{L01_PAG}'}, {'{L01_SALDO}'}, {'{L01_DIF}'}, {'{L01_VIACREDI}'},{' '}
              {'{L01_BRADESCO}'}, {'{L01_SANTANDER}'}, {'{L01_ITAU}'}
            </span>{' '}
            (e mesmo padrão para L02–L05)
          </p>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={10}
            className={
              inputBase +
              ' font-mono text-xs leading-relaxed resize-y min-h-[200px]'
            }
            spellCheck={false}
          />
        </section>
      </div>

      {/* Sticky footer bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="flex-1 text-sm">
            {success && <span className="font-medium text-green-700">Mensagem enviada ao Discord!</span>}
            {error && <span className="text-red-600">{error}</span>}
            {!success && !error && settingsMsg?.type === 'success' && (
              <span className="font-medium text-green-700">{settingsMsg.text}</span>
            )}
            {!success && !error && settingsMsg?.type === 'error' && (
              <span className="text-red-600">{settingsMsg.text}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={settingsSaving}
            className={buttonSecondary}
          >
            {settingsSaving ? 'Salvando…' : 'Salvar Configurações'}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={loading}
            className={buttonPrimary}
          >
            {loading ? 'Enviando…' : 'Enviar ao Discord'}
          </button>
        </div>
      </div>
    </div>
  )
}
