import { useEffect, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { MoneyInput } from '../components/MoneyInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { centsToReaisInput, formatCents } from '../utils/money';
import { buildManualPaymentPayload, buildPayablePayload } from '../utils/formWorkflows';
import { AlertCircle, Banknote, CheckCircle2, Eye, Pencil, Plus, Receipt, RotateCcw, Search, ShieldCheck, Trash2, WalletCards } from 'lucide-react';

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
const fieldClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const labelClass = 'text-sm font-semibold text-slate-300';
const primaryActionClass = 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:scale-[1.01] hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100';
const iconActionClass = 'inline-grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40';

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
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [detail, setDetail] = useState<AccountPayable | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState('');
  const [accountToCancel, setAccountToCancel] = useState<AccountPayable | null>(null);
  const [paymentToReverse, setPaymentToReverse] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
      .catch((caught) => active && setError(apiErrorMessage(caught, 'Não foi possível carregar as contas a pagar.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [beneficiaryFilter, categoryFilter, competence, status]);

  useEffect(() => {
    api
      .get('/lookups/categories')
      .then(({ data }) => setCategories(data.items))
      .catch((caught) => setError(apiErrorMessage(caught, 'Não foi possível carregar as categorias.')));
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
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar o detalhe da conta.'));
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
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const payload = buildPayablePayload(form);
      if (editingId) await api.patch(`/accounts-payable/${editingId}`, payload);
      else await api.post('/accounts-payable', payload);
      setShowForm(false);
      setMessage(editingId ? 'Conta atualizada.' : 'Conta cadastrada.');
      await refreshAccounts();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível salvar a conta.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function createCategory() {
    const name = categoryName.trim();
    if (!name) return;
    try {
      const { data } = await api.post('/lookups/categories', { name });
      setCategories((current) => [...current, data.item].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((current) => ({ ...current, categoryId: data.item._id }));
      setCategoryName('');
      setShowCategoryForm(false);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível criar a categoria.'));
    }
  }

  async function cancelAccount(item = accountToCancel) {
    if (!item) return;
    try {
      await api.post(`/accounts-payable/${item._id}/cancel`);
      setAccountToCancel(null);
      if (detail?._id === item._id) await openDetail(item._id);
      await refreshAccounts();
      setError('');
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível cancelar a conta.'));
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setPaymentSubmitting(true);
    setError('');
    setMessage('');
    try {
      await api.post(`/accounts-payable/${detail._id}/payments`, buildManualPaymentPayload({ amount: paymentAmount, paymentDate, notes: paymentNotes }));
      setPaymentAmount('');
      setPaymentNotes('');
      setShowPaymentForm(false);
      setMessage('Pagamento registrado.');
      await openDetail(detail._id);
      await refreshAccounts();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível registrar o pagamento.'));
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function reversePayment(payment = paymentToReverse) {
    if (!detail || !payment) return;
    try {
      await api.post(`/accounts-payable/${detail._id}/payments/${payment._id}/reverse`, {
        reason: reversalReason || null
      });
      setPaymentToReverse(null);
      setReversalReason('');
      await openDetail(detail._id);
      await refreshAccounts();
      setError('');
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível estornar o pagamento.'));
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
                  Obrigações financeiras
                </span>
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Contas a pagar</h1>
                  <p className="text-base leading-7 text-slate-300 sm:text-lg">Controle compromissos, pagamentos manuais, estornos e saldo pendente por competência.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <PayableMetric icon={Banknote} label="Previsto" value={formatCents(summary.expectedAmount)} hint="Total filtrado" />
                <PayableMetric icon={CheckCircle2} label="Pago" value={formatCents(summary.paidAmount)} hint="Baixado" />
                <PayableMetric icon={WalletCards} label="Pendente" value={formatCents(summary.outstandingAmount)} hint="Em aberto" />
              </div>
            </div>

            <Card className="border-white/10 bg-slate-950/45 text-white shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Search className="h-4 w-4 text-amber-300" />
                  Filtros e ações
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>Competência<input className={fieldClass} type="month" value={competence} onChange={(event) => setCompetence(event.target.value)} /></label>
                  <label className={labelClass}>Status<select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="PENDING">Pendente</option><option value="PARTIAL">Parcial</option><option value="PAID">Pago</option><option value="CANCELLED">Cancelado</option></select></label>
                  <label className={labelClass}>Categoria<select className={fieldClass} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Todas</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
                  <label className={labelClass}>Favorecido<input className={fieldClass} value={beneficiaryFilter} onChange={(event) => setBeneficiaryFilter(event.target.value)} placeholder="Fornecedor ou responsável" /></label>
                </div>
                <button className={primaryActionClass} onClick={startCreate} type="button"><Plus className="h-4 w-4" />Nova conta</button>
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

        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Compromissos</p>
              <CardTitle className="mt-2 text-xl text-white">Contas encontradas</CardTitle>
            </div>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">{items.length}</span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-16 rounded-2xl bg-white/10" key={index} />)}</div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-[1180px] w-full border-collapse text-left">
                    <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400"><tr><th className="px-4 py-4">Descrição</th><th className="px-4 py-4">Favorecido</th><th className="px-4 py-4">Categoria</th><th className="px-4 py-4">Competência</th><th className="px-4 py-4">Previsto</th><th className="px-4 py-4">Pago</th><th className="px-4 py-4">Pendente</th><th className="px-4 py-4">Status</th><th className="px-4 py-4 text-right">Ações</th></tr></thead>
                    <tbody className="divide-y divide-white/10">
                      {items.map((item) => (
                        <tr className="bg-white/[0.025] transition hover:bg-amber-300/5" key={item._id}>
                          <td className="px-4 py-4 font-bold text-white">{item.description}</td><td className="px-4 py-4 text-slate-300">{item.beneficiaryName}</td><td className="px-4 py-4 text-slate-300">{categoryNameOf(item)}</td><td className="px-4 py-4 text-slate-300">{item.competence}</td>
                          <td className="px-4 py-4 font-bold text-white">{formatCents(item.expectedAmount)}</td><td className="px-4 py-4 font-bold text-emerald-100">{formatCents(item.paidAmount)}</td><td className="px-4 py-4 font-bold text-amber-100">{formatCents(item.outstandingAmount)}</td>
                          <td className="px-4 py-4"><span className={`status status-${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span></td>
                          <td className="px-4 py-4"><div className="flex justify-end gap-2"><button className={iconActionClass} onClick={() => openDetail(item._id)} title="Detalhes" type="button" aria-label={`Detalhes da conta ${item.description}`}><Eye size={16} /></button><button className={iconActionClass} disabled={item.status === 'CANCELLED'} onClick={() => startEdit(item)} title="Editar" type="button" aria-label={`Editar conta ${item.description}`}><Pencil size={16} /></button><button className={iconActionClass} disabled={item.status === 'CANCELLED' || item.paidAmount > 0} onClick={() => setAccountToCancel(item)} title="Cancelar" type="button" aria-label={`Cancelar conta ${item.description}`}><Trash2 size={16} /></button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {items.length === 0 ? <div className="p-8 text-center text-slate-300">Nenhuma conta encontrada para os filtros selecionados.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>

      {showForm ? (
        <Modal title={editingId ? 'Editar conta' : 'Nova conta'} subtitle="Valores são enviados ao backend em centavos." onClose={() => setShowForm(false)}>
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
                <button type="button" className="ghost-button compact" onClick={() => setShowCategoryForm(true)}>Nova</button>
              </div>
            </label>
            <label>Subcategoria<input value={form.subcategory} onChange={(event) => setForm({ ...form, subcategory: event.target.value })} /></label>
            <label>Competência<input required type="month" value={form.competence} onChange={(event) => setForm({ ...form, competence: event.target.value })} /></label>
            <label>Valor previsto (R$)<MoneyInput required placeholder="2100,00" value={form.expectedAmount} onChange={(value) => setForm({ ...form, expectedAmount: value })} /></label>
            <label>Vencimento<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
            <label className="wide-field">Observação<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar conta'}</button>
          </form>
        </Modal>
      ) : null}

      {showCategoryForm ? (
        <Modal title="Nova categoria" subtitle="A categoria criada já fica selecionada na conta." onClose={() => setShowCategoryForm(false)}>
          <form className="form-grid compact-form" onSubmit={(event) => { event.preventDefault(); void createCategory(); }}>
            <label>Nome<input required value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></label>
            <button className="primary-button" type="submit">Cadastrar categoria</button>
          </form>
        </Modal>
      ) : null}

        {detail ? (
          <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Detalhe da conta</p>
                <CardTitle className="mt-2 text-xl text-white">{detail.description}</CardTitle>
                <p className="mt-1 text-sm text-slate-300">{detail.beneficiaryName} · {detail.competence}</p>
              </div>
              <button className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-300/10" onClick={() => setDetail(null)} type="button">Fechar</button>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <PayableTile label="Previsto" value={formatCents(detail.expectedAmount)} />
                <PayableTile label="Pago" value={formatCents(detail.paidAmount)} tone="success" />
                <PayableTile label="Pendente" value={formatCents(detail.outstandingAmount)} tone="warning" />
                <PayableTile label="Status" value={statusLabel(detail.status)} />
              </div>

              {detail.status !== 'CANCELLED' && detail.outstandingAmount > 0 ? (
                <button className={`${primaryActionClass} w-fit`} type="button" onClick={() => setShowPaymentForm(true)}><Receipt className="h-4 w-4" />Registrar pagamento manual</button>
              ) : null}

              {showPaymentForm ? (
                <Modal title="Registrar pagamento manual" subtitle={detail.description} onClose={() => setShowPaymentForm(false)}>
                <form className="payment-form" onSubmit={submitPayment}>
                  <label>Valor (R$)<MoneyInput required placeholder="1810,00" value={paymentAmount} onChange={setPaymentAmount} /></label>
                  <label>Data<input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
                  <label>Observação<input value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} /></label>
                  <button className="primary-button" type="submit" disabled={paymentSubmitting}>{paymentSubmitting ? 'Registrando...' : 'Registrar pagamento'}</button>
                </form>
                </Modal>
              ) : null}

              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">Histórico</p>
                    <h3 className="mt-1 text-lg font-black text-white">Pagamentos registrados</h3>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-sm font-bold text-slate-300">{payments.length}</span>
                </div>
                <div className="grid gap-3">
                  {payments.map((payment) => (
                    <div className={`rounded-2xl border p-4 ${payment.reversedAt ? 'border-red-300/20 bg-red-400/10' : 'border-white/10 bg-white/[0.04]'}`} key={payment._id}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <strong className="block text-white">{new Date(payment.paymentDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong>
                          <span className="text-sm text-slate-300">{payment.source === 'MANUAL' ? 'Pagamento manual' : 'Transação bancária'}</span>
                          {payment.notes ? <small className="block text-slate-400">{payment.notes}</small> : null}
                          {payment.reversedAt ? <small className="block text-red-100">Estornado: {payment.reversalReason || 'sem motivo informado'}</small> : null}
                        </div>
                        <div className="flex items-center gap-3">
                          <strong className="text-lg font-black text-white">{formatCents(payment.amount)}</strong>
                          {!payment.reversedAt && payment.source === 'MANUAL' ? <button className={iconActionClass} onClick={() => setPaymentToReverse(payment)} title="Estornar" type="button"><RotateCcw size={16} /></button> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  {payments.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-slate-300">Nenhum pagamento registrado.</p> : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

      {accountToCancel ? (
        <ConfirmDialog
          title="Cancelar conta"
          message={`Cancelar a conta "${accountToCancel.description}"?`}
          confirmLabel="Cancelar conta"
          danger
          loading={submitting}
          onCancel={() => setAccountToCancel(null)}
          onConfirm={() => void cancelAccount()}
        />
      ) : null}

      {paymentToReverse ? (
        <Modal title="Estornar pagamento" subtitle={`Valor: ${formatCents(paymentToReverse.amount)}`} onClose={() => setPaymentToReverse(null)}>
          <form className="form-grid compact-form" onSubmit={(event) => { event.preventDefault(); void reversePayment(); }}>
            <label>Motivo do estorno<input value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} /></label>
            <button className="primary-button danger-button" type="submit">Estornar pagamento</button>
          </form>
        </Modal>
      ) : null}
      </div>
    </div>
  );
}

type PayableMetricProps = { icon: typeof Banknote; label: string; value: string; hint: string };

function PayableMetric({ icon: Icon, label, value, hint }: PayableMetricProps) {
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">{label}</p><Icon className="h-4 w-4 text-amber-200" /></div>
      <strong className="mt-2 block truncate text-2xl font-black text-white">{value}</strong>
      <span className="mt-1 block text-sm text-slate-300">{hint}</span>
    </div>
  );
}

function PayableTile({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' }) {
  const toneClass = {
    default: 'border-white/10 bg-white/[0.06]',
    success: 'border-emerald-300/20 bg-emerald-300/10',
    warning: 'border-amber-300/20 bg-amber-300/10'
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 text-white ${toneClass}`}>
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <strong className="mt-2 block text-lg font-black text-white">{value}</strong>
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
