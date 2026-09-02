import { PageHeader } from '../components/PageHeader';

export function CategoriesPage() {
  return (
    <div className="page">
      <PageHeader title="Categorias" subtitle="Cadastre categorias flexíveis para despesas e análises." />
      <div className="panel">
        <p>Tela para gerenciar categorias sem enum fechado.</p>
      </div>
    </div>
  );
}
