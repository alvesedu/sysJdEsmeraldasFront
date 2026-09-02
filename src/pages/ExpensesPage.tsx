import { UnavailableModule } from '../components/UnavailableModule';

export function ExpensesPage() {
  return (
    <UnavailableModule
      title="Despesas"
      subtitle="Categorização de débitos, favorecido e anexos."
      endpoint="GET/POST /expenses"
    />
  );
}
