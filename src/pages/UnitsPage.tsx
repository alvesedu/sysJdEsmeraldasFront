import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../components/Feedback';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { formatCents } from '../utils/money';
import { buildUnitPayload } from '../utils/formWorkflows';
import type { Unit, UnitStatus, UnitType } from '../types/domain';

type UnitForm = { quadra: string; numero: string; tipo: UnitType; status: UnitStatus };

const emptyForm: UnitForm = { quadra: '', numero: '', tipo: 'CASA', status: 'ATIVA' };

export function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [detail, setDetail] = useState<{ item: Unit; residents: unknown[] } | null>(null);
  const [form, setForm] = useState<UnitForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ quadra: '', numero: '', tipo: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadUnits();
  }, []);

  async function loadUnits() {
    setLoading(true);
    try {
      const { data } = await api.get('/units');
      setUnits(data.items);
      setError('');
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar as unidades.'));
    } finally {
      setLoading(false);
    }
  }

  const visibleUnits = useMemo(() => {
    return units.filter((unit) => {
      const matchesQuadra = !filters.quadra || unit.quadra.toLocaleLowerCase('pt-BR').includes(filters.quadra.toLocaleLowerCase('pt-BR'));
      const matchesNumero = !filters.numero || unit.numero.toLocaleLowerCase('pt-BR').includes(filters.numero.toLocaleLowerCase('pt-BR'));
      const matchesTipo = !filters.tipo || unit.tipo === filters.tipo;
      const matchesStatus = !filters.status || unit.status === filters.status;
      return matchesQuadra && matchesNumero && matchesTipo && matchesStatus;
    });
  }, [filters, units]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage('');
    setError('');
  }

  function startEdit(unit: Unit) {
    setEditingId(unit._id);
    setForm({ quadra: unit.quadra, numero: unit.numero, tipo: unit.tipo, status: unit.status });
    setShowForm(true);
    setMessage('');
    setError('');
  }

  async function openDetail(id: string) {
    try {
      const { data } = await api.get(`/units/${id}`);
      setDetail(data);
      setError('');
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível abrir a unidade.'));
    }
  }

  async function submitUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const payload = buildUnitPayload(form, units, editingId);
      if (editingId) await api.put(`/units/${editingId}`, payload);
      else await api.post('/units', payload);
      setShowForm(false);
      setMessage(editingId ? 'Unidade atualizada.' : 'Unidade cadastrada.');
      await loadUnits();
      if (editingId) await openDetail(editingId);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível salvar a unidade. Verifique duplicidade de quadra, número e tipo.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Unidades" subtitle="Cadastro, vínculo atual e histórico financeiro da unidade." />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {message ? <SuccessState>{message}</SuccessState> : null}

      <section className="toolbar">
        <label>Quadra<input value={filters.quadra} onChange={(event) => setFilters({ ...filters, quadra: event.target.value })} /></label>
        <label>Número<input value={filters.numero} onChange={(event) => setFilters({ ...filters, numero: event.target.value })} /></label>
        <label>Tipo<select value={filters.tipo} onChange={(event) => setFilters({ ...filters, tipo: event.target.value })}><option value="">Todos</option><option value="CASA">Casa</option><option value="LOTE">Lote</option></select></label>
        <label>Situação<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Todas</option><option value="ATIVA">Ativa</option><option value="INATIVA">Inativa</option></select></label>
        <button className="primary-button toolbar-action" onClick={startCreate}>Nova unidade</button>
      </section>

      {showForm ? (
        <section className="panel operational-panel">
          <div className="section-heading"><h2>{editingId ? 'Editar unidade' : 'Nova unidade'}</h2><button className="ghost-button compact" onClick={() => setShowForm(false)}>Fechar</button></div>
          <form className="form-grid compact-form" onSubmit={submitUnit}>
            <label>Quadra<input required value={form.quadra} onChange={(event) => setForm({ ...form, quadra: event.target.value })} /></label>
            <label>Número<input required value={form.numero} onChange={(event) => setForm({ ...form, numero: event.target.value })} /></label>
            <label>Tipo<select required value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value as UnitType })}><option value="CASA">Casa</option><option value="LOTE">Lote</option></select></label>
            <label>Situação<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as UnitStatus })}><option value="ATIVA">Ativa</option><option value="INATIVA">Inativa</option></select></label>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar unidade'}</button>
          </form>
        </section>
      ) : null}

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Quadra</th><th>Número</th><th>Tipo</th><th>Situação</th><th>Morador atual</th><th>Mensalidade</th><th>Ações</th></tr></thead>
            <tbody>
              {visibleUnits.map((unit) => (
                <tr key={unit._id}>
                  <td>{unit.quadra}</td><td>{unit.numero}</td><td>{unit.tipo === 'CASA' ? 'Casa' : 'Lote'}</td>
                  <td><StatusBadge value={unit.status} label={unit.status === 'ATIVA' ? 'Ativa' : 'Inativa'} /></td>
                  <td>{unit.residentCurrentId?.name ?? 'Sem morador atual'}</td>
                  <td>{formatCents(unit.monthlyValue)}</td>
                  <td><div className="row-actions"><button className="link-button" onClick={() => openDetail(unit._id)}>Detalhes</button><button className="link-button" onClick={() => startEdit(unit)}>Editar</button></div></td>
                </tr>
              ))}
              {!loading && visibleUnits.length === 0 ? <tr><td colSpan={7}><EmptyState>Nenhuma unidade encontrada.</EmptyState></td></tr> : null}
            </tbody>
          </table>
        </div>
        {loading ? <LoadingState>Carregando unidades...</LoadingState> : null}
      </section>

      {detail ? (
        <section className="panel operational-panel">
          <div className="section-heading"><div><p className="eyebrow">Detalhes</p><h2>Quadra {detail.item.quadra} · {detail.item.tipo === 'CASA' ? 'Casa' : 'Lote'} {detail.item.numero}</h2><p>{detail.item.residentCurrentId?.name ?? 'Sem morador atual'}</p></div><button className="ghost-button compact" onClick={() => setDetail(null)}>Fechar</button></div>
          <div className="summary-grid detail-summary"><div className="mini-card"><span>Status</span><strong>{detail.item.status}</strong></div><div className="mini-card"><span>Mensalidade</span><strong>{formatCents(detail.item.monthlyValue)}</strong></div><div className="mini-card"><span>Chave</span><strong>{detail.item.unitKey}</strong></div><div className="mini-card"><span>Moradores vinculados</span><strong>{detail.residents.length}</strong></div></div>
        </section>
      ) : null}
    </div>
  );
}
