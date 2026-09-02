import { PageHeader } from '../components/PageHeader';

export function ChargesPage() {
  return (
    <div className="page">
      <PageHeader title="Cobranças" subtitle="Competência, status e saldos abertos por unidade." />
      <div className="panel">
        <p>Tela para gerar competências e filtrar por pago, pendente ou parcial.</p>
      </div>
    </div>
  );
}
