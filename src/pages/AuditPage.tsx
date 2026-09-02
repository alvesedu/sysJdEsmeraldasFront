import { UnavailableModule } from '../components/UnavailableModule';

export function AuditPage() {
  return (
    <UnavailableModule
      title="Auditoria"
      subtitle="Rastreabilidade básica para ajustes e estornos."
      endpoint="GET /audit"
    />
  );
}
