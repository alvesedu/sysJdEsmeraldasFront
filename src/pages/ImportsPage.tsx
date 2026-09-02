import { useEffect, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { assertPdfUpload } from '../utils/formWorkflows';
import { formatCents } from '../utils/money';

type ImportStatus = 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'REVIEW_REQUIRED' | 'FAILED';
type Direction = 'CREDIT' | 'DEBIT';
type TransactionType = 'PIX_RECEIVED' | 'PIX_SENT' | 'TRANSFER_RECEIVED' | 'TRANSFER_SENT' | 'OTHER';

type BankImport = {
  importId: string;
  originalFileName: string;
  bank: string;
  period: { startDate: string | null; endDate: string | null };
  status: ImportStatus;
  transactionCount: number;
  insertedTransactions: number;
  duplicateTransactions: number;
  ignoredTransactions: number;
  invalidTransactions: number;
  totalCredits: number;
  totalDebits: number;
  openingBalance: number | null;
  closingBalance: number | null;
  validation: { valid: boolean | null; difference: number | null };
  processingErrors: Array<{ type: string; message: string }>;
  uploadedAt: string;
};

type BankTransaction = {
  _id: string;
  postingDate: string;
  operationDate: string | null;
  operationTime: string | null;
  description: string;
  transactionType: TransactionType;
  counterpartyOriginalName: string | null;
  amount: number;
  direction: Direction;
  processingStatus: 'PENDING' | 'SUGGESTED' | 'CONFIRMED';
};

export function ImportsPage() {
  const [imports, setImports] = useState<BankImport[]>([]);
  const [selectedImport, setSelectedImport] = useState<BankImport | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [direction, setDirection] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .get('/bank-imports')
      .then(({ data }) => {
        if (active) setImports(data.items);
      })
      .catch((caught) => active && setError(apiErrorMessage(caught, 'Não foi possível carregar as importações.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedImport) return;
    let active = true;
    api
      .get(`/bank-imports/${selectedImport.importId}/transactions`, {
        params: {
          direction: direction || undefined,
          transactionType: transactionType || undefined
        }
      })
      .then(({ data }) => {
        if (active) setTransactions(data.items);
      })
      .catch((caught) => active && setError(apiErrorMessage(caught, 'Não foi possível carregar os lançamentos.')));
    return () => {
      active = false;
    };
  }, [direction, selectedImport, transactionType]);

  async function refreshImports() {
    const { data } = await api.get('/bank-imports');
    setImports(data.items);
  }

  async function openImport(importId: string) {
    try {
      const { data } = await api.get(`/bank-imports/${importId}`);
      setSelectedImport(data.item);
      setDirection('');
      setTransactionType('');
      setError('');
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível abrir a importação.'));
    }
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      assertPdfUpload(file);
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post('/imports/bank-import', body);
      setMessage(
        data.duplicateFile
          ? 'Este PDF já havia sido importado. A importação original foi aberta.'
          : `Processamento concluído com status ${statusLabel(data.status)}.`
      );
      setFile(null);
      setShowUploadModal(false);
      await refreshImports();
      await openImport(data.importId);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível processar o PDF.'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Importações bancárias" subtitle="Upload do PDF, processamento e rastreio do extrato." />

      {error ? <div className="alert error">{error}</div> : null}
      {message ? <div className="alert success">{message}</div> : null}

      <section className="panel import-upload-panel">
        <div><p className="eyebrow">Novo extrato</p><h2>Importar PDF bancário</h2><p>Arquivo PDF do Banco do Brasil, com até 10 MB e texto selecionável.</p></div>
        <button className="primary-button" type="button" onClick={() => setShowUploadModal(true)}>Nova importação</button>
      </section>

      {showUploadModal ? (
        <Modal title="Nova importação bancária" subtitle="Envie o PDF do Banco do Brasil para processamento." onClose={() => setShowUploadModal(false)}>
        <form className="upload-form" onSubmit={submitUpload}>
          <label className="file-field">
            Arquivo PDF
            <input
              required
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button className="primary-button" type="submit" disabled={!file || uploading}>
            {uploading ? 'Processando...' : 'Enviar e processar'}
          </button>
        </form>
        </Modal>
      ) : null}

      <section className="panel table-panel">
        <div className="section-heading import-list-heading">
          <div><p className="eyebrow">Histórico</p><h2>Importações processadas</h2></div>
        </div>
        <div className="table-wrap">
          <table className="imports-table">
            <thead><tr><th>Arquivo</th><th>Banco</th><th>Período</th><th>Status</th><th>Lançamentos</th><th>Créditos</th><th>Débitos</th><th>Data</th><th></th></tr></thead>
            <tbody>
              {imports.map((item) => (
                <tr key={item.importId}>
                  <td>{item.originalFileName}</td>
                  <td>{bankLabel(item.bank)}</td>
                  <td>{periodLabel(item.period)}</td>
                  <td><span className={`status import-status-${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span></td>
                  <td>{item.transactionCount}</td>
                  <td>{formatCents(item.totalCredits)}</td>
                  <td>{formatCents(item.totalDebits)}</td>
                  <td>{formatDate(item.uploadedAt)}</td>
                  <td><button className="link-button" onClick={() => openImport(item.importId)}>Abrir</button></td>
                </tr>
              ))}
              {!loading && imports.length === 0 ? <tr><td className="empty-state" colSpan={9}>Nenhuma importação realizada.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {loading ? <p className="loading-text">Carregando importações...</p> : null}
      </section>

      {selectedImport ? (
        <section className="panel operational-panel import-detail">
          <div className="section-heading">
            <div><p className="eyebrow">Importação</p><h2>{selectedImport.originalFileName}</h2><p>{bankLabel(selectedImport.bank)} · {periodLabel(selectedImport.period)}</p></div>
            <button className="ghost-button compact" onClick={() => setSelectedImport(null)}>Fechar</button>
          </div>

          <div className="summary-grid import-summary">
            <StatCard label="Lançamentos" value={String(selectedImport.transactionCount)} hint={`${selectedImport.insertedTransactions} inseridos · ${selectedImport.duplicateTransactions} duplicados`} />
            <StatCard label="Créditos" value={formatCents(selectedImport.totalCredits)} />
            <StatCard label="Débitos" value={formatCents(selectedImport.totalDebits)} />
            <StatCard label="Saldo inicial" value={nullableMoney(selectedImport.openingBalance)} />
            <StatCard label="Saldo final" value={nullableMoney(selectedImport.closingBalance)} />
            <StatCard label="Validação" value={validationLabel(selectedImport)} hint={selectedImport.validation.difference ? `Diferença: ${formatCents(selectedImport.validation.difference)}` : undefined} />
          </div>

          {selectedImport.processingErrors.length > 0 ? (
            <div className="processing-errors">
              <strong>Pontos para revisão</strong>
              {selectedImport.processingErrors.map((item, index) => <p key={`${item.type}-${index}`}>{item.message}</p>)}
            </div>
          ) : null}

          <div className="toolbar transaction-filters">
            <label>Direção<select value={direction} onChange={(event) => setDirection(event.target.value)}><option value="">Todas</option><option value="CREDIT">Crédito</option><option value="DEBIT">Débito</option></select></label>
            <label>Tipo<select value={transactionType} onChange={(event) => setTransactionType(event.target.value)}><option value="">Todos</option><option value="PIX_RECEIVED">Pix recebido</option><option value="PIX_SENT">Pix enviado</option><option value="TRANSFER_RECEIVED">Transferência recebida</option><option value="TRANSFER_SENT">Transferência enviada</option><option value="OTHER">Outro</option></select></label>
          </div>

          <div className="table-wrap transaction-table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Operação</th><th>Tipo</th><th>Descrição</th><th>Contraparte</th><th>Crédito</th><th>Débito</th><th>Status</th></tr></thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction._id}>
                    <td>{formatDate(transaction.postingDate)}</td>
                    <td>{operationLabel(transaction)}</td>
                    <td>{transactionTypeLabel(transaction.transactionType)}</td>
                    <td>{transaction.description}</td>
                    <td>{transaction.counterpartyOriginalName || 'Não informada'}</td>
                    <td className="money-credit">{transaction.direction === 'CREDIT' ? formatCents(transaction.amount) : '—'}</td>
                    <td className="money-debit">{transaction.direction === 'DEBIT' ? formatCents(transaction.amount) : '—'}</td>
                    <td><span className="status status-pending">{transaction.processingStatus === 'PENDING' ? 'Não conciliado' : transaction.processingStatus}</span></td>
                  </tr>
                ))}
                {transactions.length === 0 ? <tr><td className="empty-state" colSpan={8}>Nenhum lançamento para os filtros selecionados.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function statusLabel(status: ImportStatus) {
  return { UPLOADED: 'Enviado', PROCESSING: 'Processando', PROCESSED: 'Processado', REVIEW_REQUIRED: 'Revisão necessária', FAILED: 'Falhou' }[status];
}

function bankLabel(bank: string) {
  return bank === 'BANCO_DO_BRASIL' ? 'Banco do Brasil' : bank;
}

function periodLabel(period: BankImport['period']) {
  return period.startDate && period.endDate ? `${formatDate(period.startDate)} a ${formatDate(period.endDate)}` : 'Não identificado';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function nullableMoney(value: number | null) {
  return value === null ? 'Não informado' : formatCents(value);
}

function validationLabel(item: BankImport) {
  if (item.validation.valid === null) return 'Não disponível';
  return item.validation.valid ? 'Saldo confere' : 'Divergência';
}

function operationLabel(transaction: BankTransaction) {
  if (!transaction.operationDate) return 'Não informada';
  return `${formatDate(transaction.operationDate)}${transaction.operationTime ? ` ${transaction.operationTime}` : ''}`;
}

function transactionTypeLabel(type: TransactionType) {
  return { PIX_RECEIVED: 'Pix recebido', PIX_SENT: 'Pix enviado', TRANSFER_RECEIVED: 'Transferência recebida', TRANSFER_SENT: 'Transferência enviada', OTHER: 'Outro' }[type];
}
