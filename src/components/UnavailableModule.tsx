import { PageHeader } from './PageHeader';

type UnavailableModuleProps = {
  title: string;
  subtitle: string;
  endpoint: string;
};

export function UnavailableModule({ title, subtitle, endpoint }: UnavailableModuleProps) {
  return (
    <div className="page">
      <PageHeader title={title} subtitle={subtitle} />
      <section className="panel unavailable-panel">
        <p className="eyebrow">Backend necessário</p>
        <h2>Módulo ainda não disponível no backend</h2>
        <p>Não há endpoint versionado para operar este módulo no momento. Endpoint esperado: <code>{endpoint}</code>.</p>
      </section>
    </div>
  );
}
