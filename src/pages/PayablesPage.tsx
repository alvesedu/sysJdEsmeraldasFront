import { PageHeader } from '../components/PageHeader';

export function PayablesPage() {
  return (
    <div className="page">
      <PageHeader title="Contas a pagar" subtitle="Obrigações que afetam o saldo disponível real." />
      <div className="panel">
        <p>Tela para cadastrar, pagar e relacionar contas a pagar com lançamentos bancários.</p>
      </div>
    </div>
  );
}
