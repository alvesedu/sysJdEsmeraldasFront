import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { currentCompetence, formatCompetence } from '../utils/competence';
import { buildExpensePayload } from '../utils/formWorkflows';
import { formatCents } from '../utils/money';
import type { BankTransaction, Category, Expense } from '../types/domain';
import { AlertCircle, CheckCircle2, FileText, Paperclip, Pencil, Plus, Receipt, Search, ShieldCheck, Trash2, WalletCards } from 'lucide-react';

type ExpenseForm = {
  bankTransactionId: string;
  categoryId: string;
  beneficiary: string;
  description: string;
  competence: string;
  notes: string;
  attachmentUrl: string;
  classificationStatus: 'PENDING' | 'SUGGESTED' | 'CONFIRMED';
};

const emptyForm = (): ExpenseForm => ({
  bankTransactionId: '',
  categoryId: '',
  beneficiary: '',
  description: '',
  competence: currentCompetence(),
  notes: '',
  attachmentUrl: '',
  classificationStatus: 'CONFIRMED'
});
const fieldClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const labelClass = 'text-sm font-semibold text-slate-300';
const primaryActionClass = 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:scale-[1.01] hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100';
const iconActionClass = 'inline-grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40';

export function ExpensesPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [debits, setDebits] = useState<BankTransaction[]>([]);
  const [summary, setSummary] = useState({ total: 0, confirmed: 0, pendingCount: 0 });
  const [filters, setFilters] = useState({ competence: currentCompetence(), categoryId: '', classificationStatus: '', beneficiary: '' });
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadExpenses() {
    const { data } = await api.get('/expenses', { params: cleanParams(filters) });
    setItems(data.items);
    setSummary(data.summary);
    setError('');
  }

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/lookups/categories'), api.get('/bank-imports')])
      .then(async ([categoryResponse, importResponse]) => {
        const imports = importResponse.data.items as Array<{ importId: string }>;
        const transactions = await Promise.all(imports.slice(0, 8).map((item) => api.get(`/bank-imports/${item.importId}/transactions`, { params: { direction: 'DEBIT' } })));
        if (!active) return;
        setCategories(categoryResponse.data.items);
        setDebits(transactions.flatMap((response) => response.data.items));
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar categorias e débitos bancários.'));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/expenses', { params: cleanParams(filters) })
      .then(({ data }) => {
        if (!active) return;
        setItems(data.items);
        setSummary(data.summary);
        setError('');
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar despesas.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters]);

  function changeFilter(next: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...next }));
    setLoading(true);
  }

  function startCreate(transaction?: BankTransaction) {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      bankTransactionId: transaction?._id ?? '',
      beneficiary: transaction?.counterpartyOriginalName ?? '',
      description: transaction?.description ?? '',
      competence: filters.competence || currentCompetence()
    });
    setAttachmentFile(null);
    setShowForm(true);
    setMessage('');
  }

  function startEdit(expense: Expense) {
    const transaction = transactionOf(expense);
    setEditingId(expense._id);
    setForm({
      bankTransactionId: transaction?._id ?? '',
      categoryId: categoryIdOf(expense),
      beneficiary: expense.beneficiary,
      description: expense.description,
      competence: expense.competence,
      notes: expense.notes ?? '',
      attachmentUrl: expense.attachmentUrl ?? '',
      classificationStatus: expense.classificationStatus
    });
    setAttachmentFile(null);
    setShowForm(true);
    setMessage('');
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const payload = buildExpensePayload(form);
      const response = editingId
        ? await api.patch(`/expenses/${editingId}`, payload)
        : await api.post('/expenses', payload);
      if (attachmentFile) {
        const upload = new FormData();
        upload.append('file', attachmentFile);
        await api.post(`/expenses/${response.data.item._id}/attachment`, upload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      setShowForm(false);
      setAttachmentFile(null);
      setMessage(attachmentFile ? 'Despesa e anexo salvos.' : editingId ? 'Despesa atualizada.' : 'Despesa cadastrada.');
      await loadExpenses();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível salvar a despesa.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function removeExpense() {
    if (!expenseToDelete) return;
    setSubmitting(true);
    try {
      await api.delete(`/expenses/${expenseToDelete._id}`);
      setExpenseToDelete(null);
      setMessage('Despesa removida.');
      await loadExpenses();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível remover a despesa.'));
    } finally {
      setSubmitting(false);
    }
  }

  const unclassifiedDebits = useMemo(() => {
    const classifiedIds = new Set(items.map((item) => transactionOf(item)?._id).filter(Boolean));
    return debits.filter((transaction) => !classifiedIds.has(transaction._id));
  }, [debits, items]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(247,185,85,0.16),_transparent_34%),linear-gradient(135deg,_#07111f_0%,_#0f172a_54%,_#0b1324_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Saídas e classificação
                </span>
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Despesas</h1>
                  <p className="text-base leading-7 text-slate-300 sm:text-lg">Classifique débitos bancários, registre favorecidos e mantenha anexos vinculados às despesas.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <ExpenseMetric icon={Receipt} label="Classificado" value={formatCents(summary.total)} hint="Total filtrado" />
                <ExpenseMetric icon={CheckCircle2} label="Confirmado" value={formatCents(summary.confirmed)} hint="Validação final" />
                <ExpenseMetric icon={WalletCards} label="Pendências" value={`${summary.pendingCount}`} hint="A revisar" />
              </div>
            </div>
            <Card className="border-white/10 bg-slate-950/45 text-white shadow-none">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base text-white"><Search className="h-4 w-4 text-amber-300" />Filtros e ações</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>Competência<input className={fieldClass} type="month" value={filters.competence} onChange={(event) => changeFilter({ competence: event.target.value })} /></label>
                  <label className={labelClass}>Categoria<select className={fieldClass} value={filters.categoryId} onChange={(event) => changeFilter({ categoryId: event.target.value })}><option value="">Todas</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
                  <label className={labelClass}>Status<select className={fieldClass} value={filters.classificationStatus} onChange={(event) => changeFilter({ classificationStatus: event.target.value })}><option value="">Todos</option><option value="PENDING">Pendente</option><option value="SUGGESTED">Sugerida</option><option value="CONFIRMED">Confirmada</option></select></label>
                  <label className={labelClass}>Favorecido<input className={fieldClass} value={filters.beneficiary} onChange={(event) => changeFilter({ beneficiary: event.target.value })} placeholder="Fornecedor ou favorecido" /></label>
                </div>
                <button className={primaryActionClass} onClick={() => startCreate()} type="button"><Plus className="h-4 w-4" />Nova despesa</button>
              </CardContent>
            </Card>
          </div>
        </section>

        {error ? <Alert variant="destructive" className="border-red-400/30 bg-red-950/50 text-red-100"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}
        {message ? <Alert className="border-emerald-300/25 bg-emerald-400/10 text-emerald-100"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert> : null}

        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div><p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Débitos sem despesa</p><CardTitle className="mt-2 text-xl text-white">Importações bancárias</CardTitle></div>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">{unclassifiedDebits.length}</span>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-3xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="min-w-[840px] w-full border-collapse text-left">
                  <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400"><tr><th className="px-4 py-4">Data</th><th className="px-4 py-4">Descrição</th><th className="px-4 py-4">Favorecido</th><th className="px-4 py-4">Valor</th><th className="px-4 py-4 text-right">Ação</th></tr></thead>
                  <tbody className="divide-y divide-white/10">
                    {unclassifiedDebits.slice(0, 10).map((transaction) => (
                      <tr className="bg-white/[0.025] transition hover:bg-amber-300/5" key={transaction._id}>
                        <td className="px-4 py-4 text-slate-300">{formatDate(transaction.operationDate ?? transaction.postingDate)}</td><td className="px-4 py-4 font-medium text-white">{transaction.description}</td><td className="px-4 py-4 text-slate-300">{transaction.counterpartyOriginalName ?? 'Não informado'}</td><td className="px-4 py-4 font-bold text-red-100">{formatCents(transaction.amount)}</td>
                        <td className="px-4 py-4"><div className="flex justify-end"><button className={iconActionClass} onClick={() => startCreate(transaction)} title="Classificar" type="button" aria-label={`Classificar débito ${transaction.description}`}><FileText size={16} /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {unclassifiedDebits.length === 0 ? <div className="p-8 text-center text-slate-300">Nenhum débito bancário pendente encontrado.</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div><p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Histórico</p><CardTitle className="mt-2 text-xl text-white">Despesas classificadas</CardTitle></div>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">{items.length}</span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-16 rounded-2xl bg-white/10" key={index} />)}</div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-[1080px] w-full border-collapse text-left">
                    <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400"><tr><th className="px-4 py-4">Competência</th><th className="px-4 py-4">Favorecido</th><th className="px-4 py-4">Descrição</th><th className="px-4 py-4">Categoria</th><th className="px-4 py-4">Valor</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Anexo</th><th className="px-4 py-4 text-right">Ações</th></tr></thead>
                    <tbody className="divide-y divide-white/10">
                      {items.map((expense) => {
                        const transaction = transactionOf(expense);
                        return (
                          <tr className="bg-white/[0.025] transition hover:bg-amber-300/5" key={expense._id}>
                            <td className="px-4 py-4 text-slate-300">{formatCompetence(expense.competence)}</td><td className="px-4 py-4 font-bold text-white">{expense.beneficiary}</td><td className="px-4 py-4 text-slate-300">{expense.description}</td><td className="px-4 py-4 text-slate-300">{categoryNameOf(expense)}</td><td className="px-4 py-4 font-bold text-red-100">{formatCents(transaction?.amount ?? 0)}</td>
                            <td className="px-4 py-4"><StatusBadge value={expense.classificationStatus} label={statusLabel(expense.classificationStatus)} /></td>
                            <td className="px-4 py-4">{expense.attachmentUrl ? <a className="inline-flex items-center gap-2 text-sm font-bold text-amber-100 hover:text-amber-200" href={attachmentHref(expense.attachmentUrl)} target="_blank" rel="noreferrer"><Paperclip size={14} />Abrir</a> : <span className="text-slate-400">Sem anexo</span>}</td>
                            <td className="px-4 py-4"><div className="flex justify-end gap-2"><button className={iconActionClass} onClick={() => startEdit(expense)} title="Editar" type="button"><Pencil size={16} /></button><button className={iconActionClass} onClick={() => setExpenseToDelete(expense)} title="Remover" type="button"><Trash2 size={16} /></button></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {items.length === 0 ? <div className="p-8 text-center text-slate-300">Nenhuma despesa encontrada.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>

      {showForm ? (
        <Modal title={editingId ? 'Editar despesa' : 'Nova despesa'} subtitle="Classifique débitos bancários ou registre uma despesa documental." onClose={() => { setShowForm(false); setAttachmentFile(null); }}>
          <form className="form-grid" onSubmit={submitExpense}>
            <label>Débito bancário<select value={form.bankTransactionId} onChange={(event) => setForm({ ...form, bankTransactionId: event.target.value })}><option value="">Sem vínculo bancário</option>{debits.map((transaction) => <option key={transaction._id} value={transaction._id}>{formatDate(transaction.operationDate ?? transaction.postingDate)} · {formatCents(transaction.amount)} · {transaction.description}</option>)}</select></label>
            <label>Categoria<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Selecione</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
            <label>Favorecido<input required value={form.beneficiary} onChange={(event) => setForm({ ...form, beneficiary: event.target.value })} /></label>
            <label>Competência<input required type="month" value={form.competence} onChange={(event) => setForm({ ...form, competence: event.target.value })} /></label>
            <label className="wide-field">Descrição<input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <label>Status<select value={form.classificationStatus} onChange={(event) => setForm({ ...form, classificationStatus: event.target.value as ExpenseForm['classificationStatus'] })}><option value="PENDING">Pendente</option><option value="SUGGESTED">Sugerida</option><option value="CONFIRMED">Confirmada</option></select></label>
            <label>Anexo URL<input value={form.attachmentUrl} onChange={(event) => setForm({ ...form, attachmentUrl: event.target.value })} /></label>
            <label className="file-field">Anexo arquivo<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)} /></label>
            <label className="wide-field">Observações<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar despesa'}</button>
          </form>
        </Modal>
      ) : null}

      {expenseToDelete ? (
        <ConfirmDialog title="Remover despesa" message={`Remover "${expenseToDelete.description}"?`} confirmLabel="Remover" danger loading={submitting} onCancel={() => setExpenseToDelete(null)} onConfirm={() => void removeExpense()} />
      ) : null}
      </div>
    </div>
  );
}

type ExpenseMetricProps = { icon: typeof Receipt; label: string; value: string; hint: string };

function ExpenseMetric({ icon: Icon, label, value, hint }: ExpenseMetricProps) {
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">{label}</p><Icon className="h-4 w-4 text-amber-200" /></div>
      <strong className="mt-2 block truncate text-2xl font-black text-white">{value}</strong>
      <span className="mt-1 block text-sm text-slate-300">{hint}</span>
    </div>
  );
}

function cleanParams(params: Record<string, string>) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value));
}

function transactionOf(expense: Expense) {
  return expense.bankTransactionId && typeof expense.bankTransactionId !== 'string' ? expense.bankTransactionId : null;
}

function categoryIdOf(expense: Expense) {
  return typeof expense.categoryId === 'string' ? expense.categoryId : expense.categoryId._id;
}

function categoryNameOf(expense: Expense) {
  return typeof expense.categoryId === 'string' ? 'Categoria' : expense.categoryId.name;
}

function statusLabel(status: Expense['classificationStatus']) {
  return { PENDING: 'Pendente', SUGGESTED: 'Sugerida', CONFIRMED: 'Confirmada' }[status];
}

function attachmentHref(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${api.defaults.baseURL}${value.startsWith('/') ? value : `/${value}`}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
