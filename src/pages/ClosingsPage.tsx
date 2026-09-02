import { PageHeader } from '../components/PageHeader';

export function ClosingsPage() {
  return (
    <div className="page">
      <PageHeader title="Fechamento mensal" subtitle="Resumo da competência, saldo e status de fechamento." />
      <div className="panel">
        <p>Tela para controlar fechamento aberto ou fechado por competência.</p>
      </div>
    </div>
  );
}
