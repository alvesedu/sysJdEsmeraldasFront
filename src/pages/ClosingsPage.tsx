import { useEffect, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../components/Feedback';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { currentCompetence, formatCompetence } from '../utils/competence';
import { buildMonthlyClosingPayload } from '../utils/formWorkflows';
import { formatCents } from '../utils/money';
import type { MonthlyClosing } from '../types/domain';

type ClosingForm = { competence: string; notes: string };
type StatusForm = { status: 'OPEN' | 'CLOSED'; notes: string };

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
    <div className="page">
      <PageHeader title="Fechamento mensal" subtitle="Resumo da competência, saldo e status de fechamento." />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {message ? <SuccessState>{message}</SuccessState> : null}

      <section className="toolbar compact-toolbar">
        <label>Competência<input type="month" value={competence} onChange={(event) => changeCompetence(event.target.value)} /></label>
        <button className="primary-button toolbar-action" onClick={openSnapshotModal}>Gerar snapshot</button>
      </section>

      <div className="summary-grid">
        <StatCard label="Receita prevista" value={formatCents(dashboard?.revenueForecast ?? 0)} />
        <StatCard label="Recebido" value={formatCents(dashboard?.revenueReceived ?? 0)} />
        <StatCard label="Recebido até venc." value={formatCents(dashboard?.revenueReceivedBeforeRef ?? 0)} />
        <StatCard label="Recebido após venc." value={formatCents(dashboard?.revenueReceivedAfterRef ?? 0)} />
        <StatCard label="Pendente" value={formatCents(dashboard?.revenuePending ?? 0)} />
        <StatCard label="Despesas pagas" value={formatCents(dashboard?.expensePaid ?? 0)} />
        <StatCard label="Entradas bancárias" value={formatCents(dashboard?.bankInflow ?? 0)} />
        <StatCard label="Saídas bancárias" value={formatCents(dashboard?.bankOutflow ?? 0)} />
        <StatCard label="Compromissos abertos" value={formatCents(dashboard?.openCommitments ?? 0)} />
        <StatCard label="Saldo disponível" value={formatCents(dashboard?.availableBalance ?? 0)} />
      </div>

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Competência</th><th>Status</th><th>Receita</th><th>Recebido</th><th>Entradas</th><th>Saídas</th><th>Saldo inicial</th><th>Saldo final</th><th>Saldo disponível</th><th>Notas</th><th>Ações</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{formatCompetence(item.competence)}</td>
                  <td><StatusBadge value={item.status === 'OPEN' ? 'PARTIAL' : 'PAID'} label={item.status === 'OPEN' ? 'Aberto' : 'Fechado'} /></td>
                  <td>{formatCents(item.revenueForecast)}</td><td>{formatCents(item.revenueReceived)}</td><td>{formatCents(item.bankInflow)}</td><td>{formatCents(item.bankOutflow)}</td><td>{formatCents(item.openingBankBalance)}</td><td>{formatCents(item.closingBankBalance)}</td><td>{formatCents(item.availableBalance)}</td>
                  <td>{item.notes ?? 'Sem notas'}</td>
                  <td><button className="link-button" onClick={() => openStatusModal(item)}>Editar status</button></td>
                </tr>
              ))}
              {!loading && items.length === 0 ? <tr><td colSpan={11}><EmptyState>Nenhum fechamento salvo para esta competência.</EmptyState></td></tr> : null}
            </tbody>
          </table>
        </div>
        {loading ? <LoadingState>Carregando fechamento...</LoadingState> : null}
      </section>

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
  );
}
