import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import { MoneyInput } from '../components/MoneyInput';
import { StatusBadge } from '../components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCompetence } from '../utils/competence';
import { buildManualChargePaymentPayload } from '../utils/formWorkflows';
import { centsToReaisInput, formatCents } from '../utils/money';
import type { ChargeStatus, Resident, Unit } from '../types/domain';
import { AlertCircle, Banknote, CheckCircle2, Clock, Receipt, Search, ShieldAlert, Users } from 'lucide-react';

type PaymentMethod = 'PIX' | 'CASH' | 'BANK_TRANSFER' | 'BOLETO' | 'OTHER';
type ManualChargePaymentForm = {
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  notes: string;
};
type DefaulterCharge = {
  _id: string;
  unitId: Unit | string;
  competence: string;
  valueOriginal: number;
  valuePaid: number;
  openBalance: number;
  referenceDate: string;
  status: ChargeStatus;
  daysOverdue: number;
};

const fieldClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const labelClass = 'text-sm font-semibold text-slate-300';
const iconActionClass = 'inline-grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40';

export function DefaultersPage() {
  const [items, setItems] = useState<DefaulterCharge[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCharge, setSelectedCharge] = useState<DefaulterCharge | null>(null);
  const [paymentForm, setPaymentForm] = useState<ManualChargePaymentForm>({
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'PIX',
    notes: ''
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadDefaulters() {
    const { data } = await api.get('/charges/defaulters');
    setItems(data.items);
    setError('');
  }

  useEffect(() => {
    let active = true;
    api.get('/charges/defaulters')
      .then(({ data }) => {
        if (!active) return;
        setItems(data.items);
        setError('');
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar inadimplentes.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleItems = useMemo(() => {
    const needle = search.toLocaleLowerCase('pt-BR');
    return items.filter((item) => {
      const unit = unitOf(item);
      const resident = residentOf(unit);
      return !needle || `${unitText(unit)} ${resident?.name ?? ''} ${item.competence}`.toLocaleLowerCase('pt-BR').includes(needle);
    });
  }, [items, search]);

  const totals = useMemo(() => visibleItems.reduce((acc, item) => ({
    openBalance: acc.openBalance + item.openBalance,
    units: acc.units + 1,
    maxDays: Math.max(acc.maxDays, item.daysOverdue)
  }), { openBalance: 0, units: 0, maxDays: 0 }), [visibleItems]);

  function openPaymentModal(charge: DefaulterCharge) {
    setSelectedCharge(charge);
    setPaymentForm({
      amount: centsToReaisInput(charge.openBalance),
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'PIX',
      notes: ''
    });
    setMessage('');
  }

  async function submitManualPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCharge) return;
    setSavingPayment(true);
    setError('');
    setMessage('');
    try {
      await api.post(`/charges/${selectedCharge._id}/manual-payments`, buildManualChargePaymentPayload(paymentForm));
      setSelectedCharge(null);
      setMessage('Pagamento baixado e inadimplência atualizada.');
      await loadDefaulters();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível baixar o pagamento.'));
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.14),_transparent_34%),linear-gradient(135deg,_#07111f_0%,_#0f172a_54%,_#0b1324_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-red-300/25 bg-red-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-red-100">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Cobrança ativa
                </span>
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Inadimplentes</h1>
                  <p className="text-base leading-7 text-slate-300 sm:text-lg">Unidades com taxa mensal em aberto após o dia 10, com dias de atraso e saldo devido.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <DefaulterMetric icon={Users} label="Devedores" value={`${totals.units}`} hint="Cobranças em atraso" />
                <DefaulterMetric icon={Banknote} label="Total devido" value={formatCents(totals.openBalance)} hint="Saldo aberto" />
                <DefaulterMetric icon={Clock} label="Maior atraso" value={`${totals.maxDays} dia(s)`} hint="Tempo em aberto" />
              </div>
            </div>

            <Card className="border-white/10 bg-slate-950/45 text-white shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Search className="h-4 w-4 text-amber-300" />
                  Busca
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <label className={labelClass}>Morador, unidade ou competência<input className={fieldClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: Maria, quadra A, 2026-09" /></label>
                <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">O vencimento operacional é o dia 10. Pagamento após essa data continua permitido; a tela apenas calcula o atraso.</p>
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

        {selectedCharge ? (
          <Modal title="Baixar pagamento" subtitle={chargeSubtitle(selectedCharge)} onClose={() => setSelectedCharge(null)}>
            <form className="form-grid compact-form" onSubmit={submitManualPayment}>
              <label>Valor pago (R$)<MoneyInput required value={paymentForm.amount} onChange={(amount) => setPaymentForm({ ...paymentForm, amount })} /></label>
              <label>Data do pagamento<input required type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} /></label>
              <label>Forma de pagamento<select required value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethod: event.target.value as PaymentMethod })}><option value="PIX">PIX</option><option value="CASH">Dinheiro</option><option value="BANK_TRANSFER">Transferência</option><option value="BOLETO">Boleto</option><option value="OTHER">Outro</option></select></label>
              <label className="wide-field">Observação<textarea value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} placeholder="Ex.: contato feito, promessa de pagamento..." /></label>
              <p className="confirm-message">Saldo aberto atual: {formatCents(selectedCharge.openBalance)}. A baixa não substitui a conciliação bancária final.</p>
              <button className="primary-button" type="submit" disabled={savingPayment}>{savingPayment ? 'Baixando...' : 'Confirmar baixa'}</button>
            </form>
          </Modal>
        ) : null}

        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-red-100">Carteira em atraso</p>
              <CardTitle className="mt-2 text-xl text-white">Devedores encontrados</CardTitle>
            </div>
            <span className="rounded-full border border-red-300/25 bg-red-400/10 px-3 py-1 text-sm font-black text-red-100">{visibleItems.length}</span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-16 rounded-2xl bg-white/10" key={index} />)}</div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-[1180px] w-full border-collapse text-left">
                    <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400"><tr><th className="px-4 py-4">Morador</th><th className="px-4 py-4">Unidade</th><th className="px-4 py-4">Competência</th><th className="px-4 py-4">Vencimento</th><th className="px-4 py-4">Atraso</th><th className="px-4 py-4">Valor</th><th className="px-4 py-4">Pago</th><th className="px-4 py-4">Deve</th><th className="px-4 py-4">Status</th><th className="px-4 py-4 text-right">Ações</th></tr></thead>
                    <tbody className="divide-y divide-white/10">
                      {visibleItems.map((charge) => {
                        const unit = unitOf(charge);
                        const resident = residentOf(unit);
                        return (
                          <tr className="bg-white/[0.025] transition hover:bg-red-300/5" key={charge._id}>
                            <td className="px-4 py-4 font-bold text-white">{resident?.name ?? 'Sem morador vinculado'}</td>
                            <td className="px-4 py-4 text-slate-300">{unit ? `${unit.quadra} ${unit.tipo === 'CASA' ? 'Casa' : 'Lote'} ${unit.numero}` : '-'}</td>
                            <td className="px-4 py-4 text-slate-300">{formatCompetence(charge.competence)}</td>
                            <td className="px-4 py-4 text-slate-300">{formatDate(charge.referenceDate)}</td>
                            <td className="px-4 py-4 font-black text-red-100">{charge.daysOverdue} dia(s)</td>
                            <td className="px-4 py-4 text-slate-300">{formatCents(charge.valueOriginal)}</td>
                            <td className="px-4 py-4 text-emerald-100">{formatCents(charge.valuePaid)}</td>
                            <td className="px-4 py-4 font-black text-amber-100">{formatCents(charge.openBalance)}</td>
                            <td className="px-4 py-4"><StatusBadge value={charge.status} label={chargeStatusLabel(charge.status)} /></td>
                            <td className="px-4 py-4"><div className="flex justify-end"><button className={iconActionClass} onClick={() => openPaymentModal(charge)} title="Baixar pagamento" type="button" aria-label={`Baixar pagamento de ${chargeSubtitle(charge)}`}><Receipt size={16} /></button></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {visibleItems.length === 0 ? <div className="p-8 text-center text-slate-300">Nenhum inadimplente encontrado.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type DefaulterMetricProps = { icon: typeof Users; label: string; value: string; hint: string };

function DefaulterMetric({ icon: Icon, label, value, hint }: DefaulterMetricProps) {
  return (
    <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-red-100">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">{label}</p><Icon className="h-4 w-4 text-red-100" /></div>
      <strong className="mt-2 block truncate text-2xl font-black text-white">{value}</strong>
      <span className="mt-1 block text-sm text-slate-300">{hint}</span>
    </div>
  );
}

function unitOf(charge: DefaulterCharge) {
  return typeof charge.unitId === 'string' ? null : charge.unitId;
}

function residentOf(unit: Unit | null): Resident | null {
  if (!unit?.residentCurrentId || typeof unit.residentCurrentId === 'string') return null;
  return unit.residentCurrentId;
}

function unitText(unit: Unit | null) {
  return `${unit?.quadra ?? ''} ${unit?.numero ?? ''} ${unit?.tipo ?? ''} ${unit?.unitKey ?? ''}`.toLocaleLowerCase('pt-BR');
}

function chargeSubtitle(charge: DefaulterCharge) {
  const unit = unitOf(charge);
  const resident = residentOf(unit);
  const unitLabel = unit ? `Quadra ${unit.quadra}, ${unit.tipo === 'CASA' ? 'casa' : 'lote'} ${unit.numero}` : 'Unidade';
  return `${resident?.name ?? 'Sem morador'} · ${unitLabel} · ${formatCompetence(charge.competence)}`;
}

function chargeStatusLabel(status: ChargeStatus) {
  return { PENDING: 'Pendente', PARTIAL: 'Parcial', PAID: 'Pago', PAID_AFTER_REFERENCE_DATE: 'Pago após referência' }[status];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
