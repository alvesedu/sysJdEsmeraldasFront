import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { EmptyState } from '../components/Feedback';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCents } from '../utils/money';
import { buildUnitPayload } from '../utils/formWorkflows';
import type { Resident, Unit, UnitStatus, UnitType } from '../types/domain';
import { AlertCircle, Building2, CheckCircle2, Eye, History, Home, Landmark, Pencil, Plus, Search, ShieldCheck } from 'lucide-react';

type UnitForm = { quadra: string; numero: string; tipo: UnitType; status: UnitStatus };
type UnitDetail = { item: Unit; residents: unknown[] };

const emptyForm: UnitForm = { quadra: '', numero: '', tipo: 'CASA', status: 'ATIVA' };
const fieldClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const labelClass = 'text-sm font-semibold text-slate-300';
const primaryActionClass = 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:scale-[1.01] hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100';
const iconActionClass = 'inline-grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100';

export function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [detail, setDetail] = useState<UnitDetail | null>(null);
  const [historyDetail, setHistoryDetail] = useState<UnitDetail | null>(null);
  const [form, setForm] = useState<UnitForm>(emptyForm);
  const [residentId, setResidentId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ quadra: '', numero: '', tipo: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/units'), api.get('/residents')])
      .then(([unitResponse, residentResponse]) => {
        if (!active) return;
        setUnits(unitResponse.data.items);
        setResidents(residentResponse.data.items);
        if (active) setError('');
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar as unidades.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function loadUnits() {
    setLoading(true);
    try {
      await refreshUnitLists();
      setError('');
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar as unidades.'));
    } finally {
      setLoading(false);
    }
  }

  async function refreshUnitLists() {
    const [unitResponse, residentResponse] = await Promise.all([api.get('/units'), api.get('/residents')]);
    setUnits(unitResponse.data.items);
    setResidents(residentResponse.data.items);
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
      setResidentId(data.item.residentCurrentId?._id ?? '');
      setError('');
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível abrir a unidade.'));
    }
  }

  async function openHistory(id: string) {
    try {
      const { data } = await api.get(`/units/${id}`);
      setHistoryDetail(data);
      setError('');
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível abrir o histórico da unidade.'));
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
      setError(apiErrorMessage(caught, 'Não foi possível salvar a unidade. Verifique duplicidade de quadra e número.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitResidentChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(`/units/${detail.item._id}/resident`, { residentId: residentId || null });
      setResidentId(data.item.residentCurrentId?._id ?? '');
      setMessage(residentId ? 'Morador atual atualizado.' : 'Unidade ficou sem morador atual.');
      await refreshUnitLists();
      setDetail(null);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível alterar o morador atual da unidade.'));
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
                  Prontuário patrimonial
                </span>
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Unidades</h1>
                  <p className="text-base leading-7 text-slate-300 sm:text-lg">Cadastro, vínculo atual e histórico da unidade com identidade patrimonial protegida.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <UnitMetric icon={Building2} label="Unidades" value={`${units.length}`} hint="Total cadastrado" />
                <UnitMetric icon={Home} label="Casas" value={`${units.filter((unit) => unit.tipo === 'CASA').length}`} hint="Tipo casa" />
                <UnitMetric icon={Landmark} label="Lotes" value={`${units.filter((unit) => unit.tipo === 'LOTE').length}`} hint="Tipo lote" />
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>Quadra<input className={fieldClass} value={filters.quadra} onChange={(event) => setFilters({ ...filters, quadra: event.target.value })} placeholder="Ex.: A" /></label>
                  <label className={labelClass}>Número<input className={fieldClass} value={filters.numero} onChange={(event) => setFilters({ ...filters, numero: event.target.value })} placeholder="Ex.: 10" /></label>
                  <label className={labelClass}>Tipo<select className={fieldClass} value={filters.tipo} onChange={(event) => setFilters({ ...filters, tipo: event.target.value })}><option value="">Todos</option><option value="CASA">Casa</option><option value="LOTE">Lote</option></select></label>
                  <label className={labelClass}>Situação<select className={fieldClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Todas</option><option value="ATIVA">Ativa</option><option value="INATIVA">Inativa</option></select></label>
                </div>
                <button className={primaryActionClass} onClick={startCreate} type="button"><Plus className="h-4 w-4" />Nova unidade</button>
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
        <Modal title={editingId ? 'Editar unidade' : 'Nova unidade'} subtitle="Campos obrigatórios: quadra, número e tipo." onClose={() => setShowForm(false)}>
          <form className="form-grid compact-form" onSubmit={submitUnit}>
            <label>Quadra<input required disabled={Boolean(editingId)} value={form.quadra} onChange={(event) => setForm({ ...form, quadra: event.target.value })} /></label>
            <label>Número<input required disabled={Boolean(editingId)} value={form.numero} onChange={(event) => setForm({ ...form, numero: event.target.value })} /></label>
            <label>Tipo<select required disabled={Boolean(editingId)} value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value as UnitType })}><option value="CASA">Casa</option><option value="LOTE">Lote</option></select></label>
            <label>Situação<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as UnitStatus })}><option value="ATIVA">Ativa</option><option value="INATIVA">Inativa</option></select></label>
            {editingId ? <p className="form-hint">Quadra, número e tipo formam a identidade patrimonial da unidade e não são alterados por esta edição.</p> : null}
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar unidade'}</button>
          </form>
        </Modal>
      ) : null}

        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Mapa patrimonial</p>
              <CardTitle className="mt-2 text-xl text-white">Unidades encontradas</CardTitle>
            </div>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">{visibleUnits.length}</span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-16 rounded-2xl bg-white/10" key={index} />)}</div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full border-collapse text-left">
                    <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400">
                      <tr><th className="px-4 py-4">Quadra</th><th className="px-4 py-4">Número</th><th className="px-4 py-4">Tipo</th><th className="px-4 py-4">Situação</th><th className="px-4 py-4">Morador atual</th><th className="px-4 py-4">Mensalidade</th><th className="px-4 py-4 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {visibleUnits.map((unit) => (
                        <tr className="bg-white/[0.025] transition hover:bg-amber-300/5" key={unit._id}>
                          <td className="px-4 py-4 font-black text-white">{unit.quadra}</td>
                          <td className="px-4 py-4 text-slate-200">{unit.numero}</td>
                          <td className="px-4 py-4 text-slate-300">{unit.tipo === 'CASA' ? 'Casa' : 'Lote'}</td>
                          <td className="px-4 py-4"><StatusBadge value={unit.status} label={unit.status === 'ATIVA' ? 'Ativa' : 'Inativa'} /></td>
                          <td className="px-4 py-4 text-slate-300">{unit.residentCurrentId?.name ?? 'Sem morador atual'}</td>
                          <td className="px-4 py-4 font-bold text-emerald-100">{formatCents(unit.monthlyValue)}</td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button className={iconActionClass} type="button" aria-label={`Abrir detalhes da unidade ${unitLabel(unit)}`} title="Detalhes" onClick={() => openDetail(unit._id)}><Eye size={16} /></button>
                              <button className={iconActionClass} type="button" aria-label={`Editar unidade ${unitLabel(unit)}`} title="Editar" onClick={() => startEdit(unit)}><Pencil size={16} /></button>
                              <button className={iconActionClass} type="button" aria-label={`Abrir histórico da unidade ${unitLabel(unit)}`} title="Histórico" onClick={() => openHistory(unit._id)}><History size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleUnits.length === 0 ? <div className="p-8 text-center text-slate-300">Nenhuma unidade encontrada.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>

      {detail ? (
        <Modal
          title={`Quadra ${detail.item.quadra} · ${detail.item.tipo === 'CASA' ? 'Casa' : 'Lote'} ${detail.item.numero}`}
          subtitle={detail.item.residentCurrentId?.name ? `Morador atual: ${detail.item.residentCurrentId.name}` : 'Sem morador atual'}
          onClose={() => setDetail(null)}
        >
          <div className="modal-stack">
            <div className="summary-grid detail-summary">
              <div className="mini-card"><span>Status</span><strong>{detail.item.status}</strong></div>
              <div className="mini-card"><span>Mensalidade</span><strong>{formatCents(detail.item.monthlyValue)}</strong></div>
              <div className="mini-card"><span>Chave</span><strong>{detail.item.unitKey}</strong></div>
              <div className="mini-card"><span>Moradores vinculados</span><strong>{detail.residents.length}</strong></div>
            </div>
            <form className="form-grid compact-form" onSubmit={submitResidentChange}>
              <label>Morador atual<select value={residentId} onChange={(event) => setResidentId(event.target.value)}><option value="">Sem morador atual</option>{residents.map((resident) => <option key={resident._id} value={resident._id}>{residentLabel(resident)}</option>)}</select></label>
              <p className="form-hint">A troca preserva o histórico da unidade e não altera cobranças, pagamentos ou conciliações.</p>
              <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Atualizar morador atual'}</button>
            </form>
          </div>
        </Modal>
      ) : null}

      {historyDetail ? (
        <Modal
          title={`Histórico · ${unitLabel(historyDetail.item)}`}
          subtitle="Histórico de vínculos registrados no prontuário da unidade."
          onClose={() => setHistoryDetail(null)}
        >
          <div className="modal-stack">
            {historyDetail.item.residentHistory && historyDetail.item.residentHistory.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Nome</th><th>Início</th><th>Fim</th><th>Status</th></tr></thead>
                  <tbody>
                    {historyDetail.item.residentHistory.map((entry, index) => {
                      const resident = typeof entry.residentId === 'string' ? null : entry.residentId;
                      return (
                        <tr key={`${typeof entry.residentId === 'string' ? entry.residentId : entry.residentId._id}-${entry.startedAt}-${index}`}>
                          <td>{resident?.name ?? 'Morador não identificado'}</td>
                          <td>{formatDate(entry.startedAt)}</td>
                          <td>{entry.endedAt ? formatDate(entry.endedAt) : 'Atual'}</td>
                          <td><StatusBadge value={entry.endedAt ? 'CANCELLED' : 'PAID'} label={entry.endedAt ? 'Encerrado' : 'Atual'} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>Nenhum histórico registrado para esta unidade.</EmptyState>
            )}
          </div>
        </Modal>
      ) : null}
      </div>
    </div>
  );
}

type UnitMetricProps = {
  icon: typeof Building2;
  label: string;
  value: string;
  hint: string;
};

function UnitMetric({ icon: Icon, label, value, hint }: UnitMetricProps) {
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

function residentLabel(resident: Resident) {
  const unit = resident.unitId && typeof resident.unitId !== 'string' ? resident.unitId : null;
  return unit ? `${resident.name} · ${unitLabel(unit)}` : resident.name;
}

function unitLabel(unit: Unit) {
  return `Quadra ${unit.quadra} · ${unit.tipo === 'CASA' ? 'Casa' : 'Lote'} ${unit.numero}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
