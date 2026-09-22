import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../components/Feedback';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import type { Category } from '../types/domain';

type CategoryForm = { name: string; defaultCounterpartyPattern: string; active: boolean };

const emptyForm: CategoryForm = { name: '', defaultCounterpartyPattern: '', active: true };

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
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

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
    setMessage('');
  }

  function startEdit(category: Category) {
    setEditingId(category._id);
    setForm({
      name: category.name,
      defaultCounterpartyPattern: category.defaultCounterpartyPattern ?? '',
      active: category.active
    });
    setShowForm(true);
    setError('');
    setMessage('');
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        name: form.name,
        defaultCounterpartyPattern: form.defaultCounterpartyPattern || null,
        ...(editingId ? { active: form.active } : {})
      };
      if (editingId) await api.patch(`/lookups/categories/${editingId}`, payload);
      else await api.post('/lookups/categories', payload);
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      setMessage(editingId ? 'Categoria atualizada.' : 'Categoria cadastrada.');
      await loadCategories();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível salvar a categoria. Verifique se já existe uma categoria com este nome.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Categorias" subtitle="Cadastre categorias flexíveis para despesas e análises." />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {message ? <SuccessState>{message}</SuccessState> : null}

      <section className="toolbar compact-toolbar">
        <label>Buscar categoria<input value={filter} onChange={(event) => setFilter(event.target.value)} /></label>
        <button className="primary-button toolbar-action" onClick={startCreate}>Nova categoria</button>
      </section>

      {showForm ? (
        <Modal
          title={editingId ? 'Editar categoria' : 'Nova categoria'}
          subtitle="Categorias alimentam contas a pagar e classificação de despesas."
          onClose={() => setShowForm(false)}
        >
          <form className="form-grid compact-form" onSubmit={submitCategory}>
            <label>Nome<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label className="wide-field">Padrão de contraparte<input value={form.defaultCounterpartyPattern} onChange={(event) => setForm({ ...form, defaultCounterpartyPattern: event.target.value })} /></label>
            {editingId ? (
              <label>Situação<select value={form.active ? 'active' : 'inactive'} onChange={(event) => setForm({ ...form, active: event.target.value === 'active' })}><option value="active">Ativa</option><option value="inactive">Inativa</option></select></label>
            ) : null}
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar categoria'}</button>
          </form>
        </Modal>
      ) : null}

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
                  <td><div className="row-actions"><button className="link-button" onClick={() => startEdit(category)}>Editar</button></div></td>
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
