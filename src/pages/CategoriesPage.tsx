import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Category } from '../types/domain';
import { AlertCircle, CheckCircle2, Pencil, Plus, Receipt, Search, ShieldCheck, Tags } from 'lucide-react';

type CategoryForm = { name: string; defaultCounterpartyPattern: string; active: boolean };

const emptyForm: CategoryForm = { name: '', defaultCounterpartyPattern: '', active: true };
const fieldClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const labelClass = 'text-sm font-semibold text-slate-300';
const primaryActionClass = 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:scale-[1.01] hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100';
const iconActionClass = 'inline-grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100';

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(247,185,85,0.16),_transparent_34%),linear-gradient(135deg,_#07111f_0%,_#0f172a_54%,_#0b1324_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Classificação financeira
                </span>
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Categorias</h1>
                  <p className="text-base leading-7 text-slate-300 sm:text-lg">Organize despesas, contas a pagar e análises com categorias flexíveis e padrões bancários reutilizáveis.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <CategoryMetric icon={Tags} label="Categorias" value={`${categories.length}`} hint="Total cadastrado" />
                <CategoryMetric icon={CheckCircle2} label="Ativas" value={`${categories.filter((category) => category.active).length}`} hint="Disponíveis para uso" />
                <CategoryMetric icon={Receipt} label="Com padrão" value={`${categories.filter((category) => category.defaultCounterpartyPattern).length}`} hint="Reconhecimento bancário" />
              </div>
            </div>

            <Card className="border-white/10 bg-slate-950/45 text-white shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Search className="h-4 w-4 text-amber-300" />
                  Filtros e ações
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <label className={labelClass}>Buscar categoria<input className={fieldClass} value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Nome ou padrão bancário" /></label>
                <button className={primaryActionClass} onClick={startCreate} type="button"><Plus className="h-4 w-4" />Nova categoria</button>
              </CardContent>
            </Card>
          </div>
        </section>

        {error ? (
          <Alert variant="destructive" className="border-red-400/30 bg-red-950/50 text-red-100">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {message ? (
          <Alert className="border-emerald-300/25 bg-emerald-400/10 text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

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

        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Catálogo</p>
              <CardTitle className="mt-2 text-xl text-white">Categorias encontradas</CardTitle>
            </div>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">{visibleCategories.length}</span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-16 rounded-2xl bg-white/10" key={index} />)}</div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full border-collapse text-left">
                    <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400">
                      <tr><th className="px-4 py-4">Nome</th><th className="px-4 py-4">Padrão bancário</th><th className="px-4 py-4">Status</th><th className="px-4 py-4 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {visibleCategories.map((category) => (
                        <tr className="bg-white/[0.025] transition hover:bg-amber-300/5" key={category._id}>
                          <td className="px-4 py-4 font-bold text-white">{category.name}</td>
                          <td className="px-4 py-4 text-slate-300">{category.defaultCounterpartyPattern ?? 'Não informado'}</td>
                          <td className="px-4 py-4"><StatusBadge value={category.active ? 'PAID' : 'CANCELLED'} label={category.active ? 'Ativa' : 'Inativa'} /></td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button className={iconActionClass} onClick={() => startEdit(category)} title="Editar" type="button" aria-label={`Editar categoria ${category.name}`}><Pencil size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleCategories.length === 0 ? <div className="p-8 text-center text-slate-300">Nenhuma categoria encontrada.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type CategoryMetricProps = {
  icon: typeof Tags;
  label: string;
  value: string;
  hint: string;
};

function CategoryMetric({ icon: Icon, label, value, hint }: CategoryMetricProps) {
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">{label}</p>
        <Icon className="h-4 w-4 text-amber-200" />
      </div>
      <strong className="mt-2 block truncate text-2xl font-black text-white">{value}</strong>
      <span className="mt-1 block text-sm text-slate-300">{hint}</span>
    </div>
  );
}
