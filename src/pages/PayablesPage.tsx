import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { centsToReaisInput, formatCents, reaisInputToCents } from '../utils/money';

type Category = { _id: string; name: string };
type Status = 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';

type AccountPayable = {
  _id: string;
  description: string;
  categoryId: Category | string;
  subcategory: string | null;
  beneficiaryName: string;
  competence: string;
  expectedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string | null;
  notes: string | null;
  status: Status;
};

type Payment = {
  _id: string;
  amount: number;
  source: 'MANUAL' | 'BANK_TRANSACTION';
  paymentDate: string;
  notes: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
};

type Summary = { expectedAmount: number; paidAmount: number; outstandingAmount: number };

type FormState = {
  description: string;
  beneficiaryName: string;
  categoryId: string;
  subcategory: string;
  competence: string;
  expectedAmount: string;
  dueDate: string;
  notes: string;
};

const currentCompetence = new Date().toISOString().slice(0, 7);
const emptySummary: Summary = { expectedAmount: 0, paidAmount: 0, outstandingAmount: 0 };

function emptyForm(competence = currentCompetence): FormState {
  return {
    description: '',
    beneficiaryName: '',
    categoryId: '',
    subcategory: '',
    competence,
    expectedAmount: '',
    dueDate: '',
    notes: ''
  };
}

export function PayablesPage() {
  const [items, setItems] = useState<AccountPayable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [competence, setCompetence] = useState(currentCompetence);
  const [status, setStatus] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [beneficiaryFilter, setBeneficiaryFilter] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<AccountPayable | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .get('/accounts-payable', {
        params: {
          competence: competence || undefined,
          status: status || undefined,
          categoryId: categoryFilter || undefined,
          beneficiaryName: beneficiaryFilter || undefined
        }
      })
      .then(({ data }) => {
        if (!active) return;
        setItems(data.items);
        setSummary(data.summary);
        setError('');
      })
      .catch(() => active && setError('Não foi possível carregar as contas a pagar.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [beneficiaryFilter, categoryFilter, competence, status]);

  useEffect(() => {
    api
      .get('/lookups/categories')
      .then(({ data }) => setCategories(data.items))
      .catch(() => setError('Não foi possível carregar as categorias.'));
  }, []);

  async function refreshAccounts() {
    const { data } = await api.get('/accounts-payable', {
      params: {
        competence: competence || undefined,
        status: status || undefined,
        categoryId: categoryFilter || undefined,
        beneficiaryName: beneficiaryFilter || undefined
      }
    });
    setItems(data.items);
    setSummary(data.summary);
  }

  async function openDetail(id: string) {
    try {
      const { data } = await api.get(`/accounts-payable/${id}`);
      setDetail(data.item);
      setPayments(data.payments);
      setError('');
    } catch {
      setError('Não foi possível carregar o detalhe da conta.');
    }
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm(competence || currentCompetence));
    setShowForm(true);
  }

  function startEdit(item: AccountPayable) {
    setEditingId(item._id);
    setForm({
      description: item.description,
      beneficiaryName: item.beneficiaryName,
      categoryId: categoryIdOf(item),
      subcategory: item.subcategory ?? '',
      competence: item.competence,
      expectedAmount: centsToReaisInput(item.expectedAmount),
      dueDate: item.dueDate?.slice(0, 10) ?? '',
      notes: item.notes ?? ''
    });
    setShowForm(true);
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const payload = {
        ...form,
        expectedAmount: reaisInputToCents(form.expectedAmount),
        subcategory: form.subcategory || null,
        dueDate: form.dueDate || null,
        notes: form.notes || null
      };
      if (editingId) await api.patch(`/accounts-payable/${editingId}`, payload);
      else await api.post('/accounts-payable', payload);
      setShowForm(false);
      await refreshAccounts();
      setError('');
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível salvar a conta.'));
    }
  }

  async function createCategory() {
    const name = window.prompt('Nome da nova categoria:')?.trim();
    if (!name) return;
    try {
      const { data } = await api.post('/lookups/categories', { name });
      setCategories((current) => [...current, data.item].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((current) => ({ ...current, categoryId: data.item._id }));
    } catch {
      setError('Não foi possível criar a categoria.');
    }
  }

  async function cancelAccount(item: AccountPayable) {
    if (!window.confirm(`Cancelar a conta “${item.description}”?`)) return;
    try {
      await api.post(`/accounts-payable/${item._id}/cancel`);
      if (detail?._id === item._id) await openDetail(item._id);
      await refreshAccounts();
      setError('');
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível cancelar a conta.'));
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    try {
      await api.post(`/accounts-payable/${detail._id}/payments`, {
        amount: reaisInputToCents(paymentAmount),
        paymentDate,
        notes: paymentNotes || null
      });
      setPaymentAmount('');
      setPaymentNotes('');
      await openDetail(detail._id);
      await refreshAccounts();
      setError('');
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível registrar o pagamento.'));
    }
  }

  async function reversePayment(payment: Payment) {
    if (!detail || !window.confirm(`Estornar o pagamento de ${formatCents(payment.amount)}?`)) return;
    const reason = window.prompt('Motivo do estorno (opcional):') ?? '';
    try {
      await api.post(`/accounts-payable/${detail._id}/payments/${payment._id}/reverse`, {
        reason: reason || null
      });
      await openDetail(detail._id);
      await refreshAccounts();
      setError('');
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível estornar o pagamento.'));
    }
  }

  return (
    <div className="page">
      <PageHeader title="Contas a pagar" subtitle="Obrigações que afetam o saldo disponível real." />

      {error ? <div className="alert error">{error}</div> : null}

      <div className="toolbar">
        <label>
          Competência
          <input type="month" value={competence} onChange={(event) => setCompetence(event.target.value)} />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="PARTIAL">Parcial</option>
            <option value="PAID">Pago</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </label>
        <label>
          Categoria
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          Favorecido
          <input value={beneficiaryFilter} onChange={(event) => setBeneficiaryFilter(event.target.value)} />
        </label>
        <button className="primary-button toolbar-action" onClick={startCreate}>Nova conta</button>
      </div>

      <div className="summary-grid">
        <StatCard label="Total previsto" value={formatCents(summary.expectedAmount)} />
        <StatCard label="Total pago" value={formatCents(summary.paidAmount)} />
        <StatCard label="Total pendente" value={formatCents(summary.outstandingAmount)} />
      </div>

      {showForm ? (
        <section className="panel operational-panel">
          <div className="section-heading">
            <h2>{editingId ? 'Editar conta' : 'Nova conta'}</h2>
            <button className="ghost-button compact" onClick={() => setShowForm(false)}>Fechar</button>
          </div>
          <form className="form-grid" onSubmit={submitAccount}>
            <label>Descrição<input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <label>Favorecido<input required value={form.beneficiaryName} onChange={(event) => setForm({ ...form, beneficiaryName: event.target.value })} /></label>
            <label>
              Categoria
              <div className="inline-field">
                <select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                  <option value="">Selecione</option>
                  {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                </select>
                <button type="button" className="ghost-button compact" onClick={createCategory}>Nova</button>
              </div>
            </label>
            <label>Subcategoria<input value={form.subcategory} onChange={(event) => setForm({ ...form, subcategory: event.target.value })} /></label>
            <label>Competência<input required type="month" value={form.competence} onChange={(event) => setForm({ ...form, competence: event.target.value })} /></label>
            <label>Valor previsto (R$)<input required inputMode="decimal" placeholder="2100,00" value={form.expectedAmount} onChange={(event) => setForm({ ...form, expectedAmount: event.target.value })} /></label>
            <label>Vencimento<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
            <label className="wide-field">Observação<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <button className="primary-button" type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar conta'}</button>
          </form>
        </section>
      ) : null}

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Descrição</th><th>Favorecido</th><th>Categoria</th><th>Competência</th><th>Previsto</th><th>Pago</th><th>Pendente</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{item.description}</td><td>{item.beneficiaryName}</td><td>{categoryNameOf(item)}</td><td>{item.competence}</td>
                  <td>{formatCents(item.expectedAmount)}</td><td>{formatCents(item.paidAmount)}</td><td>{formatCents(item.outstandingAmount)}</td>
                  <td><span className={`status status-${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span></td>
                  <td><div className="row-actions"><button className="link-button" onClick={() => openDetail(item._id)}>Detalhes</button><button className="link-button" disabled={item.status === 'CANCELLED'} onClick={() => startEdit(item)}>Editar</button><button className="link-button danger" disabled={item.status === 'CANCELLED' || item.paidAmount > 0} onClick={() => cancelAccount(item)}>Cancelar</button></div></td>
                </tr>
              ))}
              {!loading && items.length === 0 ? <tr><td colSpan={9} className="empty-state">Nenhuma conta encontrada para os filtros selecionados.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {loading ? <p className="loading-text">Carregando contas...</p> : null}
      </section>

      {detail ? (
        <section className="panel operational-panel">
          <div className="section-heading"><div><p className="eyebrow">Detalhe da conta</p><h2>{detail.description}</h2><p>{detail.beneficiaryName} · {detail.competence}</p></div><button className="ghost-button compact" onClick={() => setDetail(null)}>Fechar</button></div>
          <div className="summary-grid detail-summary"><StatCard label="Previsto" value={formatCents(detail.expectedAmount)} /><StatCard label="Pago" value={formatCents(detail.paidAmount)} /><StatCard label="Pendente" value={formatCents(detail.outstandingAmount)} /><StatCard label="Status" value={statusLabel(detail.status)} /></div>

          {detail.status !== 'CANCELLED' && detail.outstandingAmount > 0 ? (
            <form className="payment-form" onSubmit={submitPayment}>
              <h3>Registrar pagamento manual</h3>
              <label>Valor (R$)<input required inputMode="decimal" placeholder="1810,00" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
              <label>Data<input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
              <label>Observação<input value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} /></label>
              <button className="primary-button" type="submit">Registrar pagamento</button>
            </form>
          ) : null}

          <h3>Histórico de pagamentos</h3>
          <div className="payment-history">
            {payments.map((payment) => (
              <div className={`payment-row ${payment.reversedAt ? 'reversed' : ''}`} key={payment._id}>
                <div><strong>{new Date(payment.paymentDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong><span>{payment.source === 'MANUAL' ? 'Pagamento manual' : 'Transação bancária'}</span>{payment.notes ? <small>{payment.notes}</small> : null}{payment.reversedAt ? <small>Estornado: {payment.reversalReason || 'sem motivo informado'}</small> : null}</div>
                <strong>{formatCents(payment.amount)}</strong>
                {!payment.reversedAt && payment.source === 'MANUAL' ? <button className="link-button danger" onClick={() => reversePayment(payment)}>Estornar</button> : null}
              </div>
            ))}
            {payments.length === 0 ? <p className="empty-state">Nenhum pagamento registrado.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function categoryIdOf(item: AccountPayable) {
  return typeof item.categoryId === 'string' ? item.categoryId : item.categoryId._id;
}

function categoryNameOf(item: AccountPayable) {
  return typeof item.categoryId === 'string' ? 'Categoria' : item.categoryId.name;
}

function statusLabel(status: Status) {
  return { PENDING: 'Pendente', PARTIAL: 'Parcial', PAID: 'Pago', CANCELLED: 'Cancelado' }[status];
}

function errorMessage(caught: unknown, fallback: string) {
  if (
    caught &&
    typeof caught === 'object' &&
    'response' in caught &&
    caught.response &&
    typeof caught.response === 'object' &&
    'data' in caught.response
  ) {
    const data = caught.response.data;
    if (data && typeof data === 'object' && 'error' in data) {
      const error = data.error;
      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message;
      }
    }
  }
  return fallback;
}
