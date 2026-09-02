import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { CompetenceInput } from '../components/CompetenceInput';
import { ErrorState, LoadingState } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { currentCompetence } from '../utils/competence';
import { formatCents } from '../utils/money';

const fallback = {
  competence: currentCompetence(),
  unitsCount: 0,
  revenueForecast: 0,
  revenueReceived: 0,
  revenuePending: 0,
  pendingUnitsCount: 0,
  expensePaid: 0,
  openCommitments: 0,
  bankBalance: 0,
  availableBalance: 0,
  unmatchedCreditsCount: 0
};

export function DashboardPage() {
  const [data, setData] = useState(fallback);
  const [competence, setCompetence] = useState(fallback.competence);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/dashboard', { params: { competence } }),
      api.get('/bank-transactions/credits/unmatched', { params: { competence, status: 'UNMATCHED' } })
    ])
      .then(([dashboardResponse, creditsResponse]) => {
        if (!active) return;
        setData((previous) => ({
          ...previous,
          ...dashboardResponse.data,
          unmatchedCreditsCount: creditsResponse.data.items.length
        }));
        setError('');
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar o dashboard.'));
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

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle="Visão operacional da competência, saldos e pendências financeiras."
      />
      {error ? <ErrorState>{error}</ErrorState> : null}
      <section className="toolbar compact-toolbar">
        <label>Competência<CompetenceInput value={competence} onChange={changeCompetence} /></label>
      </section>
      {loading ? <LoadingState>Atualizando indicadores...</LoadingState> : null}
      <div className="hero-grid">
        <StatCard label="Unidades cadastradas" value={`${data.unitsCount}`} />
        <StatCard label="Receita prevista" value={formatCents(data.revenueForecast)} />
        <StatCard label="Recebido" value={formatCents(data.revenueReceived)} />
        <StatCard label="Pendente" value={formatCents(data.revenuePending)} />
        <StatCard label="Unidades pendentes" value={`${data.pendingUnitsCount}`} />
        <StatCard label="Despesas pagas" value={formatCents(data.expensePaid)} />
        <StatCard label="Despesas pendentes" value={formatCents(data.openCommitments)} />
        <StatCard label="Saldo bancário" value={formatCents(data.bankBalance)} />
        <StatCard label="Saldo disponível" value={formatCents(data.availableBalance)} />
        <StatCard label="Créditos não conciliados" value={`${data.unmatchedCreditsCount}`} />
      </div>
    </div>
  );
}
