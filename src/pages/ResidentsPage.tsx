import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../components/Feedback';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { buildResidentPayload } from '../utils/formWorkflows';
import type { Resident, Unit } from '../types/domain';

type ResidentForm = { name: string; phone: string; email: string; unitId: string; active: boolean };
const emptyForm: ResidentForm = { name: '', phone: '', email: '', unitId: '', active: true };

export function ResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [form, setForm] = useState<ResidentForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<Resident | null>(null);
  const [filters, setFilters] = useState({ name: '', unitId: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const [residentResponse, unitResponse] = await Promise.all([api.get('/residents'), api.get('/units')]);
      setResidents(residentResponse.data.items);
      setUnits(unitResponse.data.items);
      setError('');
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar moradores.'));
    } finally {
      setLoading(false);
    }
  }

  const visibleResidents = useMemo(() => residents.filter((resident) => {
    const unit = unitOf(resident);
    const matchesName = !filters.name || resident.name.toLocaleLowerCase('pt-BR').includes(filters.name.toLocaleLowerCase('pt-BR'));
    const matchesUnit = !filters.unitId || unit?._id === filters.unitId;
    return matchesName && matchesUnit;
  }), [filters, residents]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
    setMessage('');
  }

  function startEdit(resident: Resident) {
    const unit = unitOf(resident);
    setEditingId(resident._id);
    setForm({
      name: resident.name,
      phone: resident.phone ?? '',
      email: resident.email ?? '',
      unitId: unit?._id ?? '',
      active: resident.active
    });
    setShowForm(true);
    setError('');
    setMessage('');
  }

  async function submitResident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    const payload = buildResidentPayload(form);
    try {
      const { data } = editingId
        ? await api.put(`/residents/${editingId}`, payload)
        : await api.post('/residents', payload);
      setShowForm(false);
      setDetail(data.item);
      setMessage(editingId ? 'Morador atualizado.' : 'Morador cadastrado.');
      await refresh();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível salvar o morador.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Moradores" subtitle="Cadastro do ocupante atual sem acoplar situação financeira." />
      {error ? <ErrorState>{error}</ErrorState> : null}
      {message ? <SuccessState>{message}</SuccessState> : null}

      <section className="toolbar compact-toolbar">
        <label>Nome<input value={filters.name} onChange={(event) => setFilters({ ...filters, name: event.target.value })} /></label>
        <label>Unidade<select value={filters.unitId} onChange={(event) => setFilters({ ...filters, unitId: event.target.value })}><option value="">Todas</option>{units.map((unit) => <option key={unit._id} value={unit._id}>{unitLabel(unit)}</option>)}</select></label>
        <button className="primary-button toolbar-action" onClick={startCreate}>Novo morador</button>
      </section>

      {showForm ? (
        <Modal title={editingId ? 'Editar morador' : 'Novo morador'} subtitle="Dados cadastrais do morador. O vínculo com unidade é alterado pela tela de Unidades." onClose={() => setShowForm(false)}>
          <form className="form-grid" onSubmit={submitResident}>
            <label>Nome<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Telefone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <p className="form-hint">Para vincular, trocar ou remover unidade, use a ação de morador atual na tela de Unidades.</p>
            <label>Situação<select value={form.active ? 'active' : 'inactive'} onChange={(event) => setForm({ ...form, active: event.target.value === 'active' })}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar morador'}</button>
          </form>
        </Modal>
      ) : null}

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Morador</th><th>Unidade atual</th><th>Contato</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>
              {visibleResidents.map((resident) => {
                const unit = unitOf(resident);
                return (
                  <tr key={resident._id}>
                    <td>{resident.name}</td>
                    <td>{unit ? unitLabel(unit) : 'Sem unidade'}</td>
                    <td>{[resident.phone, resident.email].filter(Boolean).join(' · ') || 'Não informado'}</td>
                    <td><StatusBadge value={resident.active ? 'PAID' : 'CANCELLED'} label={resident.active ? 'Ativo' : 'Inativo'} /></td>
                    <td><div className="row-actions"><button className="link-button" onClick={() => setDetail(resident)}>Detalhes</button><button className="link-button" onClick={() => startEdit(resident)}>Editar</button></div></td>
                  </tr>
                );
              })}
              {!loading && visibleResidents.length === 0 ? <tr><td colSpan={5}><EmptyState>Nenhum morador encontrado.</EmptyState></td></tr> : null}
            </tbody>
          </table>
        </div>
        {loading ? <LoadingState>Carregando moradores...</LoadingState> : null}
      </section>

      {detail ? (
        <section className="panel operational-panel">
          <div className="section-heading"><div><p className="eyebrow">Morador</p><h2>{detail.name}</h2><p>Unidade atual: {unitOf(detail) ? unitLabel(unitOf(detail) as Unit) : 'sem unidade'}</p></div><button className="ghost-button compact" onClick={() => setDetail(null)}>Fechar</button></div>
          <div className="summary-grid"><div className="mini-card"><span>Telefone</span><strong>{detail.phone ?? 'Não informado'}</strong></div><div className="mini-card"><span>E-mail</span><strong>{detail.email ?? 'Não informado'}</strong></div><div className="mini-card"><span>Status</span><strong>{detail.active ? 'Ativo' : 'Inativo'}</strong></div></div>
        </section>
      ) : null}
    </div>
  );
}

function unitOf(resident: Resident) {
  return resident.unitId && typeof resident.unitId !== 'string' ? resident.unitId : null;
}

function unitLabel(unit: Unit) {
  return `Quadra ${unit.quadra} · ${unit.tipo === 'CASA' ? 'Casa' : 'Lote'} ${unit.numero}`;
}
