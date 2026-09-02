import { PageHeader } from '../components/PageHeader';

export function ReconciliationPage() {
  return (
    <div className="page">
      <PageHeader title="Conciliação de entradas" subtitle="Sugerir unidade, competências e confirmar alocação." />
      <div className="panel">
        <p>Tela para conciliar créditos bancários com cobranças abertas.</p>
      </div>
    </div>
  );
}
