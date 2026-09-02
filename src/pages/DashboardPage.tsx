import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { formatCents } from '../utils/money';

const fallback = {
  competence: new Date().toISOString().slice(0, 7),
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
    api.get(`/dashboard?competence=${fallback.competence}`).then(({ data }) => setData((previous) => ({ ...previous, ...data })));
  }, []);

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle="Visão operacional da competência, saldos e pendências financeiras."
      />
      <div className="hero-grid">
        <StatCard label="Receita prevista" value={formatCents(data.revenueForecast)} />
        <StatCard label="Recebido" value={formatCents(data.revenueReceived)} />
        <StatCard label="Pendente" value={formatCents(data.revenuePending)} />
        <StatCard label="Unidades pendentes" value={`${data.pendingUnitsCount}`} />
        <StatCard label="Despesas pagas" value={formatCents(data.expensePaid)} />
        <StatCard label="Contas a pagar" value={formatCents(data.openCommitments)} />
        <StatCard label="Saldo bancário" value={formatCents(data.bankBalance)} />
        <StatCard label="Saldo disponível" value={formatCents(data.availableBalance)} />
      </div>
    </div>
  );
}
