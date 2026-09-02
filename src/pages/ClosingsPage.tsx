import { UnavailableModule } from '../components/UnavailableModule';

export function ClosingsPage() {
  return (
    <UnavailableModule
      title="Fechamento mensal"
      subtitle="Resumo da competência, saldo e status de fechamento."
      endpoint="GET/POST /monthly-closings"
    />
  );
}
