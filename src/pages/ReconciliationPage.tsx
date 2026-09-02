import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { MoneyInput } from '../components/MoneyInput';
import { PageHeader } from '../components/PageHeader';
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
type Resident = { name: string };
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
type Detail = {
  transaction: Credit;
  suggestedUnit: Unit | null;
  suggestionReason: 'BANK_ALIAS' | null;
  openCharges: Charge[];
  allocations: Allocation[];
  allocatedAmount: number;
  remainingAmount: number;
};
type BankImport = { _id: string; originalFileName: string };

const initialFilters = { competence: '', status: 'UNMATCHED', counterparty: '', importId: '' };

export function ReconciliationPage() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [imports, setImports] = useState<BankImport[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [unitSearch, setUnitSearch] = useState('');
  const [charges, setCharges] = useState<Charge[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saveAlias, setSaveAlias] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/units'), api.get('/bank-imports')])
      .then(([unitResponse, importResponse]) => {
        setUnits(unitResponse.data.items);
        setImports(importResponse.data.items);
      })
      .catch(() => setError('Não foi possível carregar unidades e importações.'));
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
      if (next.suggestedUnit) {
        setSelectedUnit(next.suggestedUnit);
        setUnitSearch(unitLabel(next.suggestedUnit));
        setCharges(next.openCharges);
        setSuggestedAmounts(next.openCharges, next.remainingAmount);
      } else {
        setSelectedUnit(null);
        setUnitSearch('');
        setCharges([]);
        setAmounts({});
      }
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível abrir a conciliação.'));
    }
  }

  async function chooseUnit(unit: Unit) {
    setSelectedUnit(unit);
    setUnitSearch(unitLabel(unit));
    try {
      const { data } = await api.get(`/units/${unit._id}/open-charges`);
      setCharges(data.items);
      setSuggestedAmounts(data.items, detail?.remainingAmount ?? 0);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar as cobranças da unidade.'));
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
      setMessage('Crédito conciliado e cobranças atualizadas com sucesso.');
      await loadCredits(detail.transaction._id);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível confirmar a conciliação.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function reverseAllocation(allocation: Allocation) {
    const reason = window.prompt('Informe o motivo do estorno:');
    if (!reason || reason.trim().length < 3 || !detail) return;
    try {
      await api.post(`/payment-allocations/${allocation._id}/reverse`, { reason: reason.trim() });
      setMessage('Alocação estornada e saldos recalculados.');
      await loadCredits(detail.transaction._id);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível estornar a alocação.'));
    }
  }

  const normalizedSearch = unitSearch.trim().toLocaleLowerCase('pt-BR');
  const matchingUnits = normalizedSearch && (!selectedUnit || unitSearch !== unitLabel(selectedUnit))
    ? units.filter((unit) => unitSearchText(unit).includes(normalizedSearch)).slice(0, 8)
    : [];
  const enteredTotal = charges.reduce((sum, charge) => sum + parseMoneyToCents(amounts[charge._id] ?? ''), 0);
  const projectedRemaining = Math.max((detail?.remainingAmount ?? 0) - enteredTotal, 0);

  return (
    <div className="page reconciliation-page">
      <PageHeader title="Conciliação de entradas" subtitle="Transforme créditos bancários em pagamentos confirmados por unidade e competência." />

      <section className="panel reconciliation-filters">
        <label>Competência<input type="month" value={filters.competence} onChange={(event) => setFilters({ ...filters, competence: event.target.value })} /></label>
        <label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Todos</option><option value="UNMATCHED">Não conciliado</option><option value="PARTIALLY_MATCHED">Parcial</option><option value="MATCHED">Conciliado</option></select></label>
        <label>Nome bancário<input placeholder="Buscar pagador" value={filters.counterparty} onChange={(event) => setFilters({ ...filters, counterparty: event.target.value })} /></label>
        <label>Importação<select value={filters.importId} onChange={(event) => setFilters({ ...filters, importId: event.target.value })}><option value="">Todas</option>{imports.map((item) => <option key={item._id} value={item._id}>{item.originalFileName}</option>)}</select></label>
        <button className="primary-button" onClick={() => { setLoading(true); setError(''); setAppliedFilters(filters); }}>Filtrar</button>
      </section>

      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="alert success">{message}</div> : null}

      <div className="reconciliation-workspace">
        <section className="panel credit-inbox">
          <div className="section-heading"><div><p className="eyebrow">Caixa de entrada</p><h2>Créditos bancários</h2></div><span className="count-pill">{credits.length}</span></div>
          <div className="credit-list">
            {credits.map((credit) => (
              <button key={credit._id} className={`credit-item ${detail?.transaction._id === credit._id ? 'selected' : ''}`} onClick={() => openCredit(credit._id)}>
                <span className="credit-item-top"><strong>{credit.counterpartyOriginalName || credit.description}</strong><small>{formatDate(credit.operationDate ?? credit.postingDate)}</small></span>
                <span className="credit-item-money"><strong>{formatCents(credit.amount)}</strong><small>{formatCents(credit.remainingAmount)} restante</small></span>
                <span className={`status status-${credit.status.toLowerCase()}`}>{statusLabel(credit.status)}</span>
              </button>
            ))}
            {!loading && credits.length === 0 ? <p className="empty-state">Nenhum crédito encontrado para estes filtros.</p> : null}
            {loading ? <p className="loading-text">Carregando créditos...</p> : null}
          </div>
        </section>

        <section className="panel reconciliation-detail">
          {!detail ? <div className="reconciliation-empty"><span>01</span><h2>Selecione um crédito</h2><p>Confira a evidência bancária e escolha como distribuir o valor entre as cobranças.</p></div> : (
            <>
              <div className="transaction-strip">
                <div><p className="eyebrow">Transação</p><h2>{detail.transaction.counterpartyOriginalName || detail.transaction.description}</h2><p>{formatDate(detail.transaction.operationDate ?? detail.transaction.postingDate)} · {typeLabel(detail.transaction.transactionType)}</p></div>
                <div className="transaction-amount"><span>Valor recebido</span><strong>{formatCents(detail.transaction.amount)}</strong></div>
              </div>

              {detail.suggestedUnit ? <div className="alias-suggestion"><strong>Sugestão baseada em pagamento anterior</strong><span>{unitLabel(detail.suggestedUnit)}</span></div> : null}

              <div className="unit-picker">
                <label>Unidade ou morador<input placeholder="Quadra, número ou nome do morador" value={unitSearch} onChange={(event) => { setUnitSearch(event.target.value); setSelectedUnit(null); }} /></label>
                {matchingUnits.length > 0 ? <div className="unit-results">{matchingUnits.map((unit) => <button key={unit._id} onClick={() => chooseUnit(unit)}><strong>{unitLabel(unit)}</strong><span>{unit.residentCurrentId?.name || 'Sem morador atual'}</span></button>)}</div> : null}
              </div>

              {selectedUnit ? (
                <div className="charge-allocation">
                  <div className="section-heading"><div><p className="eyebrow">Cobranças abertas</p><h3>{unitLabel(selectedUnit)}</h3><p>{selectedUnit.residentCurrentId?.name || 'Sem morador atual'}</p></div></div>
                  <div className="charge-list">
                    {charges.map((charge) => (
                      <div className="charge-row" key={charge._id}>
                        <div><strong>{competenceLabel(charge.competence)}</strong><span>{formatCents(charge.outstandingAmount)} pendente</span></div>
                        <label>Alocar (R$)<MoneyInput placeholder="0,00" value={amounts[charge._id] ?? ''} onChange={(value) => setAmounts({ ...amounts, [charge._id]: value })} /></label>
                      </div>
                    ))}
                    {charges.length === 0 ? <p className="empty-state">Esta unidade não possui cobranças abertas.</p> : null}
                  </div>

                  <div className="allocation-totals"><div><span>Crédito disponível</span><strong>{formatCents(detail.remainingAmount)}</strong></div><div><span>Alocado agora</span><strong>{formatCents(enteredTotal)}</strong></div><div><span>Restante projetado</span><strong className={enteredTotal > detail.remainingAmount ? 'money-debit' : ''}>{enteredTotal > detail.remainingAmount ? 'Valor excedido' : formatCents(projectedRemaining)}</strong></div></div>

                  <label className="alias-checkbox"><input type="checkbox" checked={saveAlias} onChange={(event) => setSaveAlias(event.target.checked)} /><span>Reconhecer este pagador automaticamente nas próximas importações</span></label>
                  <button className="primary-button confirm-allocation" disabled={submitting || enteredTotal <= 0 || enteredTotal > detail.remainingAmount} onClick={confirmAllocation}>{submitting ? 'Confirmando...' : 'Confirmar conciliação'}</button>
                </div>
              ) : null}

              {detail.allocations.length > 0 ? <div className="allocation-history"><h3>Histórico de alocações</h3>{detail.allocations.map((allocation) => <div className={`payment-row ${allocation.reversedAt ? 'reversed' : ''}`} key={allocation._id}><div><strong>{allocation.chargeId.competence}</strong><span>{formatDate(allocation.paymentDate)}</span>{allocation.reversalReason ? <small>{allocation.reversalReason}</small> : null}</div><strong>{formatCents(allocation.amount)}</strong>{!allocation.reversedAt ? <button className="link-button danger" onClick={() => reverseAllocation(allocation)}>Estornar</button> : <span>Estornado</span>}</div>)}</div> : null}
            </>
          )}
        </section>
      </div>
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
