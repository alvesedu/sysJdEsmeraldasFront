import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { MoneyInput } from '../components/MoneyInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AlertCircle, ArrowRight, BadgeCheck, Banknote, CalendarDays, CheckCircle2, Filter, Landmark, ListChecks, Receipt, RotateCcw, Search, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { currentCompetence, formatCompetence } from '../utils/competence';
import { buildCreditAllocationPayload } from '../utils/formWorkflows';
import { formatCents, reaisInputToCents } from '../utils/money';

type ReconciliationStatus = 'UNMATCHED' | 'PARTIALLY_MATCHED' | 'MATCHED';
type Credit = {
  _id: string;
  bankImportId: string;
  operationDate: string | null;
  postingDate: string;
  counterpartyOriginalName: string | null;
  description: string;
  transactionType: string;
  amount: number;
  allocatedAmount: number;
  remainingAmount: number;
  status: ReconciliationStatus;
};
type Resident = { _id: string; name: string; unitId?: Unit | string | null };
type Unit = {
  _id: string;
  quadra: string;
  numero: string;
  tipo: 'CASA' | 'LOTE';
  unitKey: string;
  residentCurrentId?: Resident | null;
};
type Charge = {
  _id: string;
  competence: string;
  valueOriginal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
};
type Allocation = {
  _id: string;
  amount: number;
  paymentDate: string;
  reversedAt: string | null;
  reversalReason: string | null;
  chargeId: Charge;
};
type ManualPaymentCandidate = Allocation & {
  source: 'MANUAL';
  unitId: Unit;
  createdBy?: { name?: string } | string;
};
type Detail = {
  transaction: Credit;
  suggestedUnit: Unit | null;
  suggestionReason: 'BANK_ALIAS' | null;
  openCharges: Charge[];
  allocations: Allocation[];
  manualPaymentCandidates: ManualPaymentCandidate[];
  allocatedAmount: number;
  remainingAmount: number;
};
type BankImport = { _id: string; originalFileName: string };

const initialFilters = { competence: '', status: 'UNMATCHED', counterparty: '', importId: '' };
const fieldClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const labelClass = 'text-sm font-semibold text-slate-300';
const primaryActionClass = 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:scale-[1.01] hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100';
const ghostActionClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-slate-200 transition hover:border-amber-300/35 hover:bg-amber-300/10';

export function ReconciliationPage() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [imports, setImports] = useState<BankImport[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [paymentCompetence, setPaymentCompetence] = useState(currentCompetence());
  const [unitSearch, setUnitSearch] = useState('');
  const [charges, setCharges] = useState<Charge[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saveAlias, setSaveAlias] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [linkingAllocationId, setLinkingAllocationId] = useState<string | null>(null);
  const [generatingCharges, setGeneratingCharges] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [allocationToReverse, setAllocationToReverse] = useState<Allocation | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/units'), api.get('/residents'), api.get('/bank-imports')])
      .then(([unitResponse, residentResponse, importResponse]) => {
        setUnits(unitResponse.data.items);
        setResidents(residentResponse.data.items);
        setImports(importResponse.data.items);
      })
      .catch(() => setError('Não foi possível carregar moradores, unidades e importações.'));
  }, []);

  useEffect(() => {
    let active = true;
    const params = Object.fromEntries(Object.entries(appliedFilters).filter(([, value]) => value));
    api.get('/bank-transactions/credits/unmatched', { params })
      .then(({ data }) => {
        if (active) setCredits(data.items);
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar os créditos bancários.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [appliedFilters]);

  async function loadCredits(selectId?: string) {
    setLoading(true);
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(appliedFilters).filter(([, value]) => value));
      const { data } = await api.get('/bank-transactions/credits/unmatched', { params });
      setCredits(data.items);
      if (selectId) await openCredit(selectId);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar os créditos bancários.'));
    } finally {
      setLoading(false);
    }
  }

  async function openCredit(id: string) {
    setError('');
    try {
      const { data } = await api.get(`/bank-transactions/${id}/reconciliation`);
      const next = data as Detail;
      setDetail(next);
      setSaveAlias(next.suggestionReason !== 'BANK_ALIAS');
      const initialCompetence = preferredPaymentCompetence(next.transaction, next.openCharges);
      setPaymentCompetence(initialCompetence);
      if (next.suggestedUnit) {
        setSelectedUnit(next.suggestedUnit);
        setSelectedResidentId(residentIdOfUnit(next.suggestedUnit));
        setUnitSearch(unitLabel(next.suggestedUnit));
        const filteredCharges = filterChargesByCompetence(next.openCharges, initialCompetence);
        setCharges(filteredCharges);
        setSuggestedAmounts(filteredCharges, next.remainingAmount);
      } else {
        setSelectedUnit(null);
        setSelectedResidentId('');
        setUnitSearch('');
        setCharges([]);
        setAmounts({});
      }
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível abrir a conciliação.'));
    }
  }

  async function chooseUnit(unit: Unit, competence = paymentCompetence) {
    setSelectedUnit(unit);
    setSelectedResidentId(residentIdOfUnit(unit));
    setUnitSearch(unitLabel(unit));
    try {
      const { data } = await api.get(`/units/${unit._id}/open-charges`, { params: { competence } });
      setCharges(data.items);
      setSuggestedAmounts(data.items, detail?.remainingAmount ?? 0);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar as cobranças da unidade.'));
    }
  }

  async function chooseResident(residentId: string) {
    setSelectedResidentId(residentId);
    const resident = residents.find((item) => item._id === residentId);
    const [unit] = resident ? unitsOfResident(resident, units) : [];
    if (!unit) {
      setSelectedUnit(null);
      setUnitSearch('');
      setCharges([]);
      setAmounts({});
      return;
    }
    await chooseUnit(unit);
  }

  async function changePaymentCompetence(value: string) {
    setPaymentCompetence(value);
    if (selectedUnit) await chooseUnit(selectedUnit, value);
  }

  async function generateChargesForPaymentCompetence() {
    if (!selectedUnit) return;
    setGeneratingCharges(true);
    setError('');
    setMessage('');
    try {
      await api.post('/charges/generate', { competence: paymentCompetence });
      await chooseUnit(selectedUnit, paymentCompetence);
      setMessage(`Cobranças de ${formatCompetence(paymentCompetence)} geradas. Revise o valor e confirme a conciliação.`);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível gerar a cobrança desta competência.'));
    } finally {
      setGeneratingCharges(false);
    }
  }

  function setSuggestedAmounts(openCharges: Charge[], available: number) {
    let remaining = available;
    const suggested: Record<string, string> = {};
    for (const charge of openCharges) {
      const cents = Math.min(remaining, charge.outstandingAmount);
      suggested[charge._id] = cents > 0 ? (cents / 100).toFixed(2).replace('.', ',') : '';
      remaining -= cents;
    }
    setAmounts(suggested);
  }

  async function confirmAllocation() {
    if (!detail || !selectedUnit) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const payload = buildCreditAllocationPayload(selectedUnit._id, charges.map((charge) => ({
        chargeId: charge._id,
        amountText: amounts[charge._id] ?? ''
      })), saveAlias);
      await api.post(`/bank-transactions/${detail.transaction._id}/allocate`, {
        ...payload
      });
      setShowConfirmModal(false);
      setMessage('Crédito conciliado e cobranças atualizadas com sucesso.');
      await loadCredits(detail.transaction._id);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível confirmar a conciliação.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function reverseAllocation(allocation = allocationToReverse) {
    if (!allocation || reverseReason.trim().length < 3 || !detail) return;
    try {
      await api.post(`/payment-allocations/${allocation._id}/reverse`, { reason: reverseReason.trim() });
      setAllocationToReverse(null);
      setReverseReason('');
      setMessage('Alocação estornada e saldos recalculados.');
      await loadCredits(detail.transaction._id);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível estornar a alocação.'));
    }
  }

  async function linkManualPayment(candidate: ManualPaymentCandidate) {
    if (!detail) return;
    setLinkingAllocationId(candidate._id);
    setError('');
    setMessage('');
    try {
      await api.post(`/bank-transactions/${detail.transaction._id}/link-manual-payment`, { allocationId: candidate._id });
      setMessage('Baixa manual conferida e vinculada ao crédito bancário sem duplicar o pagamento.');
      await loadCredits(detail.transaction._id);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível vincular a baixa manual.'));
    } finally {
      setLinkingAllocationId(null);
    }
  }

  const normalizedSearch = unitSearch.trim().toLocaleLowerCase('pt-BR');
  const matchingUnits = normalizedSearch && (!selectedUnit || unitSearch !== unitLabel(selectedUnit))
    ? units.filter((unit) => unitSearchText(unit).includes(normalizedSearch)).slice(0, 8)
    : [];
  const enteredTotal = charges.reduce((sum, charge) => sum + parseMoneyToCents(amounts[charge._id] ?? ''), 0);
  const projectedRemaining = Math.max((detail?.remainingAmount ?? 0) - enteredTotal, 0);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(247,185,85,0.16),_transparent_34%),linear-gradient(135deg,_#07111f_0%,_#0f172a_54%,_#0b1324_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Conciliação bancária
                </span>
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                    Transforme entradas em pagamentos confirmados.
                  </h1>
                  <p className="text-base leading-7 text-slate-300 sm:text-lg">
                    Revise créditos importados, selecione morador, competência e unidade, e distribua o valor com segurança entre as cobranças abertas.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <ReconciliationMetric icon={Landmark} label="Créditos na fila" value={`${credits.length}`} hint="Itens filtrados" />
                <ReconciliationMetric icon={WalletCards} label="Selecionado" value={detail ? formatCents(detail.transaction.amount) : 'R$ 0,00'} hint="Valor recebido" />
                <ReconciliationMetric icon={Receipt} label="Alocado agora" value={formatCents(enteredTotal)} hint="Distribuição atual" />
              </div>
            </div>

            <Card className="border-white/10 bg-slate-950/45 text-white shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Filter className="h-4 w-4 text-amber-300" />
                  Filtros operacionais
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>Competência<input className={fieldClass} type="month" value={filters.competence} onChange={(event) => setFilters({ ...filters, competence: event.target.value })} /></label>
                  <label className={labelClass}>Status<select className={fieldClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Todos</option><option value="UNMATCHED">Não conciliado</option><option value="PARTIALLY_MATCHED">Parcial</option><option value="MATCHED">Conciliado</option></select></label>
                  <label className={labelClass}>Nome bancário<input className={fieldClass} placeholder="Buscar pagador" value={filters.counterparty} onChange={(event) => setFilters({ ...filters, counterparty: event.target.value })} /></label>
                  <label className={labelClass}>Importação<select className={fieldClass} value={filters.importId} onChange={(event) => setFilters({ ...filters, importId: event.target.value })}><option value="">Todas</option>{imports.map((item) => <option key={item._id} value={item._id}>{item.originalFileName}</option>)}</select></label>
                </div>
                <button className={primaryActionClass} onClick={() => { setLoading(true); setError(''); setAppliedFilters(filters); }} type="button">
                  <Search className="h-4 w-4" />
                  Filtrar créditos
                </button>
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

        <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-hidden">
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Caixa de entrada</p>
                <CardTitle className="mt-2 flex items-center gap-2 text-xl text-white">
                  <Banknote className="h-5 w-5 text-amber-300" />
                  Créditos bancários
                </CardTitle>
              </div>
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">{credits.length}</span>
            </CardHeader>
            <CardContent>
              <div className="max-h-[min(620px,calc(100vh-15rem))] space-y-2 overflow-y-auto pr-1 [scrollbar-color:rgba(247,185,85,.5)_transparent] [scrollbar-width:thin]" role="list" aria-label="Créditos bancários para conciliação">
                {loading ? Array.from({ length: 6 }).map((_, index) => <Skeleton className="h-20 rounded-2xl bg-white/10" key={index} />) : null}
                {!loading && credits.map((credit, index) => (
                  <button
                    key={`${credit._id}-${index}`}
                    className={cn(
                      'group grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-2xl border border-white/10 bg-slate-950/35 p-3 text-left transition hover:border-amber-300/35 hover:bg-amber-300/10',
                      detail?.transaction._id === credit._id && 'border-amber-300/60 bg-amber-300/15 shadow-lg shadow-amber-950/20'
                    )}
                    onClick={() => openCredit(credit._id)}
                    title={credit.counterpartyOriginalName || credit.description}
                    type="button"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-black text-white">{credit.counterpartyOriginalName || credit.description}</strong>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(credit.operationDate ?? credit.postingDate)}
                        <StatusPill status={credit.status} />
                      </span>
                    </span>
                    <span className="grid justify-items-end gap-1">
                      <strong className="text-sm font-black text-emerald-100">{formatCents(credit.amount)}</strong>
                      <small className="text-xs text-slate-400">{formatCents(credit.remainingAmount)} restante</small>
                    </span>
                  </button>
                ))}
                {!loading && credits.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-amber-200" />
                    <p className="mt-3 text-sm font-semibold text-slate-200">Nenhum crédito encontrado para estes filtros.</p>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[620px] border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
            <CardContent className="p-5 lg:p-6">
              {!detail ? (
                <div className="flex min-h-[560px] items-center justify-center">
                  <div className="max-w-md text-center">
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-amber-300/35 bg-amber-300/10 text-xl font-black text-amber-200">01</span>
                    <h2 className="mt-5 text-2xl font-black text-white">Selecione um crédito</h2>
                    <p className="mt-2 leading-7 text-slate-300">Confira a evidência bancária e escolha como distribuir o valor entre as cobranças.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <section className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-slate-950/35 p-5 lg:flex-row lg:items-start">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Transação</p>
                      <h2 className="mt-2 truncate text-2xl font-black text-white">{detail.transaction.counterpartyOriginalName || detail.transaction.description}</h2>
                      <p className="mt-2 text-sm text-slate-400">{formatDate(detail.transaction.operationDate ?? detail.transaction.postingDate)} · {typeLabel(detail.transaction.transactionType)}</p>
                    </div>
                    <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-left lg:text-right">
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Valor recebido</span>
                      <strong className="mt-1 block text-3xl font-black text-white">{formatCents(detail.transaction.amount)}</strong>
                    </div>
                  </section>

                  {detail.suggestedUnit ? (
                    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-emerald-100 sm:flex-row sm:items-center">
                      <span className="inline-flex items-center gap-2 font-bold"><BadgeCheck className="h-4 w-4" /> Sugestão baseada em pagamento anterior</span>
                      <span className="text-sm text-emerald-50">{unitLabel(detail.suggestedUnit)}</span>
                    </div>
                  ) : null}

                  <section className="relative grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 lg:grid-cols-3">
                    <label className={labelClass}>Morador<select className={fieldClass} value={selectedResidentId} onChange={(event) => { void chooseResident(event.target.value); }}><option value="">Selecione o morador</option>{residentsWithUnit(residents, units).map((resident, index) => <option key={`${resident._id}-${index}`} value={resident._id}>{residentLabel(resident, units)}</option>)}</select></label>
                    <label className={labelClass}>Mês do pagamento<select className={fieldClass} value={paymentCompetence} onChange={(event) => { void changePaymentCompetence(event.target.value); }}>{paymentCompetenceOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label className={cn(labelClass, 'relative')}>Unidade ou morador<input className={fieldClass} placeholder="Quadra, número ou nome do morador" value={unitSearch} onChange={(event) => { setUnitSearch(event.target.value); setSelectedUnit(null); setSelectedResidentId(''); }} /></label>
                    {matchingUnits.length > 0 ? (
                      <div className="absolute left-4 right-4 top-[calc(100%-0.35rem)] z-20 grid rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-black/40 lg:left-auto lg:w-[calc((100%-2rem)/3)]">
                        {matchingUnits.map((unit) => <button className="flex justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10" key={unit._id} onClick={() => chooseUnit(unit)} type="button"><strong>{unitLabel(unit)}</strong><span className="text-slate-400">{unit.residentCurrentId?.name || 'Sem morador atual'}</span></button>)}
                      </div>
                    ) : null}
                  </section>

                  {selectedUnit ? (
                    <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Cobrança do mês</p>
                          <h3 className="mt-2 text-xl font-black text-white">{formatCompetence(paymentCompetence)} · {unitLabel(selectedUnit)}</h3>
                          <p className="mt-1 text-sm text-slate-400">{selectedUnit.residentCurrentId?.name || 'Sem morador atual'}</p>
                        </div>
                        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                          <ListChecks className="h-3.5 w-3.5 text-amber-200" />
                          {charges.length} cobrança(s)
                        </span>
                      </div>

                      <div className="space-y-3">
                        {charges.map((charge) => (
                          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-[1fr_180px] sm:items-center" key={charge._id}>
                            <div>
                              <strong className="text-white">{competenceLabel(charge.competence)}</strong>
                              <span className="mt-1 block text-sm text-slate-400">{formatCents(charge.outstandingAmount)} pendente</span>
                            </div>
                            <label className={labelClass}>Alocar (R$)<MoneyInput placeholder="0,00" value={amounts[charge._id] ?? ''} onChange={(value) => setAmounts({ ...amounts, [charge._id]: value })} /></label>
                          </div>
                        ))}
                        {charges.length === 0 ? (
                          <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-amber-300/35 bg-amber-300/10 p-6 text-center">
                            <p className="text-sm text-amber-50">Esta unidade não possui cobrança aberta para {formatCompetence(paymentCompetence)}.</p>
                            <button className={primaryActionClass} type="button" disabled={generatingCharges} onClick={() => void generateChargesForPaymentCompetence()}>
                              {generatingCharges ? 'Gerando...' : 'Gerar cobrança deste mês'}
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <AmountTile label="Crédito disponível" value={formatCents(detail.remainingAmount)} />
                        <AmountTile label="Alocado agora" value={formatCents(enteredTotal)} />
                        <AmountTile label="Restante projetado" value={enteredTotal > detail.remainingAmount ? 'Valor excedido' : formatCents(projectedRemaining)} danger={enteredTotal > detail.remainingAmount} />
                      </div>

                      <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                        <input className="mt-1 h-4 w-4 accent-amber-300" type="checkbox" checked={saveAlias} onChange={(event) => setSaveAlias(event.target.checked)} />
                        <span>Reconhecer este pagador automaticamente nas próximas importações</span>
                      </label>
                      <button className={cn(primaryActionClass, 'w-full')} disabled={submitting || enteredTotal <= 0 || enteredTotal > detail.remainingAmount} onClick={() => setShowConfirmModal(true)} type="button">
                        {submitting ? 'Confirmando...' : 'Confirmar conciliação'}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </section>
                  ) : null}

                  {detail.allocations.length > 0 ? (
                    <section className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                      <h3 className="flex items-center gap-2 text-lg font-black text-white"><RotateCcw className="h-5 w-5 text-amber-200" />Histórico de alocações</h3>
                      {detail.allocations.map((allocation) => (
                        <div className={cn('grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center', allocation.reversedAt && 'opacity-55 line-through')} key={allocation._id}>
                          <div>
                            <strong className="text-white">{allocation.chargeId.competence}</strong>
                            <span className="block text-sm text-slate-400">{formatDate(allocation.paymentDate)}</span>
                            {allocation.reversalReason ? <small className="text-slate-500">{allocation.reversalReason}</small> : null}
                          </div>
                          <strong className="text-white">{formatCents(allocation.amount)}</strong>
                          {!allocation.reversedAt ? <button className={ghostActionClass} onClick={() => setAllocationToReverse(allocation)} type="button">Estornar</button> : <span className="text-sm text-slate-400">Estornado</span>}
                        </div>
                      ))}
                    </section>
                  ) : null}

                  {detail.manualPaymentCandidates.length > 0 ? (
                    <section className="space-y-3 rounded-3xl border border-blue-300/20 bg-blue-300/5 p-5">
                      <div>
                        <h3 className="flex items-center gap-2 text-lg font-black text-white"><Receipt className="h-5 w-5 text-blue-200" />Baixas manuais para conferir</h3>
                        <p className="mt-1 text-sm text-slate-400">Vincule uma baixa já registrada ao crédito importado. Nenhuma nova baixa será criada.</p>
                      </div>
                      {detail.manualPaymentCandidates.map((candidate) => (
                        <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center" key={candidate._id}>
                          <div>
                            <strong className="text-white">{candidate.unitId ? unitLabel(candidate.unitId) : 'Unidade não informada'}</strong>
                            <span className="block text-sm text-slate-400">{candidate.chargeId.competence} · baixa manual em {formatDate(candidate.paymentDate)}</span>
                          </div>
                          <strong className="text-emerald-100">{formatCents(candidate.amount)}</strong>
                          <button className={ghostActionClass} disabled={linkingAllocationId === candidate._id} onClick={() => void linkManualPayment(candidate)} type="button">
                            {linkingAllocationId === candidate._id ? 'Vinculando...' : 'Vincular crédito'}
                          </button>
                        </div>
                      ))}
                    </section>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {showConfirmModal ? (
        <ConfirmDialog
          title="Confirmar conciliação"
          message={`Alocar ${formatCents(enteredTotal)} deste crédito. Restante projetado: ${formatCents(projectedRemaining)}.`}
          confirmLabel="Confirmar conciliação"
          loading={submitting}
          onCancel={() => setShowConfirmModal(false)}
          onConfirm={() => void confirmAllocation()}
        />
      ) : null}

      {allocationToReverse ? (
        <Modal title="Estornar alocação" subtitle={`Valor: ${formatCents(allocationToReverse.amount)}`} onClose={() => setAllocationToReverse(null)}>
          <form className="form-grid compact-form" onSubmit={(event) => { event.preventDefault(); void reverseAllocation(); }}>
            <label>Motivo do estorno<input required minLength={3} value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} /></label>
            <button className="primary-button danger-button" type="submit" disabled={reverseReason.trim().length < 3}>Estornar alocação</button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function unitLabel(unit: Unit) { return `Quadra ${unit.quadra} · ${unit.tipo === 'CASA' ? 'Casa' : 'Lote'} ${unit.numero}`; }
function unitSearchText(unit: Unit) { return `${unit.quadra} ${unit.numero} ${unit.tipo} ${unit.unitKey} ${unit.residentCurrentId?.name ?? ''}`.toLocaleLowerCase('pt-BR'); }
function formatDate(value: string) { return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); }
function competenceLabel(value: string) { const [year, month] = value.split('-'); return new Date(Number(year), Number(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); }
function statusLabel(status: ReconciliationStatus) { return { UNMATCHED: 'Não conciliado', PARTIALLY_MATCHED: 'Parcial', MATCHED: 'Conciliado' }[status]; }
function typeLabel(type: string) { return { PIX_RECEIVED: 'Pix recebido', TRANSFER_RECEIVED: 'Transferência recebida', OTHER: 'Outro crédito' }[type] ?? type; }
function parseMoneyToCents(value: string) { try { return reaisInputToCents(value); } catch { return 0; } }

type ReconciliationMetricProps = {
  icon: typeof Landmark;
  label: string;
  value: string;
  hint: string;
};

function ReconciliationMetric({ icon: Icon, label, value, hint }: ReconciliationMetricProps) {
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

function StatusPill({ status }: { status: ReconciliationStatus }) {
  const tone = {
    UNMATCHED: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    PARTIALLY_MATCHED: 'border-blue-300/20 bg-blue-300/10 text-blue-100',
    MATCHED: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
  }[status];

  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.12em]', tone)}>
      {statusLabel(status)}
    </span>
  );
}

function AmountTile({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={cn('rounded-2xl border p-4', danger ? 'border-red-300/25 bg-red-400/10' : 'border-white/10 bg-white/[0.04]')}>
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <strong className={cn('mt-2 block text-lg font-black', danger ? 'text-red-100' : 'text-white')}>{value}</strong>
    </div>
  );
}

function paymentCompetenceOptions() {
  const current = currentCompetence();
  return [
    { value: shiftCompetence(current, -1), label: `Anterior · ${formatCompetence(shiftCompetence(current, -1))}` },
    { value: current, label: `Atual · ${formatCompetence(current)}` },
    { value: shiftCompetence(current, 1), label: `Sucessivo · ${formatCompetence(shiftCompetence(current, 1))}` }
  ];
}

function preferredPaymentCompetence(transaction: Credit, charges: Charge[]) {
  const optionValues = paymentCompetenceOptions().map((option) => option.value);
  const firstOpenCharge = optionValues.find((competence) => charges.some((charge) => charge.competence === competence));
  if (firstOpenCharge) return firstOpenCharge;
  const transactionCompetence = (transaction.operationDate ?? transaction.postingDate).slice(0, 7);
  return optionValues.includes(transactionCompetence)
    ? transactionCompetence
    : currentCompetence();
}

function shiftCompetence(value: string, offset: number) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

function residentsWithUnit(residents: Resident[], units: Unit[]) {
  return residents.filter((resident) => unitsOfResident(resident, units).length > 0);
}

function residentLabel(resident: Resident, units: Unit[]) {
  const residentUnits = unitsOfResident(resident, units);
  if (residentUnits.length === 0) return resident.name;
  if (residentUnits.length === 1 && residentUnits[0]) return `${resident.name} · ${unitLabel(residentUnits[0])}`;
  return `${resident.name} · ${residentUnits.length} unidades`;
}

function unitsOfResident(resident: Resident, units: Unit[]) {
  return units.filter((unit) => residentIdOfUnit(unit) === resident._id);
}

function residentIdOfUnit(unit: Unit) {
  return typeof unit.residentCurrentId === 'object' && unit.residentCurrentId?._id ? unit.residentCurrentId._id : '';
}

function filterChargesByCompetence(charges: Charge[], competence: string) {
  return charges.filter((charge) => charge.competence === competence);
}
