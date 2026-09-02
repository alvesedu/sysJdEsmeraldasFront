import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../components/Feedback';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { currentCompetence, formatCompetence } from '../utils/competence';
import { buildExpensePayload } from '../utils/formWorkflows';
import { formatCents } from '../utils/money';
import type { BankTransaction, Category, Expense } from '../types/domain';

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
    <div className="page">
      <PageHeader title="Despesas" subtitle="Categorização de débitos, favorecido e anexos." />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {message ? <SuccessState>{message}</SuccessState> : null}

      <section className="toolbar">
        <label>Competência<input type="month" value={filters.competence} onChange={(event) => changeFilter({ competence: event.target.value })} /></label>
        <label>Categoria<select value={filters.categoryId} onChange={(event) => changeFilter({ categoryId: event.target.value })}><option value="">Todas</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
        <label>Status<select value={filters.classificationStatus} onChange={(event) => changeFilter({ classificationStatus: event.target.value })}><option value="">Todos</option><option value="PENDING">Pendente</option><option value="SUGGESTED">Sugerida</option><option value="CONFIRMED">Confirmada</option></select></label>
        <label>Favorecido<input value={filters.beneficiary} onChange={(event) => changeFilter({ beneficiary: event.target.value })} /></label>
        <button className="primary-button toolbar-action" onClick={() => startCreate()}>Nova despesa</button>
      </section>

      <div className="summary-grid">
        <StatCard label="Total classificado" value={formatCents(summary.total)} />
        <StatCard label="Confirmado" value={formatCents(summary.confirmed)} />
        <StatCard label="Pendências" value={`${summary.pendingCount}`} />
      </div>

      <section className="panel table-panel">
        <div className="section-heading padded-heading"><div><p className="eyebrow">Débitos sem despesa</p><h2>Importações bancárias</h2></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Favorecido</th><th>Valor</th><th>Ação</th></tr></thead>
            <tbody>
              {unclassifiedDebits.slice(0, 10).map((transaction) => (
                <tr key={transaction._id}>
                  <td>{formatDate(transaction.operationDate ?? transaction.postingDate)}</td><td>{transaction.description}</td><td>{transaction.counterpartyOriginalName ?? 'Não informado'}</td><td>{formatCents(transaction.amount)}</td>
                  <td><button className="link-button" onClick={() => startCreate(transaction)}>Classificar</button></td>
                </tr>
              ))}
              {unclassifiedDebits.length === 0 ? <tr><td colSpan={5}><EmptyState>Nenhum débito bancário pendente encontrado.</EmptyState></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="section-heading padded-heading"><div><p className="eyebrow">Histórico</p><h2>Despesas classificadas</h2></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Competência</th><th>Favorecido</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Status</th><th>Anexo</th><th>Ações</th></tr></thead>
            <tbody>
              {items.map((expense) => {
                const transaction = transactionOf(expense);
                return (
                  <tr key={expense._id}>
                    <td>{formatCompetence(expense.competence)}</td><td>{expense.beneficiary}</td><td>{expense.description}</td><td>{categoryNameOf(expense)}</td><td>{formatCents(transaction?.amount ?? 0)}</td>
                    <td><StatusBadge value={expense.classificationStatus} label={statusLabel(expense.classificationStatus)} /></td>
                    <td>{expense.attachmentUrl ? <a className="link-button" href={attachmentHref(expense.attachmentUrl)} target="_blank" rel="noreferrer">Abrir</a> : 'Sem anexo'}</td>
                    <td><div className="row-actions"><button className="link-button" onClick={() => startEdit(expense)}>Editar</button><button className="link-button danger" onClick={() => setExpenseToDelete(expense)}>Remover</button></div></td>
                  </tr>
                );
              })}
              {!loading && items.length === 0 ? <tr><td colSpan={8}><EmptyState>Nenhuma despesa encontrada.</EmptyState></td></tr> : null}
            </tbody>
          </table>
        </div>
        {loading ? <LoadingState>Carregando despesas...</LoadingState> : null}
      </section>

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
