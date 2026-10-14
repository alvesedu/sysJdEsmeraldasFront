import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { CompetenceInput } from '../components/CompetenceInput';
import { Modal } from '../components/Modal';
import { MoneyInput } from '../components/MoneyInput';
import { StatusBadge } from '../components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { currentCompetence, formatCompetence } from '../utils/competence';
import { buildGenerateChargesPayload, buildManualChargePaymentPayload } from '../utils/formWorkflows';
import { centsToReaisInput, formatCents } from '../utils/money';
import type { Charge, ChargeStatus, Unit } from '../types/domain';
import { AlertCircle, Banknote, CheckCircle2, Clock, FilePlus2, Receipt, Search, ShieldCheck } from 'lucide-react';

type GenerateResult = { generated: number; totalUnits: number };
type PaymentMethod = 'PIX' | 'CASH' | 'BANK_TRANSFER' | 'BOLETO' | 'OTHER';
type ManualChargePaymentForm = {
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  notes: string;
};
const fieldClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const labelClass = 'text-sm font-semibold text-slate-300';
const primaryActionClass = 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:scale-[1.01] hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100';
const iconActionClass = 'inline-grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40';

export function ChargesPage() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [competence, setCompetence] = useState(currentCompetence());
  const [status, setStatus] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [paymentCharge, setPaymentCharge] = useState<Charge | null>(null);
  const [paymentForm, setPaymentForm] = useState<ManualChargePaymentForm>({
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'PIX',
    notes: ''
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/charges', { params: { competence: competence || undefined, status: status || undefined } })
      .then(({ data }) => {
        if (!active) return;
        setCharges(data.items);
        setError('');
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar as cobranças.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [competence, status]);

  async function loadCharges() {
    const { data } = await api.get('/charges', { params: { competence: competence || undefined, status: status || undefined } });
    setCharges(data.items);
  }

  function changeCompetence(value: string) {
    setCompetence(value);
    setLoading(true);
  }

  function changeStatus(value: string) {
    setStatus(value);
    setLoading(true);
  }

  async function generateCharges() {
    setGenerating(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post<GenerateResult>('/charges/generate', buildGenerateChargesPayload(competence));
      const existing = Math.max(data.totalUnits - data.generated, 0);
      setMessage(`${data.generated} cobrança(s) criada(s). ${existing} unidade(s) já possuíam cobrança na competência.`);
      setShowGenerateModal(false);
      await loadCharges();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível gerar cobranças para a competência.'));
    } finally {
      setGenerating(false);
    }
  }

  function openPaymentModal(charge: Charge) {
    setPaymentCharge(charge);
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
    if (!paymentCharge) return;
    setSavingPayment(true);
    setError('');
    setMessage('');
    try {
      await api.post(`/charges/${paymentCharge._id}/manual-payments`, buildManualChargePaymentPayload(paymentForm));
      setPaymentCharge(null);
      setMessage('Pagamento da taxa mensal baixado.');
      await loadCharges();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível baixar o pagamento da taxa mensal.'));
    } finally {
      setSavingPayment(false);
    }
  }

  const visibleCharges = useMemo(() => {
    const needle = unitSearch.toLocaleLowerCase('pt-BR');
    return charges.filter((charge) => !needle || unitText(unitOf(charge)).includes(needle));
  }, [charges, unitSearch]);

  const totals = useMemo(() => visibleCharges.reduce((acc, charge) => ({
    valueOriginal: acc.valueOriginal + charge.valueOriginal,
    valuePaid: acc.valuePaid + charge.valuePaid,
    openBalance: acc.openBalance + charge.openBalance
  }), { valueOriginal: 0, valuePaid: 0, openBalance: 0 }), [visibleCharges]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(247,185,85,0.16),_transparent_34%),linear-gradient(135deg,_#07111f_0%,_#0f172a_54%,_#0b1324_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Receita mensal
                </span>
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Cobranças</h1>
                  <p className="text-base leading-7 text-slate-300 sm:text-lg">Acompanhe competência, status e saldos abertos por unidade com geração idempotente.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <ChargeMetric icon={Banknote} label="Previsto" value={formatCents(totals.valueOriginal)} hint="Total da lista" />
                <ChargeMetric icon={CheckCircle2} label="Pago" value={formatCents(totals.valuePaid)} hint="Recebido" />
                <ChargeMetric icon={Clock} label="Pendente" value={formatCents(totals.openBalance)} hint="Saldo aberto" />
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
                  <label className={labelClass}>Competência<CompetenceInput value={competence} onChange={changeCompetence} required /></label>
                  <label className={labelClass}>Status<select className={fieldClass} value={status} onChange={(event) => changeStatus(event.target.value)}><option value="">Todos</option><option value="PENDING">Pendente</option><option value="PARTIAL">Parcial</option><option value="PAID">Pago</option><option value="PAID_AFTER_REFERENCE_DATE">Pago após referência</option></select></label>
                  <label className={labelClass}>Unidade<input className={fieldClass} value={unitSearch} placeholder="Quadra, número ou tipo" onChange={(event) => setUnitSearch(event.target.value)} /></label>
                </div>
                <button className={primaryActionClass} onClick={() => setShowGenerateModal(true)} disabled={!competence} type="button"><FilePlus2 className="h-4 w-4" />Gerar cobranças</button>
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

      {showGenerateModal ? (
        <Modal title="Gerar cobranças" subtitle="A geração é idempotente para a competência selecionada." onClose={() => setShowGenerateModal(false)}>
          <div className="modal-stack">
            <label>Competência<CompetenceInput value={competence} onChange={changeCompetence} required /></label>
            <p className="confirm-message">O backend criará cobranças apenas para unidades ativas que ainda não possuem cobrança em {formatCompetence(competence)}.</p>
            <div className="inline-actions">
              <button className="ghost-button" type="button" onClick={() => setShowGenerateModal(false)} disabled={generating}>Voltar</button>
              <button className="primary-button" type="button" onClick={generateCharges} disabled={generating || !competence}>{generating ? 'Gerando...' : 'Confirmar geração'}</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {paymentCharge ? (
        <Modal title="Baixar pagamento da taxa" subtitle={chargeSubtitle(paymentCharge)} onClose={() => setPaymentCharge(null)}>
          <form className="form-grid compact-form" onSubmit={submitManualPayment}>
            <label>Valor pago (R$)<MoneyInput required value={paymentForm.amount} onChange={(amount) => setPaymentForm({ ...paymentForm, amount })} /></label>
            <label>Data do pagamento<input required type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} /></label>
            <label>Forma de pagamento<select required value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethod: event.target.value as PaymentMethod })}><option value="PIX">PIX</option><option value="CASH">Dinheiro</option><option value="BANK_TRANSFER">Transferência</option><option value="BOLETO">Boleto</option><option value="OTHER">Outro</option></select></label>
            <label className="wide-field">Observação<textarea value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} placeholder="Ex.: pago na portaria, comprovante recebido pelo WhatsApp..." /></label>
            <p className="confirm-message">Saldo aberto atual: {formatCents(paymentCharge.openBalance)}. A baixa não substitui a conciliação bancária final.</p>
            <button className="primary-button" type="submit" disabled={savingPayment}>{savingPayment ? 'Baixando...' : 'Confirmar baixa'}</button>
          </form>
        </Modal>
      ) : null}

        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Carteira</p>
              <CardTitle className="mt-2 text-xl text-white">Cobranças encontradas</CardTitle>
            </div>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">{visibleCharges.length}</span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-16 rounded-2xl bg-white/10" key={index} />)}</div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-[1080px] w-full border-collapse text-left">
                    <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400"><tr><th className="px-4 py-4">Quadra</th><th className="px-4 py-4">Número</th><th className="px-4 py-4">Tipo</th><th className="px-4 py-4">Competência</th><th className="px-4 py-4">Valor</th><th className="px-4 py-4">Pago</th><th className="px-4 py-4">Pendente</th><th className="px-4 py-4">Status</th><th className="px-4 py-4 text-right">Ações</th></tr></thead>
                    <tbody className="divide-y divide-white/10">
                      {visibleCharges.map((charge) => {
                        const unit = unitOf(charge);
                        return (
                          <tr className="bg-white/[0.025] transition hover:bg-amber-300/5" key={charge._id}>
                            <td className="px-4 py-4 font-black text-white">{unit?.quadra ?? '-'}</td><td className="px-4 py-4 text-slate-300">{unit?.numero ?? '-'}</td><td className="px-4 py-4 text-slate-300">{unit?.tipo === 'CASA' ? 'Casa' : unit?.tipo === 'LOTE' ? 'Lote' : '-'}</td>
                            <td className="px-4 py-4 text-slate-300">{formatCompetence(charge.competence)}</td><td className="px-4 py-4 font-bold text-white">{formatCents(charge.valueOriginal)}</td><td className="px-4 py-4 font-bold text-emerald-100">{formatCents(charge.valuePaid)}</td><td className="px-4 py-4 font-bold text-amber-100">{formatCents(charge.openBalance)}</td>
                            <td className="px-4 py-4"><StatusBadge value={charge.status} label={chargeStatusLabel(charge.status)} /></td>
                            <td className="px-4 py-4"><div className="flex justify-end"><button className={iconActionClass} disabled={charge.openBalance <= 0} onClick={() => openPaymentModal(charge)} title="Baixar pagamento" type="button" aria-label={`Baixar pagamento de ${chargeSubtitle(charge)}`}><Receipt size={16} /></button></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {visibleCharges.length === 0 ? <div className="p-8 text-center text-slate-300">Nenhuma cobrança encontrada.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type ChargeMetricProps = { icon: typeof Banknote; label: string; value: string; hint: string };

function ChargeMetric({ icon: Icon, label, value, hint }: ChargeMetricProps) {
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">{label}</p><Icon className="h-4 w-4 text-amber-200" /></div>
      <strong className="mt-2 block truncate text-2xl font-black text-white">{value}</strong>
      <span className="mt-1 block text-sm text-slate-300">{hint}</span>
    </div>
  );
}

function unitOf(charge: Charge) {
  return typeof charge.unitId === 'string' ? null : charge.unitId;
}

function unitText(unit: Unit | null) {
  return `${unit?.quadra ?? ''} ${unit?.numero ?? ''} ${unit?.tipo ?? ''} ${unit?.unitKey ?? ''}`.toLocaleLowerCase('pt-BR');
}

function chargeStatusLabel(status: ChargeStatus) {
  return { PENDING: 'Pendente', PARTIAL: 'Parcial', PAID: 'Pago', PAID_AFTER_REFERENCE_DATE: 'Pago após referência' }[status];
}

function chargeSubtitle(charge: Charge) {
  const unit = unitOf(charge);
  const unitLabel = unit ? `Quadra ${unit.quadra}, ${unit.tipo === 'CASA' ? 'casa' : 'lote'} ${unit.numero}` : 'Unidade';
  return `${unitLabel} · ${formatCompetence(charge.competence)}`;
}
