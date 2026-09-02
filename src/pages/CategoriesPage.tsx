import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import type { Category } from '../types/domain';

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ name: '', defaultCounterpartyPattern: '' });
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const { data } = await api.get('/lookups/categories');
      setCategories(data.items);
      setError('');
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar categorias.'));
    } finally {
      setLoading(false);
    }
  }

  const visibleCategories = useMemo(() => categories.filter((category) => (
    !filter || `${category.name} ${category.defaultCounterpartyPattern ?? ''}`.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR'))
  )), [categories, filter]);

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await api.post('/lookups/categories', {
        name: form.name,
        defaultCounterpartyPattern: form.defaultCounterpartyPattern || null
      });
      setForm({ name: '', defaultCounterpartyPattern: '' });
      setMessage('Categoria cadastrada.');
      await loadCategories();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível cadastrar a categoria. Verifique se já existe uma categoria com este nome.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Categorias" subtitle="Cadastre categorias flexíveis para despesas e análises." />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {message ? <SuccessState>{message}</SuccessState> : null}

      <section className="panel operational-panel">
        <div className="section-heading"><div><p className="eyebrow">Nova categoria</p><h2>Cadastro rápido</h2></div></div>
        <form className="form-grid compact-form" onSubmit={submitCategory}>
          <label>Nome<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="wide-field">Padrão de contraparte<input value={form.defaultCounterpartyPattern} onChange={(event) => setForm({ ...form, defaultCounterpartyPattern: event.target.value })} /></label>
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Cadastrar categoria'}</button>
        </form>
      </section>

      <section className="toolbar compact-toolbar">
        <label>Buscar categoria<input value={filter} onChange={(event) => setFilter(event.target.value)} /></label>
      </section>

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Padrão bancário</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {visibleCategories.map((category) => (
                <tr key={category._id}>
                  <td>{category.name}</td>
                  <td>{category.defaultCounterpartyPattern ?? 'Não informado'}</td>
                  <td><StatusBadge value={category.active ? 'PAID' : 'CANCELLED'} label={category.active ? 'Ativa' : 'Inativa'} /></td>
                  <td><span className="muted-inline">Editar/desativar depende de endpoint backend.</span></td>
                </tr>
              ))}
              {!loading && visibleCategories.length === 0 ? <tr><td colSpan={4}><EmptyState>Nenhuma categoria encontrada.</EmptyState></td></tr> : null}
            </tbody>
          </table>
        </div>
        {loading ? <LoadingState>Carregando categorias...</LoadingState> : null}
      </section>
    </div>
  );
}
