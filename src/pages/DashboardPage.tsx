import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';

const fallback = {
  competence: '2026-09',
  revenueForecast: 0,
  revenueReceived: 0,
  revenuePending: 0,
  pendingUnitsCount: 0,
  expensePaid: 0,
  openCommitments: 0,
  bankBalance: 0,
  availableBalance: 0
};

export function DashboardPage() {
  const [data, setData] = useState(fallback);

  useEffect(() => {
    api.get('/dashboard?competence=2026-09').then(({ data }) => setData((previous) => ({ ...previous, ...data })));
  }, []);

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle="Visão operacional da competência, saldos e pendências financeiras."
      />
      <div className="hero-grid">
        <StatCard label="Receita prevista" value={`R$ ${data.revenueForecast.toFixed(2)}`} />
        <StatCard label="Recebido" value={`R$ ${data.revenueReceived.toFixed(2)}`} />
        <StatCard label="Pendente" value={`R$ ${data.revenuePending.toFixed(2)}`} />
        <StatCard label="Unidades pendentes" value={`${data.pendingUnitsCount}`} />
        <StatCard label="Despesas pagas" value={`R$ ${data.expensePaid.toFixed(2)}`} />
        <StatCard label="Contas a pagar" value={`R$ ${data.openCommitments.toFixed(2)}`} />
        <StatCard label="Saldo bancário" value={`R$ ${data.bankBalance.toFixed(2)}`} />
        <StatCard label="Saldo disponível" value={`R$ ${data.availableBalance.toFixed(2)}`} />
      </div>
    </div>
  );
}
