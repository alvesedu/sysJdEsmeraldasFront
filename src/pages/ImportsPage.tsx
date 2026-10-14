import { useEffect, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { assertPdfUpload } from '../utils/formWorkflows';
import { formatCents } from '../utils/money';
import { AlertCircle, CheckCircle2, Eye, FileUp, ShieldCheck, UploadCloud, WalletCards, X } from 'lucide-react';

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

const fieldClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const labelClass = 'text-sm font-semibold text-slate-300';
const primaryActionClass = 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:scale-[1.01] hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100';
const ghostActionClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-slate-200 transition hover:border-amber-300/35 hover:bg-amber-300/10';
const iconActionClass = 'inline-grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100';

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(247,185,85,0.16),_transparent_34%),linear-gradient(135deg,_#07111f_0%,_#0f172a_54%,_#0b1324_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Extratos bancários
                </span>
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Importações bancárias</h1>
                  <p className="text-base leading-7 text-slate-300 sm:text-lg">Envie PDFs do Banco do Brasil, acompanhe processamento e rastreie créditos, débitos e validação de saldo.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <ImportMetric icon={FileUp} label="Importações" value={`${imports.length}`} hint="Arquivos enviados" />
                <ImportMetric icon={CheckCircle2} label="Processadas" value={`${imports.filter((item) => item.status === 'PROCESSED').length}`} hint="Sem revisão pendente" />
                <ImportMetric icon={WalletCards} label="Créditos" value={formatCents(imports.reduce((sum, item) => sum + item.totalCredits, 0))} hint="Total filtrado" />
              </div>
            </div>

            <Card className="border-white/10 bg-slate-950/45 text-white shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <UploadCloud className="h-4 w-4 text-amber-300" />
                  Novo extrato
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm font-semibold text-white">Importar PDF bancário</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Arquivo PDF do Banco do Brasil, com até 10 MB e texto selecionável.</p>
                </div>
                <button className={primaryActionClass} type="button" onClick={() => setShowUploadModal(true)}><UploadCloud className="h-4 w-4" />Nova importação</button>
              </CardContent>
            </Card>
          </div>
        </section>

        {error ? (
          <Alert variant="destructive" className="border-red-400/30 bg-red-950/50 text-red-100">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {message ? (
          <Alert className="border-emerald-300/25 bg-emerald-400/10 text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

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

        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Histórico</p>
              <CardTitle className="mt-2 text-xl text-white">Importações processadas</CardTitle>
            </div>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">{imports.length}</span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-16 rounded-2xl bg-white/10" key={index} />)}</div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-[1180px] w-full border-collapse text-left">
                    <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400">
                      <tr><th className="px-4 py-4">Arquivo</th><th className="px-4 py-4">Banco</th><th className="px-4 py-4">Período</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Lançamentos</th><th className="px-4 py-4">Créditos</th><th className="px-4 py-4">Débitos</th><th className="px-4 py-4">Data</th><th className="px-4 py-4 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {imports.map((item) => (
                        <tr className="bg-white/[0.025] transition hover:bg-amber-300/5" key={item.importId}>
                          <td className="px-4 py-4 font-bold text-white">{item.originalFileName}</td>
                          <td className="px-4 py-4 text-slate-300">{bankLabel(item.bank)}</td>
                          <td className="px-4 py-4 text-slate-300">{periodLabel(item.period)}</td>
                          <td className="px-4 py-4"><ImportStatusPill status={item.status} /></td>
                          <td className="px-4 py-4 text-slate-300">{item.transactionCount}</td>
                          <td className="px-4 py-4 font-bold text-emerald-100">{formatCents(item.totalCredits)}</td>
                          <td className="px-4 py-4 font-bold text-red-100">{formatCents(item.totalDebits)}</td>
                          <td className="px-4 py-4 text-slate-300">{formatDate(item.uploadedAt)}</td>
                          <td className="px-4 py-4"><div className="flex justify-end"><button className={iconActionClass} onClick={() => openImport(item.importId)} title="Abrir" type="button" aria-label={`Abrir importação ${item.originalFileName}`}><Eye size={16} /></button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {imports.length === 0 ? <div className="p-8 text-center text-slate-300">Nenhuma importação realizada.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>

      {selectedImport ? (
        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Importação</p>
              <CardTitle className="mt-2 truncate text-xl text-white">{selectedImport.originalFileName}</CardTitle>
              <p className="mt-2 text-sm text-slate-400">{bankLabel(selectedImport.bank)} · {periodLabel(selectedImport.period)}</p>
            </div>
            <button className={ghostActionClass} onClick={() => setSelectedImport(null)} type="button"><X className="h-4 w-4" />Fechar</button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ImportSummaryTile label="Lançamentos" value={String(selectedImport.transactionCount)} hint={`${selectedImport.insertedTransactions} inseridos · ${selectedImport.duplicateTransactions} duplicados`} />
              <ImportSummaryTile label="Créditos" value={formatCents(selectedImport.totalCredits)} tone="success" />
              <ImportSummaryTile label="Débitos" value={formatCents(selectedImport.totalDebits)} tone="danger" />
              <ImportSummaryTile label="Saldo inicial" value={nullableMoney(selectedImport.openingBalance)} />
              <ImportSummaryTile label="Saldo final" value={nullableMoney(selectedImport.closingBalance)} />
              <ImportSummaryTile label="Validação" value={validationLabel(selectedImport)} hint={selectedImport.validation.difference ? `Diferença: ${formatCents(selectedImport.validation.difference)}` : undefined} tone={selectedImport.validation.valid ? 'success' : selectedImport.validation.valid === false ? 'danger' : 'default'} />
            </div>

          {selectedImport.processingErrors.length > 0 ? (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-amber-50">
              <strong>Pontos para revisão</strong>
              {selectedImport.processingErrors.map((item, index) => <p key={`${item.type}-${index}`}>{item.message}</p>)}
            </div>
          ) : null}

          <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:grid-cols-2">
            <label className={labelClass}>Direção<select className={fieldClass} value={direction} onChange={(event) => setDirection(event.target.value)}><option value="">Todas</option><option value="CREDIT">Crédito</option><option value="DEBIT">Débito</option></select></label>
            <label className={labelClass}>Tipo<select className={fieldClass} value={transactionType} onChange={(event) => setTransactionType(event.target.value)}><option value="">Todos</option><option value="PIX_RECEIVED">Pix recebido</option><option value="PIX_SENT">Pix enviado</option><option value="TRANSFER_RECEIVED">Transferência recebida</option><option value="TRANSFER_SENT">Transferência enviada</option><option value="OTHER">Outro</option></select></label>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full border-collapse text-left">
                <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400"><tr><th className="px-4 py-4">Data</th><th className="px-4 py-4">Operação</th><th className="px-4 py-4">Tipo</th><th className="px-4 py-4">Descrição</th><th className="px-4 py-4">Contraparte</th><th className="px-4 py-4">Crédito</th><th className="px-4 py-4">Débito</th><th className="px-4 py-4">Status</th></tr></thead>
                <tbody className="divide-y divide-white/10">
                  {transactions.map((transaction) => (
                    <tr className="bg-white/[0.025] transition hover:bg-amber-300/5" key={transaction._id}>
                      <td className="px-4 py-4 text-slate-300">{formatDate(transaction.postingDate)}</td>
                      <td className="px-4 py-4 text-slate-300">{operationLabel(transaction)}</td>
                      <td className="px-4 py-4 text-slate-300">{transactionTypeLabel(transaction.transactionType)}</td>
                      <td className="px-4 py-4 font-medium text-white">{transaction.description}</td>
                      <td className="px-4 py-4 text-slate-300">{transaction.counterpartyOriginalName || 'Não informada'}</td>
                      <td className="px-4 py-4 font-bold text-emerald-100">{transaction.direction === 'CREDIT' ? formatCents(transaction.amount) : '-'}</td>
                      <td className="px-4 py-4 font-bold text-red-100">{transaction.direction === 'DEBIT' ? formatCents(transaction.amount) : '-'}</td>
                      <td className="px-4 py-4"><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-100">{transaction.processingStatus === 'PENDING' ? 'Não conciliado' : transaction.processingStatus}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {transactions.length === 0 ? <div className="p-8 text-center text-slate-300">Nenhum lançamento para os filtros selecionados.</div> : null}
          </div>
          </CardContent>
        </Card>
      ) : null}
      </div>
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

type ImportMetricProps = {
  icon: typeof FileUp;
  label: string;
  value: string;
  hint: string;
};

function ImportMetric({ icon: Icon, label, value, hint }: ImportMetricProps) {
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">{label}</p>
        <Icon className="h-4 w-4 text-amber-200" />
      </div>
      <strong className="mt-2 block truncate text-2xl font-black text-white">{value}</strong>
      <span className="mt-1 block text-sm text-slate-300">{hint}</span>
    </div>
  );
}

function ImportStatusPill({ status }: { status: ImportStatus }) {
  const tone = {
    UPLOADED: 'border-blue-300/20 bg-blue-300/10 text-blue-100',
    PROCESSING: 'border-blue-300/20 bg-blue-300/10 text-blue-100',
    PROCESSED: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    REVIEW_REQUIRED: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    FAILED: 'border-red-300/25 bg-red-400/10 text-red-100'
  }[status];

  return <span className={cn('rounded-full border px-2 py-1 text-xs font-black uppercase tracking-[0.12em]', tone)}>{statusLabel(status)}</span>;
}

function ImportSummaryTile({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: 'default' | 'success' | 'danger' }) {
  const toneClass = {
    default: 'border-white/10 bg-white/[0.04] text-white',
    success: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    danger: 'border-red-300/25 bg-red-400/10 text-red-100'
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <strong className="mt-2 block text-lg font-black text-white">{value}</strong>
      {hint ? <small className="mt-1 block text-slate-400">{hint}</small> : null}
    </div>
  );
}
