'use client';

import { useState } from 'react';

interface DDAResult {
  beneficiario: string;
  cnpj: string;
  vencimento: string;
  nossoNumero: string;
  valor: number;
  status: 'CONCILIADO' | 'CEDIDO_ALTA' | 'CEDIDO_VERIFICACAO' | 'SEM_MATCH';
  cpFornecedor: string;
  cpDuplicata: string;
  cpValor: number | null;
}

interface DDAResponse {
  results: DDAResult[];
  summary: {
    total: number;
    conciliados: number;
    cedidos: number;
    semMatch: number;
  };
}

const STATUS_CONFIG = {
  CONCILIADO: {
    label: 'Conciliado',
    row: 'bg-green-50',
    badge: 'bg-green-100 text-green-700 border-green-200',
  },
  CEDIDO_ALTA: {
    label: 'Cedido (Alta)',
    row: 'bg-red-50',
    badge: 'bg-red-100 text-red-700 border-red-200',
  },
  CEDIDO_VERIFICACAO: {
    label: 'Cedido (Verif.)',
    row: 'bg-yellow-50',
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  SEM_MATCH: {
    label: 'Sem Match',
    row: 'bg-gray-50',
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
  },
} as const;

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5'
    );
  }
  return cnpj;
}

export default function ComparadorDDAPage() {
  const [txtFile, setTxtFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DDAResponse | null>(null);

  const canProcess = txtFile !== null && csvFile !== null && !loading;

  async function handleProcess() {
    if (!txtFile || !csvFile) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const formData = new FormData();
      formData.append('txt', txtFile);
      formData.append('csv', csvFile);

      const response = await fetch('/api/ferramentas/comparador-dda', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Erro ${response.status}: ${response.statusText}`
        );
      }

      const result: DDAResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro inesperado. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        .comparador-root {
          font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
          color: #0F172A;
          background: #F8FAFC;
          min-height: 100vh;
          padding: 2rem 1.5rem 4rem;
        }

        .page-header {
          margin-bottom: 1.75rem;
        }

        .page-eyebrow {
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748B;
          margin-bottom: 0.375rem;
        }

        .page-title {
          font-size: 1.375rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #0F172A;
          margin: 0 0 0.375rem;
        }

        .page-description {
          font-size: 0.875rem;
          color: #64748B;
          margin: 0;
        }

        .upload-section {
          background: #ffffff;
          border: 1px solid #E2E8F0;
          border-radius: 0.75rem;
          padding: 1.5rem;
          margin-bottom: 1.25rem;
        }

        .upload-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        @media (max-width: 640px) {
          .upload-grid {
            grid-template-columns: 1fr;
          }
        }

        .upload-field {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .field-label {
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #475569;
        }

        .field-hint {
          font-size: 0.6875rem;
          color: #94A3B8;
          margin-top: 0.25rem;
        }

        .file-chosen {
          font-size: 0.75rem;
          color: #1D4ED8;
          font-weight: 500;
          margin-top: 0.25rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .upload-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .btn-primary {
          padding: 0.5rem 1.25rem;
          background: #1D4ED8;
          color: #ffffff;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
        }

        .btn-primary:hover:not(:disabled) {
          background: #1E40AF;
        }

        .btn-primary:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .btn-primary:focus-visible {
          outline: 2px solid #1D4ED8;
          outline-offset: 2px;
        }

        .processing-note {
          font-size: 0.75rem;
          color: #94A3B8;
        }

        /* File input */
        .file-input {
          display: block;
          width: 100%;
          font-size: 0.8125rem;
          color: #334155;
          border: 1px solid #CBD5E1;
          border-radius: 0.5rem;
          padding: 0.375rem 0.5rem;
          background: #F8FAFC;
          cursor: pointer;
          transition: border-color 0.15s;
        }

        .file-input:hover {
          border-color: #94A3B8;
        }

        .file-input:focus-visible {
          outline: 2px solid #1D4ED8;
          outline-offset: 1px;
          border-color: #1D4ED8;
        }

        .file-input::file-selector-button {
          margin-right: 0.625rem;
          padding: 0.25rem 0.75rem;
          border-radius: 0.375rem;
          border: 0;
          font-size: 0.75rem;
          font-weight: 600;
          background: #DBEAFE;
          color: #1D4ED8;
          cursor: pointer;
          transition: background 0.15s;
        }

        .file-input::file-selector-button:hover {
          background: #BFDBFE;
        }

        /* Error */
        .error-box {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          margin-bottom: 1.25rem;
          font-size: 0.875rem;
          color: #B91C1C;
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .error-icon {
          flex-shrink: 0;
          width: 1rem;
          height: 1rem;
          margin-top: 0.0625rem;
        }

        /* Loading */
        .loading-box {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 2rem;
          justify-content: center;
          color: #64748B;
          font-size: 0.875rem;
        }

        .spinner {
          width: 1.25rem;
          height: 1.25rem;
          border: 2px solid #E2E8F0;
          border-top-color: #1D4ED8;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .spinner {
            animation: none;
            border-top-color: #1D4ED8;
          }
        }

        /* KPI cards */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        @media (max-width: 768px) {
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 480px) {
          .kpi-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .kpi-card {
          background: #ffffff;
          border: 1px solid #E2E8F0;
          border-radius: 0.75rem;
          padding: 1rem 1.25rem;
        }

        .kpi-label {
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #94A3B8;
          margin-bottom: 0.375rem;
        }

        .kpi-value {
          font-size: 1.75rem;
          font-weight: 700;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          color: #0F172A;
        }

        .kpi-value.green { color: #15803D; }
        .kpi-value.red   { color: #B91C1C; }
        .kpi-value.gray  { color: #475569; }

        /* Results section */
        .results-section {
          background: #ffffff;
          border: 1px solid #E2E8F0;
          border-radius: 0.75rem;
          overflow: hidden;
        }

        .results-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #E2E8F0;
        }

        .results-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #0F172A;
          margin: 0;
        }

        .results-count {
          font-size: 0.75rem;
          color: #94A3B8;
          font-variant-numeric: tabular-nums;
        }

        .table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8125rem;
        }

        thead th {
          padding: 0.625rem 0.875rem;
          text-align: left;
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #94A3B8;
          background: #F8FAFC;
          border-bottom: 1px solid #E2E8F0;
          white-space: nowrap;
        }

        tbody tr {
          border-bottom: 1px solid #F1F5F9;
          transition: filter 0.1s;
        }

        tbody tr:last-child {
          border-bottom: none;
        }

        tbody td {
          padding: 0.625rem 0.875rem;
          vertical-align: middle;
          white-space: nowrap;
        }

        .td-mono {
          font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
          font-size: 0.75rem;
          font-variant-numeric: tabular-nums;
        }

        .td-beneficiario {
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 500;
          color: #0F172A;
        }

        .td-empty {
          color: #CBD5E1;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.1875rem 0.5rem;
          border-radius: 0.25rem;
          border: 1px solid;
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="h-[68px] bg-white border-b border-gray-200 px-8 flex items-center">
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Comparador DDA</h1>
            <p className="text-xs text-gray-400 leading-tight mt-0.5">Cruza boletos DDA com Contas a Pagar do ERP e classifica cada registro por status de conciliação.</p>
          </div>
        </div>

        <div className="comparador-root" style={{background: 'transparent', minHeight: 'unset'}}>
        <div className="upload-section">
          <div className="upload-grid">
            <div className="upload-field">
              <label htmlFor="file-cp" className="field-label">
                Contas a Pagar (TXT)
              </label>
              <input
                id="file-cp"
                type="file"
                accept=".txt,text/plain"
                className="file-input"
                onChange={(e) => setTxtFile(e.target.files?.[0] ?? null)}
              />
              {txtFile && (
                <span className="file-chosen" title={txtFile.name}>
                  {txtFile.name}
                </span>
              )}
              <span className="field-hint">Exportação do ERP em formato TXT</span>
            </div>

            <div className="upload-field">
              <label htmlFor="file-dda" className="field-label">
                DDA (CSV — separador ;)
              </label>
              <input
                id="file-dda"
                type="file"
                accept=".csv,text/csv,text/plain"
                className="file-input"
                onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              />
              {csvFile && (
                <span className="file-chosen" title={csvFile.name}>
                  {csvFile.name}
                </span>
              )}
              <span className="field-hint">Arquivo DDA com ponto e vírgula como separador</span>
            </div>
          </div>

          <div className="upload-actions">
            <button
              className="btn-primary"
              onClick={handleProcess}
              disabled={!canProcess}
              aria-busy={loading}
            >
              {loading ? 'Processando…' : 'Processar'}
            </button>
            {!canProcess && !loading && (
              <span className="processing-note">
                {!txtFile && !csvFile
                  ? 'Selecione os dois arquivos para continuar.'
                  : !txtFile
                  ? 'Selecione o arquivo TXT de Contas a Pagar.'
                  : 'Selecione o arquivo CSV do DDA.'}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="error-box" role="alert">
            <svg className="error-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="#B91C1C" strokeWidth="1.5" />
              <path d="M8 4.5v4M8 11v.5" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {loading && (
          <div className="loading-box" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            Cruzando registros, aguarde…
          </div>
        )}

        {data && !loading && (
          <>
            <div className="kpi-grid" aria-label="Resumo da conciliação">
              <div className="kpi-card">
                <div className="kpi-label">Total</div>
                <div className="kpi-value">{data.summary.total.toLocaleString('pt-BR')}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Conciliados</div>
                <div className="kpi-value green">{data.summary.conciliados.toLocaleString('pt-BR')}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Cedidos</div>
                <div className="kpi-value red">{data.summary.cedidos.toLocaleString('pt-BR')}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Sem Match</div>
                <div className="kpi-value gray">{data.summary.semMatch.toLocaleString('pt-BR')}</div>
              </div>
            </div>

            <div className="results-section">
              <div className="results-header">
                <h2 className="results-title">Resultado do cruzamento</h2>
                <span className="results-count">
                  {data.results.length} {data.results.length === 1 ? 'registro' : 'registros'}
                </span>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Beneficiário</th>
                      <th scope="col">CNPJ</th>
                      <th scope="col">Vencimento</th>
                      <th scope="col">Nosso Nº</th>
                      <th scope="col">Valor DDA</th>
                      <th scope="col">Status</th>
                      <th scope="col">Fornecedor CP</th>
                      <th scope="col">Duplicata CP</th>
                      <th scope="col">Valor CP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((row, i) => {
                      const cfg = STATUS_CONFIG[row.status];
                      return (
                        <tr key={i} className={cfg.row}>
                          <td className="td-beneficiario" title={row.beneficiario}>
                            {row.beneficiario || <span className="td-empty">—</span>}
                          </td>
                          <td className="td-mono">{formatCNPJ(row.cnpj)}</td>
                          <td className="td-mono">{row.vencimento || <span className="td-empty">—</span>}</td>
                          <td className="td-mono">{row.nossoNumero || <span className="td-empty">—</span>}</td>
                          <td className="td-mono" style={{ textAlign: 'right' }}>
                            {formatCurrency(row.valor)}
                          </td>
                          <td>
                            <span className={`status-badge ${cfg.badge}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td>
                            {row.cpFornecedor || <span className="td-empty">—</span>}
                          </td>
                          <td className="td-mono">
                            {row.cpDuplicata || <span className="td-empty">—</span>}
                          </td>
                          <td className="td-mono" style={{ textAlign: 'right' }}>
                            {row.cpValor !== null ? formatCurrency(row.cpValor) : <span className="td-empty">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </>
  );
}
