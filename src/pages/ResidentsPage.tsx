import { PageHeader } from '../components/PageHeader';

export function ResidentsPage() {
  return (
    <div className="page">
      <PageHeader title="Moradores" subtitle="Cadastro do ocupante atual sem acoplar situação financeira." />
      <div className="panel">
        <p>Tela preparada para listar, cadastrar, editar e vincular morador à unidade.</p>
      </div>
    </div>
  );
}
