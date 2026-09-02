import { PageHeader } from '../components/PageHeader';

export function ExpensesPage() {
  return (
    <div className="page">
      <PageHeader title="Despesas" subtitle="Categorização de débitos, favorecido e anexos." />
      <div className="panel">
        <p>Tela para classificar saídas bancárias e manter o bruto preservado.</p>
      </div>
    </div>
  );
}
