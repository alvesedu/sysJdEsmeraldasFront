import { useEffect, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { currentCompetence, formatCompetence } from '../utils/competence';
import { buildMonthlyClosingPayload } from '../utils/formWorkflows';
import { formatCents } from '../utils/money';
import type { MonthlyClosing } from '../types/domain';
import { AlertCircle, Archive, Banknote, CalendarDays, CheckCircle2, FilePlus2, Pencil, ShieldCheck, WalletCards } from 'lucide-react';

type ClosingForm = { competence: string; notes: string };
type StatusForm = { status: 'OPEN' | 'CLOSED'; notes: string };
const fieldClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const labelClass = 'text-sm font-semibold text-slate-300';
const primaryActionClass = 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:scale-[1.01] hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100';
const iconActionClass = 'inline-grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100';

export function ClosingsPage() {
  const [items, setItems] = useState<MonthlyClosing[]>([]);
  const [dashboard, setDashboard] = useState<Partial<MonthlyClosing> | null>(null);
  const [competence, setCompetence] = useState(currentCompetence());
  const [form, setForm] = useState<ClosingForm>({ competence: currentCompetence(), notes: '' });
  const [statusForm, setStatusForm] = useState<StatusForm>({ status: 'OPEN', notes: '' });
  const [selected, setSelected] = useState<MonthlyClosing | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/monthly-closings', { params: { competence } }),
      api.get('/dashboard', { params: { competence } })
    ])
      .then(([closingResponse, dashboardResponse]) => {
        if (!active) return;
        setItems(closingResponse.data.items);
        setDashboard(dashboardResponse.data);
        setError('');
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar fechamentos.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [competence]);

  function changeCompetence(value: string) {
    setCompetence(value);
    setLoading(true);
  }

  async function refreshForCompetence(targetCompetence = competence) {
    const [closingResponse, dashboardResponse] = await Promise.all([
      api.get('/monthly-closings', { params: { competence: targetCompetence } }),
      api.get('/dashboard', { params: { competence: targetCompetence } })
    ]);
    setItems(closingResponse.data.items);
    setDashboard(dashboardResponse.data);
    setError('');
  }

  function openSnapshotModal() {
    setForm({ competence, notes: items[0]?.notes ?? '' });
    setShowSnapshotModal(true);
    setMessage('');
  }

  function openStatusModal(item: MonthlyClosing) {
    setSelected(item);
    setStatusForm({ status: item.status, notes: item.notes ?? '' });
    setShowStatusModal(true);
    setMessage('');
  }

  async function submitSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/monthly-closings', buildMonthlyClosingPayload(form));
      setShowSnapshotModal(false);
      setMessage('Snapshot da competência salvo.');
      setCompetence(form.competence);
      await refreshForCompetence(form.competence);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível salvar o fechamento.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      await api.patch(`/monthly-closings/${selected.competence}`, statusForm);
      setShowStatusModal(false);
      setSelected(null);
      setMessage('Status do fechamento atualizado.');
      await refreshForCompetence();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível atualizar o fechamento.'));
    } finally {
      setSubmitting(false);
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
                  Fechamento financeiro
                </span>
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Fechamento mensal</h1>
                  <p className="text-base leading-7 text-slate-300 sm:text-lg">Snapshot da competência, saldos e status para preservar a visão financeira do mês.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <ClosingMetric icon={Banknote} label="Receita prevista" value={formatCents(dashboard?.revenueForecast ?? 0)} hint={formatCompetence(competence)} />
                <ClosingMetric icon={CheckCircle2} label="Recebido" value={formatCents(dashboard?.revenueReceived ?? 0)} hint="Arrecadação" />
                <ClosingMetric icon={WalletCards} label="Saldo disponível" value={formatCents(dashboard?.availableBalance ?? 0)} hint="Depois de compromissos" />
              </div>
            </div>

            <Card className="border-white/10 bg-slate-950/45 text-white shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <CalendarDays className="h-4 w-4 text-amber-300" />
                  Competência
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <label className={labelClass}>Mês financeiro<input className={fieldClass} type="month" value={competence} onChange={(event) => changeCompetence(event.target.value)} /></label>
                <button className={primaryActionClass} onClick={openSnapshotModal} type="button"><FilePlus2 className="h-4 w-4" />Gerar snapshot</button>
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

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ClosingTile label="Recebido até venc." value={formatCents(dashboard?.revenueReceivedBeforeRef ?? 0)} />
          <ClosingTile label="Recebido após venc." value={formatCents(dashboard?.revenueReceivedAfterRef ?? 0)} />
          <ClosingTile label="Pendente" value={formatCents(dashboard?.revenuePending ?? 0)} tone="warning" />
          <ClosingTile label="Despesas pagas" value={formatCents(dashboard?.expensePaid ?? 0)} tone="danger" />
          <ClosingTile label="Entradas bancárias" value={formatCents(dashboard?.bankInflow ?? 0)} tone="success" />
          <ClosingTile label="Saídas bancárias" value={formatCents(dashboard?.bankOutflow ?? 0)} tone="danger" />
          <ClosingTile label="Compromissos abertos" value={formatCents(dashboard?.openCommitments ?? 0)} />
          <ClosingTile label="Saldo disponível" value={formatCents(dashboard?.availableBalance ?? 0)} tone="success" />
        </section>

        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Snapshots</p>
              <CardTitle className="mt-2 text-xl text-white">Fechamentos salvos</CardTitle>
            </div>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">{items.length}</span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-16 rounded-2xl bg-white/10" key={index} />)}</div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-[1320px] w-full border-collapse text-left">
                    <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400"><tr><th className="px-4 py-4">Competência</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Receita</th><th className="px-4 py-4">Recebido</th><th className="px-4 py-4">Entradas</th><th className="px-4 py-4">Saídas</th><th className="px-4 py-4">Saldo inicial</th><th className="px-4 py-4">Saldo final</th><th className="px-4 py-4">Saldo disponível</th><th className="px-4 py-4">Notas</th><th className="px-4 py-4 text-right">Ações</th></tr></thead>
                    <tbody className="divide-y divide-white/10">
                      {items.map((item) => (
                        <tr className="bg-white/[0.025] transition hover:bg-amber-300/5" key={item._id}>
                          <td className="px-4 py-4 font-bold text-white">{formatCompetence(item.competence)}</td>
                          <td className="px-4 py-4"><StatusBadge value={item.status === 'OPEN' ? 'PARTIAL' : 'PAID'} label={item.status === 'OPEN' ? 'Aberto' : 'Fechado'} /></td>
                          <td className="px-4 py-4 text-slate-300">{formatCents(item.revenueForecast)}</td><td className="px-4 py-4 font-bold text-emerald-100">{formatCents(item.revenueReceived)}</td><td className="px-4 py-4 text-emerald-100">{formatCents(item.bankInflow)}</td><td className="px-4 py-4 text-red-100">{formatCents(item.bankOutflow)}</td><td className="px-4 py-4 text-slate-300">{formatCents(item.openingBankBalance)}</td><td className="px-4 py-4 text-slate-300">{formatCents(item.closingBankBalance)}</td><td className="px-4 py-4 font-bold text-white">{formatCents(item.availableBalance)}</td>
                          <td className="px-4 py-4 text-slate-300">{item.notes ?? 'Sem notas'}</td>
                          <td className="px-4 py-4"><div className="flex justify-end"><button className={iconActionClass} onClick={() => openStatusModal(item)} title="Editar status" type="button" aria-label={`Editar fechamento ${item.competence}`}><Pencil size={16} /></button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {items.length === 0 ? <div className="p-8 text-center text-slate-300">Nenhum fechamento salvo para esta competência.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>

      {showSnapshotModal ? (
        <Modal title="Gerar snapshot" subtitle="Salva os indicadores atuais da competência." onClose={() => setShowSnapshotModal(false)}>
          <form className="form-grid compact-form" onSubmit={submitSnapshot}>
            <label>Competência<input required type="month" value={form.competence} onChange={(event) => setForm({ ...form, competence: event.target.value })} /></label>
            <label className="wide-field">Notas<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar snapshot'}</button>
          </form>
        </Modal>
      ) : null}

      {showStatusModal ? (
        <Modal title="Editar fechamento" subtitle={selected ? formatCompetence(selected.competence) : undefined} onClose={() => setShowStatusModal(false)}>
          <form className="form-grid compact-form" onSubmit={submitStatus}>
            <label>Status<select value={statusForm.status} onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value as StatusForm['status'] })}><option value="OPEN">Aberto</option><option value="CLOSED">Fechado</option></select></label>
            <label className="wide-field">Notas<textarea value={statusForm.notes} onChange={(event) => setStatusForm({ ...statusForm, notes: event.target.value })} /></label>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar fechamento'}</button>
          </form>
        </Modal>
      ) : null}
      </div>
    </div>
  );
}

type ClosingMetricProps = { icon: typeof Archive; label: string; value: string; hint: string };

function ClosingMetric({ icon: Icon, label, value, hint }: ClosingMetricProps) {
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">{label}</p><Icon className="h-4 w-4 text-amber-200" /></div>
      <strong className="mt-2 block truncate text-2xl font-black text-white">{value}</strong>
      <span className="mt-1 block text-sm text-slate-300">{hint}</span>
    </div>
  );
}

function ClosingTile({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const toneClass = {
    default: 'border-white/10 bg-white/[0.06]',
    success: 'border-emerald-300/20 bg-emerald-300/10',
    warning: 'border-amber-300/20 bg-amber-300/10',
    danger: 'border-red-300/25 bg-red-400/10'
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 text-white ${toneClass}`}>
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <strong className="mt-2 block text-lg font-black text-white">{value}</strong>
    </div>
  );
}
