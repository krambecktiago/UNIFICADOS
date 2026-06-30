'use client';

import { useState, useRef } from 'react';

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

function getStatusBadge(status: string): string {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ';
  switch (status) {
    case 'ATIVO':
    case 'OK':
      return base + 'bg-green-100 text-green-800';
    case 'SOMENTE_PDF':
      return base + 'bg-orange-100 text-orange-800';
    case 'SOMENTE_XLSX':
      return base + 'bg-blue-100 text-blue-800';
    case 'INCLUSAO':
      return base + 'bg-yellow-100 text-yellow-800';
    case 'EXCLUSAO':
      return base + 'bg-red-100 text-red-800';
    default:
      return base + 'bg-gray-100 text-gray-800';
  }
}

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

interface KpiCardProps {
  label: string;
  value: number;
  accent?: string;
}

function KpiCard({ label, value, accent = 'text-gray-900' }: KpiCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1 min-w-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
        {label}
      </span>
      <span className={`text-2xl font-semibold tabular-nums ${accent}`}>
        {value.toLocaleString('pt-BR')}
      </span>
    </div>
  );
}

export default function SeguroVidaPage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [coluna, setColuna] = useState('A');
  const [linhaInicial, setLinhaInicial] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const pdfRef = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);

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

  const fileInputClass =
    'block w-full text-sm text-gray-900 border border-gray-300 rounded-lg p-2 bg-white ' +
    'file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium ' +
    'file:bg-blue-50 file:text-blue-700 cursor-pointer';

  const buttonClass =
    'px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium ' +
    'hover:bg-blue-700 disabled:opacity-50 transition-colors';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="h-[68px] bg-white border-b border-gray-200 px-8 flex items-center">
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Seguro de Vida</h1>
          <p className="text-xs text-gray-400 leading-tight mt-0.5">Cruzamento entre o relatório do seguro (PDF) e a planilha de funcionários (XLSX).</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">

        {/* Upload panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Arquivos
          </h2>

          {/* File inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                Relatório Seguro (PDF)
              </label>
              <input
                ref={pdfRef}
                type="file"
                accept=".pdf,application/pdf"
                className={fileInputClass}
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
              {pdfFile && (
                <p className="text-xs text-gray-400 truncate">{pdfFile.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                Planilha Funcionários (XLSX)
              </label>
              <input
                ref={xlsxRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className={fileInputClass}
                onChange={(e) => setXlsxFile(e.target.files?.[0] ?? null)}
              />
              {xlsxFile && (
                <p className="text-xs text-gray-400 truncate">{xlsxFile.name}</p>
              )}
            </div>
          </div>

          {/* Config row */}
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

            <button
              onClick={handleProcess}
              disabled={!canProcess}
              className={buttonClass}
            >
              {loading ? 'Processando…' : 'Processar'}
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-12">
            <svg
              className="animate-spin h-5 w-5 text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <span className="text-sm text-gray-500">Processando arquivos…</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-medium text-red-800">Erro ao processar</p>
            <p className="text-sm text-red-700 mt-0.5">{error}</p>
          </div>
        )}

        {/* Results */}
        {data && !loading && (
          <div className="space-y-5">

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <KpiCard
                label="Em Ambos"
                value={data.summary.emAmbos}
                accent="text-green-700"
              />
              <KpiCard
                label="Só PDF"
                value={data.summary.soPdf}
                accent="text-orange-700"
              />
              <KpiCard
                label="Só Planilha"
                value={data.summary.soXlsx}
                accent="text-blue-700"
              />
              <KpiCard
                label="Inclusões"
                value={data.summary.inclusoes}
                accent="text-yellow-700"
              />
              <KpiCard
                label="Exclusões"
                value={data.summary.exclusoes}
                accent="text-red-700"
              />
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Nome
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Ação
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Origem
                      </th>
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
                          <span className={getStatusBadge(row.status)}>
                            {formatStatus(row.status)}
                          </span>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
