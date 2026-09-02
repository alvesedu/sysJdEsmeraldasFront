import { PageHeader } from '../components/PageHeader';

export function ImportsPage() {
  return (
    <div className="page">
      <PageHeader title="Importações bancárias" subtitle="Upload do PDF, processamento e rastreio do extrato." />
      <div className="panel">
        <p>Tela para enviar o PDF do Banco do Brasil e acompanhar o processamento.</p>
      </div>
    </div>
  );
}
