import { useEffect, useMemo, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { CompetenceInput } from '../components/CompetenceInput';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../components/Feedback';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { currentCompetence, formatCompetence } from '../utils/competence';
import { buildGenerateChargesPayload } from '../utils/formWorkflows';
import { formatCents } from '../utils/money';
import type { Charge, ChargeStatus, Unit } from '../types/domain';

type GenerateResult = { generated: number; totalUnits: number };

export function ChargesPage() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [competence, setCompetence] = useState(currentCompetence());
  const [status, setStatus] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
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
    <div className="page">
      <PageHeader title="Cobranças" subtitle="Competência, status e saldos abertos por unidade." />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {message ? <SuccessState>{message}</SuccessState> : null}

      <section className="toolbar">
        <label>Competência<CompetenceInput value={competence} onChange={changeCompetence} required /></label>
        <label>Status<select value={status} onChange={(event) => changeStatus(event.target.value)}><option value="">Todos</option><option value="PENDING">Pendente</option><option value="PARTIAL">Parcial</option><option value="PAID">Pago</option><option value="PAID_AFTER_REFERENCE_DATE">Pago após referência</option></select></label>
        <label>Unidade<input value={unitSearch} placeholder="Quadra, número ou tipo" onChange={(event) => setUnitSearch(event.target.value)} /></label>
        <button className="primary-button toolbar-action" onClick={() => setShowGenerateModal(true)} disabled={!competence}>Gerar cobranças da competência</button>
      </section>

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

      <div className="summary-grid">
        <StatCard label="Previsto" value={formatCents(totals.valueOriginal)} />
        <StatCard label="Pago" value={formatCents(totals.valuePaid)} />
        <StatCard label="Pendente" value={formatCents(totals.openBalance)} />
      </div>

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Quadra</th><th>Número</th><th>Tipo</th><th>Competência</th><th>Valor</th><th>Pago</th><th>Pendente</th><th>Status</th></tr></thead>
            <tbody>
              {visibleCharges.map((charge) => {
                const unit = unitOf(charge);
                return (
                  <tr key={charge._id}>
                    <td>{unit?.quadra ?? '-'}</td><td>{unit?.numero ?? '-'}</td><td>{unit?.tipo === 'CASA' ? 'Casa' : unit?.tipo === 'LOTE' ? 'Lote' : '-'}</td>
                    <td>{formatCompetence(charge.competence)}</td><td>{formatCents(charge.valueOriginal)}</td><td>{formatCents(charge.valuePaid)}</td><td>{formatCents(charge.openBalance)}</td>
                    <td><StatusBadge value={charge.status} label={chargeStatusLabel(charge.status)} /></td>
                  </tr>
                );
              })}
              {!loading && visibleCharges.length === 0 ? <tr><td colSpan={8}><EmptyState>Nenhuma cobrança encontrada.</EmptyState></td></tr> : null}
            </tbody>
          </table>
        </div>
        {loading ? <LoadingState>Carregando cobranças...</LoadingState> : null}
      </section>
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
