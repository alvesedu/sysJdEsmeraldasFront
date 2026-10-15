import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import { MoneyInput } from '../components/MoneyInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildManualChargePaymentPayload } from '../utils/formWorkflows';
import { formatCompetence } from '../utils/competence';
import { centsToReaisInput, formatCents } from '../utils/money';
import { parseQuickPaymentText, type QuickEntryDraft } from '../utils/quickEntryParser';
import type { Charge, QuickEntryRun, Unit } from '../types/domain';
import { AlertCircle, Banknote, CheckCircle2, ClipboardList, History, Save, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';

type PaymentMethod = 'PIX' | 'CASH' | 'BANK_TRANSFER' | 'BOLETO' | 'OTHER';
type ReviewState = {
  item: QuickEntryDraft;
  chargeId: string;
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  notes: string;
};
type QuickFilter = 'ALL' | 'PAID' | 'UNPAID' | 'WITH_AMOUNT' | 'WITHOUT_AMOUNT' | 'CONFIRMED';

const sampleText = `1 - Abraão
2 - Alan Maicon ✅
7 - Amadeu/Dulce✅125,00
9 - Caio Silva ✅✅(set/out)
70 - Outros aluguel do salão✅200,00`;

const fieldClass = 'mt-2 min-h-48 w-full rounded-3xl border border-white/10 bg-slate-950/55 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const inputClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const labelClass = 'text-sm font-semibold text-slate-300';
const primaryActionClass = 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:scale-[1.01] hover:shadow-amber-500/20';

export function QuickEntryPage() {
  const [rawText, setRawText] = useState('');
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');
  const [items, setItems] = useState<QuickEntryDraft[]>([]);
  const [openCharges, setOpenCharges] = useState<Charge[]>([]);
  const [runs, setRuns] = useState<QuickEntryRun[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [confirmedLines, setConfirmedLines] = useState<Record<string, string>>({});
  const [review, setReview] = useState<ReviewState | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingRun, setSavingRun] = useState(false);
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [archivingRunId, setArchivingRunId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadOpenCharges() {
    const { data } = await api.get('/charges', { params: { status: 'PENDING' } });
    const pending = data.items as Charge[];
    const { data: partialData } = await api.get('/charges', { params: { status: 'PARTIAL' } });
    setOpenCharges([...pending, ...(partialData.items as Charge[])].filter((charge) => charge.openBalance > 0));
  }

  async function loadRuns() {
    const { data } = await api.get('/quick-entry-runs', { params: { limit: 8 } });
    setRuns(data.items as QuickEntryRun[]);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/charges', { params: { status: 'PENDING' } }),
      api.get('/charges', { params: { status: 'PARTIAL' } }),
      api.get('/quick-entry-runs', { params: { limit: 8 } })
    ])
      .then(([pendingResponse, partialResponse, runsResponse]) => {
        if (!active) return;
        const pending = pendingResponse.data.items as Charge[];
        const partial = partialResponse.data.items as Charge[];
        setOpenCharges([...pending, ...partial].filter((charge) => charge.openBalance > 0));
        setRuns(runsResponse.data.items as QuickEntryRun[]);
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar dados do lançamento rápido.'));
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleItems = useMemo(() => {
    const needle = search.toLocaleLowerCase('pt-BR');
    return items.filter((item) => {
      const matchesSearch = !needle || `${item.payerName} ${item.rawText}`.toLocaleLowerCase('pt-BR').includes(needle);
      if (!matchesSearch) return false;
      return matchesQuickFilter(item, quickFilter, confirmedLines);
    });
  }, [confirmedLines, items, quickFilter, search]);

  const totals = useMemo(() => visibleItems.reduce((acc, item) => ({
    lines: acc.lines + 1,
    paid: acc.paid + (item.paid ? 1 : 0),
    amount: acc.amount + (item.amountCents ?? 0),
    review: acc.review + (item.paid && item.amountCents === null ? 1 : 0)
  }), { lines: 0, paid: 0, amount: 0, review: 0 }), [visibleItems]);

  const previousRun = useMemo(() => runs.find((run) => run._id !== currentRunId) ?? null, [currentRunId, runs]);
  const comparison = useMemo(() => compareWithPreviousRun(items, previousRun), [items, previousRun]);

  function processText(text = rawText) {
    setItems(parseQuickPaymentText(text));
    setConfirmedLines({});
    setCurrentRunId(null);
    setMessage('');
  }

  function loadSample() {
    setRawText(sampleText);
    processText(sampleText);
  }

  function openReview(item: QuickEntryDraft) {
    const suggested = suggestCharge(item, openCharges);
    setReview({
      item,
      chargeId: suggested?._id ?? '',
      amount: item.amountCents !== null ? centsToReaisInput(item.amountCents) : suggested ? centsToReaisInput(suggested.openBalance) : '',
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'PIX',
      notes: item.rawText
    });
    setMessage('');
  }

  async function confirmPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!review) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const runId = await ensureCurrentRunId();
      const result = await api.post(`/charges/${review.chargeId}/manual-payments`, buildManualChargePaymentPayload({
        ...review,
        quickEntryRunId: runId,
        quickEntryLineNumber: review.item.lineNumber
      }));
      setConfirmedLines((current) => ({ ...current, [lineKey(review.item)]: review.chargeId }));
      const { data: savedRun } = await api.get(`/quick-entry-runs/${runId}`);
      setItems((savedRun.items ?? []) as QuickEntryDraft[]);
      setReview(null);
      setConfirmedLines(confirmedMap(savedRun.items ?? []));
      setMessage(`Baixa confirmada a partir do lançamento rápido (${result.data.payment?._id ? 'registrada' : 'processada'}).`);
      await loadOpenCharges();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível confirmar a baixa.'));
    } finally {
      setSaving(false);
    }
  }

  async function ensureCurrentRunId() {
    if (currentRunId) return currentRunId;
    const parsedItems = items.length ? items : parseQuickPaymentText(rawText);
    const { data } = await api.post('/quick-entry-runs', {
      label: quickRunLabel(),
      rawText,
      items: parsedItems
    });
    const saved = data as QuickEntryRun;
    setCurrentRunId(saved._id);
    setItems((saved.items ?? parsedItems) as QuickEntryDraft[]);
    setRuns((current) => [saved, ...current.filter((run) => run._id !== saved._id)]);
    return saved._id;
  }

  async function saveCurrentRun() {
    const parsedItems = items.length ? items : parseQuickPaymentText(rawText);
    if (!rawText.trim() || parsedItems.length === 0) {
      setError('Cole e processe uma lista antes de salvar a rodada.');
      return;
    }
    setSavingRun(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/quick-entry-runs', {
        label: quickRunLabel(),
        rawText,
        items: parsedItems
      });
      const saved = data as QuickEntryRun;
      setItems((saved.items ?? parsedItems) as QuickEntryDraft[]);
      setCurrentRunId(saved._id);
      setConfirmedLines(confirmedMap(saved.items ?? []));
      setMessage('Rodada salva. Você pode comparar esta lista com as rodadas anteriores.');
      await loadRuns();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível salvar a rodada.'));
    } finally {
      setSavingRun(false);
    }
  }

  async function loadRun(runId: string) {
    setLoadingRunId(runId);
    setError('');
    setMessage('');
    try {
      const { data } = await api.get(`/quick-entry-runs/${runId}`);
      const run = data as QuickEntryRun;
      setRawText(run.rawText ?? '');
      setItems((run.items ?? []) as QuickEntryDraft[]);
      setConfirmedLines(confirmedMap(run.items ?? []));
      setCurrentRunId(run._id);
      setMessage(`Rodada carregada: ${run.label}.`);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar a rodada.'));
    } finally {
      setLoadingRunId(null);
    }
  }

  async function archiveRun(run: QuickEntryRun) {
    setArchivingRunId(run._id);
    setError('');
    try {
      await api.patch(`/quick-entry-runs/${run._id}/archive`);
      setRuns((current) => current.filter((item) => item._id !== run._id));
      if (currentRunId === run._id) setCurrentRunId(null);
      setMessage(`Rodada ${run.label} arquivada.`);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível arquivar a rodada.'));
    } finally {
      setArchivingRunId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.14),_transparent_34%),linear-gradient(135deg,_#07111f_0%,_#0f172a_54%,_#0b1324_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Operação assistida
                </span>
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Lançamento rápido</h1>
                  <p className="text-base leading-7 text-slate-300 sm:text-lg">Cole listas do WhatsApp para criar uma triagem de pagamentos antes de lançar qualquer baixa financeira.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <QuickMetric icon={ClipboardList} label="Linhas" value={`${totals.lines}`} hint="Interpretadas" />
                <QuickMetric icon={CheckCircle2} label="Pagas" value={`${totals.paid}`} hint="Com marca" />
                <QuickMetric icon={Banknote} label="Valores" value={formatCents(totals.amount)} hint="Detectados" />
                <QuickMetric icon={AlertCircle} label="Revisar" value={`${totals.review}`} hint="Pagas sem valor" />
              </div>
            </div>

            <Card className="border-white/10 bg-slate-950/45 text-white shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Texto de origem
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <label className={labelClass}>Lista do WhatsApp<textarea className={fieldClass} value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder="Cole aqui a lista de pagamentos..." /></label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button className={primaryActionClass} onClick={() => processText()} type="button">Processar lista</button>
                  <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-2.5 text-sm font-black text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50" disabled={savingRun} onClick={saveCurrentRun} type="button">
                    <Save className="h-4 w-4" />
                    {savingRun ? 'Salvando...' : 'Salvar rodada'}
                  </button>
                  <button className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-bold text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-300/10" onClick={loadSample} type="button">Usar exemplo</button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <Alert className="border-amber-300/25 bg-amber-300/10 text-amber-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Esta tela não faz baixa automática em massa. Cada linha precisa ser revisada, vinculada a uma cobrança aberta e confirmada individualmente.</AlertDescription>
        </Alert>
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

        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
            <CardHeader>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Comparação</p>
              <CardTitle className="text-lg text-white">Pendências contra rodada anterior</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {previousRun ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <QuickMetric icon={AlertCircle} label="Ainda sem ✅" value={`${comparison.currentUnpaid}`} hint="Na lista atual" />
                    <QuickMetric icon={CheckCircle2} label="Regularizados" value={`${comparison.resolvedFromPrevious}`} hint="Antes sem ✅, agora com ✅" />
                    <QuickMetric icon={Users} label="Pendentes prévios" value={`${comparison.previousUnpaid}`} hint={previousRun.label} />
                  </div>
                  {comparison.currentUnpaidNames.length ? (
                    <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Para revisar agora</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {comparison.currentUnpaidNames.slice(0, 24).map((name) => (
                          <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-100" key={name}>{name}</span>
                        ))}
                        {comparison.currentUnpaidNames.length > 24 ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">+{comparison.currentUnpaidNames.length - 24}</span> : null}
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-bold text-emerald-100">Nenhuma pendência sem ✅ na lista atual.</p>
                  )}
                </>
              ) : (
                <p className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-300">Salve uma rodada e processe uma nova lista para comparar pendências entre execuções.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <History className="h-4 w-4 text-amber-300" />
                Rodadas recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {runs.length ? runs.map((run) => (
                <div className={`rounded-3xl border p-4 transition ${currentRunId === run._id ? 'border-amber-300/35 bg-amber-300/10' : 'border-white/10 bg-slate-950/35'}`} key={run._id}>
                  <div className="flex items-start justify-between gap-3">
                    <button className="min-w-0 flex-1 text-left hover:opacity-80" disabled={loadingRunId === run._id} onClick={() => loadRun(run._id)} type="button">
                      <p className="font-black text-white">{run.label}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(run.createdAt)}</p>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-slate-200">{run.totals.lines}</span>
                      <button className="rounded-xl border border-white/10 px-2 py-1 text-xs font-bold text-slate-400 transition hover:border-rose-300/30 hover:text-rose-100" disabled={archivingRunId === run._id} onClick={() => void archiveRun(run)} type="button">{archivingRunId === run._id ? '...' : 'Arquivar'}</button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{run.totals.paid} com ✅, {run.totals.unpaid} sem ✅, {formatCents(run.totals.amountCents)} detectados.</p>
                </div>
              )) : <p className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-300">Nenhuma rodada salva ainda.</p>}
            </CardContent>
          </Card>
        </div>

        {review ? (
          <Modal title="Revisar e baixar pagamento" subtitle={review.item.payerName || 'Linha sem nome'} onClose={() => setReview(null)}>
            <form className="form-grid compact-form" onSubmit={confirmPayment}>
              <label className="wide-field">Cobrança aberta<select required value={review.chargeId} onChange={(event) => setReview({ ...review, chargeId: event.target.value })}><option value="">Selecione a cobrança</option>{openCharges.map((charge) => <option key={charge._id} value={charge._id}>{chargeOptionLabel(charge)}</option>)}</select></label>
              <label>Valor pago (R$)<MoneyInput required value={review.amount} onChange={(amount) => setReview({ ...review, amount })} /></label>
              <label>Data do pagamento<input required type="date" value={review.paymentDate} onChange={(event) => setReview({ ...review, paymentDate: event.target.value })} /></label>
              <label>Forma de pagamento<select required value={review.paymentMethod} onChange={(event) => setReview({ ...review, paymentMethod: event.target.value as PaymentMethod })}><option value="PIX">PIX</option><option value="CASH">Dinheiro</option><option value="BANK_TRANSFER">Transferência</option><option value="BOLETO">Boleto</option><option value="OTHER">Outro</option></select></label>
              <label className="wide-field">Observação<textarea value={review.notes} onChange={(event) => setReview({ ...review, notes: event.target.value })} /></label>
              <p className="confirm-message">Confira a cobrança selecionada antes de confirmar. A baixa será gravada no financeiro.</p>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Confirmando...' : 'Confirmar baixa'}</button>
            </form>
          </Modal>
        ) : null}

        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="gap-4 space-y-0 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Triagem</p>
              <CardTitle className="mt-2 text-xl text-white">Linhas interpretadas</CardTitle>
            </div>
            <div className="grid w-full gap-3 lg:max-w-xl">
              <label className={labelClass}>
                Buscar
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input className={`${inputClass} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou observação" />
                </div>
              </label>
              <div className="flex flex-wrap gap-2">
                {quickFilters.map((filter) => (
                  <button
                    className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${quickFilter === filter.value ? 'border-amber-300/40 bg-amber-300/15 text-amber-100' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-amber-300/30 hover:bg-amber-300/10'}`}
                    key={filter.value}
                    onClick={() => setQuickFilter(filter.value)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-3xl border border-white/10">
              <div className="overflow-x-auto">
                  <table className="quick-entry-table min-w-[1240px] w-full border-collapse text-left">
                  <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400"><tr><th className="px-4 py-4">#</th><th className="px-4 py-4">Pagador</th><th className="px-4 py-4">Pago?</th><th className="px-4 py-4">Valor</th><th className="px-4 py-4">Meses citados</th><th className="px-4 py-4">Confiança</th><th className="px-4 py-4">Linha original</th><th className="px-4 py-4 text-right">Ação</th></tr></thead>
                  <tbody className="divide-y divide-white/10">
                    {visibleItems.map((item) => {
                      const confirmed = confirmedLines[lineKey(item)];
                      return (
                        <tr className="bg-white/[0.025] transition hover:bg-emerald-300/5" key={`${item.lineNumber}-${item.rawText}`}>
                          <td className="px-4 py-4 font-black text-white" data-label="#">{item.sequence ?? item.lineNumber}</td>
                          <td className="px-4 py-4 font-bold text-white" data-label="Pagador">{item.payerName || 'Revisar nome'}{item.suggestionReason ? <small className="mt-1 block font-normal text-emerald-200">{item.suggestionConfidence === 'HIGH' ? 'Vínculo sugerido' : 'Vínculo para revisar'}</small> : null}</td>
                          <td className="px-4 py-4" data-label="Pago?">{item.paid ? <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">Sim</span> : <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">Não</span>}</td>
                          <td className="px-4 py-4 font-bold text-amber-100" data-label="Valor">{item.amountCents === null ? 'Revisar' : formatCents(item.amountCents)}</td>
                          <td className="px-4 py-4 text-slate-300" data-label="Meses citados">{item.periodHints.length ? item.periodHints.join(', ') : '-'}</td>
                          <td className="px-4 py-4" data-label="Confiança"><ConfidenceBadge value={item.confidence} /></td>
                          <td className="px-4 py-4 text-slate-300" data-label="Linha original">{item.rawText}</td>
                          <td className="px-4 py-4" data-label="Ação"><div className="flex justify-end">{confirmed ? <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">Baixado</span> : <button className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-100 transition hover:border-amber-300/40 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-40" disabled={!item.paid} onClick={() => openReview(item)} type="button">Revisar</button>}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {visibleItems.length === 0 ? <div className="p-8 text-center text-slate-300">Cole uma lista e clique em processar para começar.</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type QuickMetricProps = { icon: typeof Users; label: string; value: string; hint: string };

function QuickMetric({ icon: Icon, label, value, hint }: QuickMetricProps) {
  return (
    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-100">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">{label}</p><Icon className="h-4 w-4 text-emerald-100" /></div>
      <strong className="mt-2 block truncate text-xl font-black text-white">{value}</strong>
      <span className="mt-1 block text-sm text-slate-300">{hint}</span>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: QuickEntryDraft['confidence'] }) {
  const label = { HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' }[value];
  const tone = {
    HIGH: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
    MEDIUM: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
    LOW: 'border-red-300/25 bg-red-400/10 text-red-100'
  }[value];
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${tone}`}>{label}</span>;
}

function lineKey(item: QuickEntryDraft) {
  return `${item.lineNumber}:${item.rawText}`;
}

function confirmedMap(items: Array<QuickEntryDraft | { lineNumber: number; rawText: string; confirmedChargeId?: unknown }>) {
  return Object.fromEntries(
    items
      .filter((item) => Boolean(item.confirmedChargeId))
      .map((item) => [
        lineKey(item as QuickEntryDraft),
        typeof item.confirmedChargeId === 'string'
          ? item.confirmedChargeId
          : String((item.confirmedChargeId as { _id?: string } | null)?._id ?? '')
      ])
  );
}

const quickFilters: Array<{ value: QuickFilter; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PAID', label: 'Com ✅' },
  { value: 'UNPAID', label: 'Sem ✅' },
  { value: 'WITH_AMOUNT', label: 'Com valor' },
  { value: 'WITHOUT_AMOUNT', label: 'Sem valor' },
  { value: 'CONFIRMED', label: 'Já baixados' }
];

function matchesQuickFilter(
  item: QuickEntryDraft,
  filter: QuickFilter,
  confirmedLines: Record<string, string>
) {
  switch (filter) {
    case 'PAID':
      return item.paid;
    case 'UNPAID':
      return !item.paid;
    case 'WITH_AMOUNT':
      return item.amountCents !== null;
    case 'WITHOUT_AMOUNT':
      return item.amountCents === null;
    case 'CONFIRMED':
      return Boolean(confirmedLines[lineKey(item)]);
    case 'ALL':
    default:
      return true;
  }
}

function suggestCharge(item: QuickEntryDraft, charges: Charge[]) {
  const needle = item.payerName.toLocaleLowerCase('pt-BR');
  if (!needle) return null;
  return charges.find((charge) => chargeOptionLabel(charge).toLocaleLowerCase('pt-BR').includes(needle)) ?? null;
}

function chargeOptionLabel(charge: Charge) {
  const unit = unitOf(charge);
  const resident = unit?.residentCurrentId && typeof unit.residentCurrentId !== 'string' ? unit.residentCurrentId.name : 'Sem morador';
  const unitLabel = unit ? `${unit.quadra} ${unit.tipo === 'CASA' ? 'Casa' : 'Lote'} ${unit.numero}` : 'Unidade';
  return `${resident} - ${unitLabel} - ${formatCompetence(charge.competence)} - deve ${formatCents(charge.openBalance)}`;
}

function unitOf(charge: Charge) {
  return typeof charge.unitId === 'string' ? null : charge.unitId as Unit;
}

function quickRunLabel() {
  return `Rodada ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function compareWithPreviousRun(items: QuickEntryDraft[], previousRun: QuickEntryRun | null) {
  const currentUnpaidItems = items.filter((item) => !item.paid);
  const previousItems = previousRun?.items ?? [];
  const previousUnpaidKeys = new Set(previousItems.filter((item) => !item.paid).map((item) => payerKey(item.payerName)));
  const resolvedFromPrevious = items.filter((item) => item.paid && previousUnpaidKeys.has(payerKey(item.payerName))).length;

  return {
    currentUnpaid: currentUnpaidItems.length,
    previousUnpaid: previousUnpaidKeys.size,
    resolvedFromPrevious,
    currentUnpaidNames: currentUnpaidItems.map((item) => item.payerName || item.rawText).filter(Boolean)
  };
}

function payerKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}
