'use client';

import { useState, useRef, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, TableCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/ui/kpi-card';
import { FileInput } from '@/components/ui/file-input';
import { Spinner } from '@/components/ui/spinner';
import { TH_CLASS } from '@/components/ui/table';

interface ResultRow {
  nome: string;
  status: string;
  acao: string;
  origem: string;
}

interface Summary {
  total: number;
  emAmbos: number;
  soPdf: number;
  soXlsx: number;
  inclusoes: number;
  exclusoes: number;
}

interface ApiResponse {
  results: ResultRow[];
  summary: Summary;
}

function getRowStyle(status: string): string {
  switch (status) {
    case 'ATIVO':
    case 'OK':
      return 'bg-green-50 text-green-700';
    case 'SOMENTE_PDF':
      return 'bg-orange-50 text-orange-700';
    case 'SOMENTE_XLSX':
      return 'bg-blue-50 text-blue-700';
    case 'INCLUSAO':
      return 'bg-yellow-50 text-yellow-700';
    case 'EXCLUSAO':
      return 'bg-red-50 text-red-700';
    default:
      return 'bg-gray-50 text-gray-700';
  }
}

const STATUS_TONE: Record<string, 'green' | 'orange' | 'blue' | 'yellow' | 'red' | 'gray'> = {
  ATIVO: 'green',
  OK: 'green',
  SOMENTE_PDF: 'orange',
  SOMENTE_XLSX: 'blue',
  INCLUSAO: 'yellow',
  EXCLUSAO: 'red',
};

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    ATIVO: 'Ativo',
    OK: 'OK',
    SOMENTE_PDF: 'Só PDF',
    SOMENTE_XLSX: 'Só Planilha',
    INCLUSAO: 'Inclusão',
    EXCLUSAO: 'Exclusão',
  };
  return labels[status] ?? status;
}

export default function SeguroVidaPage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [coluna, setColuna] = useState('A');
  const [linhaInicial, setLinhaInicial] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const pdfRef = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/ferramentas/settings?tool=seguro-vida')
      .then(async r => {
        const json = await r.json();
        if (!r.ok) { console.error('[Settings] Erro ao carregar:', json); return; }
        if (json.settings?.coluna) setColuna(json.settings.coluna);
        if (json.settings?.linhaInicial) setLinhaInicial(json.settings.linhaInicial);
      })
      .catch(e => console.error('[Settings] Falha de rede ao carregar:', e));
  }, []);

  async function handleSaveSettings() {
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      const r = await fetch('/api/ferramentas/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'seguro-vida', settings: { coluna, linhaInicial } }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        console.error('[Settings] Erro ao salvar:', err);
        setSettingsMsg({ type: 'error', text: err?.error ?? 'Erro ao salvar.' });
      } else {
        setSettingsMsg({ type: 'success', text: 'Salvo!' });
      }
    } catch (e) {
      console.error('[Settings] Falha de rede ao salvar:', e);
      setSettingsMsg({ type: 'error', text: 'Falha de rede.' });
    } finally {
      setSettingsSaving(false);
    }
  }

  const canProcess = pdfFile !== null && xlsxFile !== null && !loading;

  async function handleProcess() {
    if (!pdfFile || !xlsxFile) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('xlsx', xlsxFile);
      formData.append('coluna', coluna || 'A');
      formData.append('linhaInicial', linhaInicial || '1');

      const response = await fetch('/api/ferramentas/seguro-vida', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Erro ${response.status}`);
      }

      const json: ApiResponse = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido ao processar os arquivos.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPdfFile(null);
    setXlsxFile(null);
    setData(null);
    setError(null);
    if (pdfRef.current) pdfRef.current.value = '';
    if (xlsxRef.current) xlsxRef.current.value = '';
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="Seguro de Vida" subtitle="Cruzamento entre o relatório do seguro (PDF) e a planilha de funcionários (XLSX)." />

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">

        <Card padding="5" className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Arquivos</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FileInput
              ref={pdfRef}
              label="Relatório Seguro (PDF)"
              accept=".pdf,application/pdf"
              file={pdfFile}
              onChange={setPdfFile}
            />
            <FileInput
              ref={xlsxRef}
              label="Planilha Funcionários (XLSX)"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              file={xlsxFile}
              onChange={setXlsxFile}
            />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                Coluna dos nomes
              </label>
              <input
                type="text"
                value={coluna}
                maxLength={3}
                onChange={(e) => setColuna(e.target.value.toUpperCase())}
                placeholder="A"
                className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                Linha inicial
              </label>
              <input
                type="text"
                value={linhaInicial}
                maxLength={6}
                onChange={(e) => setLinhaInicial(e.target.value.replace(/\D/g, ''))}
                placeholder="1"
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tabular-nums"
              />
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              {settingsMsg && (
                <span className={`text-xs font-medium ${settingsMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                  {settingsMsg.text}
                </span>
              )}
              <Button type="button" variant="secondary" onClick={handleSaveSettings} loading={settingsSaving}>
                {settingsSaving ? 'Salvando…' : 'Salvar Configurações'}
              </Button>
              <Button onClick={handleProcess} disabled={!canProcess} loading={loading}>
                {loading ? 'Processando…' : 'Processar'}
              </Button>
              {(pdfFile || xlsxFile || data || error) && !loading && (
                <Button variant="ghost" onClick={handleReset}>Limpar</Button>
              )}
            </div>
          </div>
        </Card>

        {loading && (
          <div className="flex items-center justify-center gap-3 py-12">
            <Spinner size="lg" className="text-blue-600" />
            <span className="text-sm text-gray-500">Processando arquivos…</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-fade-in-up">
            <p className="text-sm font-medium text-red-800">Erro ao processar</p>
            <p className="text-sm text-red-700 mt-0.5">{error}</p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-5">

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <KpiCard label="Em Ambos" value={data.summary.emAmbos} accent="#16a34a" />
              <KpiCard label="Só PDF" value={data.summary.soPdf} accent="#ea580c" />
              <KpiCard label="Só Planilha" value={data.summary.soXlsx} accent="#2563eb" />
              <KpiCard label="Inclusões" value={data.summary.inclusoes} accent="#f59e0b" />
              <KpiCard label="Exclusões" value={data.summary.exclusoes} accent="#dc2626" />
            </div>

            <TableCard>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                  Resultados
                </h2>
                <span className="text-xs text-gray-400 tabular-nums">
                  {data.results.length.toLocaleString('pt-BR')}{' '}
                  {data.results.length === 1 ? 'registro' : 'registros'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className={TH_CLASS}>Nome</th>
                      <th className={TH_CLASS}>Status</th>
                      <th className={TH_CLASS}>Ação</th>
                      <th className={TH_CLASS}>Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.results.map((row, i) => (
                      <tr
                        key={i}
                        className={`${getRowStyle(row.status)} transition-colors`}
                      >
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {row.nome}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge tone={STATUS_TONE[row.status] ?? 'gray'}>{formatStatus(row.status)}</Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.acao || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {row.origem || '—'}
                        </td>
                      </tr>
                    ))}

                    {data.results.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-10 text-center text-sm text-gray-400"
                        >
                          Nenhum resultado encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TableCard>
          </div>
        )}
      </div>
    </div>
  );
}
