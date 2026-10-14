import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { buildResidentPayload } from '../utils/formWorkflows';
import type { Resident, Unit } from '../types/domain';
import { AlertCircle, CheckCircle2, Eye, Home, Pencil, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';

type ResidentForm = { name: string; phone: string; email: string; unitId: string; active: boolean };
const emptyForm: ResidentForm = { name: '', phone: '', email: '', unitId: '', active: true };
const fieldClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const labelClass = 'text-sm font-semibold text-slate-300';
const primaryActionClass = 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:scale-[1.01] hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100';
const iconActionClass = 'inline-grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100';

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
    const residentUnits = unitsOfResident(resident, units);
    const matchesName = !filters.name || resident.name.toLocaleLowerCase('pt-BR').includes(filters.name.toLocaleLowerCase('pt-BR'));
    const matchesUnit = !filters.unitId || residentUnits.some((unit) => unit._id === filters.unitId);
    return matchesName && matchesUnit;
  }), [filters, residents, units]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
    setMessage('');
  }

  function startEdit(resident: Resident) {
    const [unit] = unitsOfResident(resident, units);
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
      if (editingId) await api.put(`/residents/${editingId}`, payload);
      else await api.post('/residents', payload);
      setShowForm(false);
      setDetail(null);
      setMessage(editingId ? 'Morador atualizado.' : 'Morador cadastrado.');
      await refresh();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível salvar o morador.'));
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
                  Cadastro operacional
                </span>
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Moradores</h1>
                  <p className="text-base leading-7 text-slate-300 sm:text-lg">Gerencie dados cadastrais sem acoplar situação financeira. Vínculos com unidades continuam controlados pela tela de Unidades.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <ResidentMetric icon={Users} label="Moradores" value={`${residents.length}`} hint="Cadastros totais" />
                <ResidentMetric icon={CheckCircle2} label="Ativos" value={`${residents.filter((resident) => resident.active).length}`} hint="Em operação" />
                <ResidentMetric icon={Home} label="Com unidade" value={`${residents.filter((resident) => unitsOfResident(resident, units).length > 0).length}`} hint="Vínculo atual" />
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
                  <label className={labelClass}>Nome<input className={fieldClass} value={filters.name} onChange={(event) => setFilters({ ...filters, name: event.target.value })} placeholder="Buscar morador" /></label>
                  <label className={labelClass}>Unidade<select className={fieldClass} value={filters.unitId} onChange={(event) => setFilters({ ...filters, unitId: event.target.value })}><option value="">Todas</option>{units.map((unit) => <option key={unit._id} value={unit._id}>{unitLabel(unit)}</option>)}</select></label>
                </div>
                <button className={primaryActionClass} onClick={startCreate} type="button"><UserPlus className="h-4 w-4" />Novo morador</button>
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

        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Lista cadastral</p>
              <CardTitle className="mt-2 text-xl text-white">Moradores encontrados</CardTitle>
            </div>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">{visibleResidents.length}</span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-16 rounded-2xl bg-white/10" key={index} />)}</div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-white/10">
                <div className="overflow-x-auto">
                  <table className="min-w-[860px] w-full border-collapse text-left">
                    <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400">
                      <tr><th className="px-4 py-4">Morador</th><th className="px-4 py-4">Unidade atual</th><th className="px-4 py-4">Contato</th><th className="px-4 py-4">Situação</th><th className="px-4 py-4 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {visibleResidents.map((resident) => {
                        const residentUnits = unitsOfResident(resident, units);
                        return (
                          <tr className="bg-white/[0.025] transition hover:bg-amber-300/5" key={resident._id}>
                            <td className="px-4 py-4 font-bold text-white">{resident.name}</td>
                            <td className="px-4 py-4 text-slate-300">{residentUnits.length > 0 ? residentUnits.map(unitLabel).join(' · ') : 'Sem unidade'}</td>
                            <td className="px-4 py-4 text-slate-300">{[resident.phone, resident.email].filter(Boolean).join(' · ') || 'Não informado'}</td>
                            <td className="px-4 py-4"><StatusBadge value={resident.active ? 'PAID' : 'CANCELLED'} label={resident.active ? 'Ativo' : 'Inativo'} /></td>
                            <td className="px-4 py-4">
                              <div className="flex justify-end gap-2">
                                <button className={iconActionClass} type="button" aria-label={`Abrir detalhes do morador ${resident.name}`} title="Detalhes" onClick={() => setDetail(resident)}><Eye size={16} /></button>
                                <button className={iconActionClass} type="button" aria-label={`Editar morador ${resident.name}`} title="Editar" onClick={() => startEdit(resident)}><Pencil size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {visibleResidents.length === 0 ? <div className="p-8 text-center text-slate-300">Nenhum morador encontrado.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>

      {detail ? (
        <Modal
          title={detail.name}
          subtitle={`Unidades vinculadas: ${unitsOfResident(detail, units).length > 0 ? unitsOfResident(detail, units).map(unitLabel).join(' · ') : 'sem unidade'}`}
          onClose={() => setDetail(null)}
        >
          <div className="summary-grid">
            <div className="mini-card"><span>Telefone</span><strong>{detail.phone ?? 'Não informado'}</strong></div>
            <div className="mini-card"><span>E-mail</span><strong>{detail.email ?? 'Não informado'}</strong></div>
            <div className="mini-card"><span>Status</span><strong>{detail.active ? 'Ativo' : 'Inativo'}</strong></div>
          </div>
        </Modal>
      ) : null}
      </div>
    </div>
  );
}

type ResidentMetricProps = {
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
};

function ResidentMetric({ icon: Icon, label, value, hint }: ResidentMetricProps) {
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

function unitsOfResident(resident: Resident, units: Unit[]) {
  return units.filter((unit) => residentIdOfUnit(unit) === resident._id);
}

function residentIdOfUnit(unit: Unit) {
  return typeof unit.residentCurrentId === 'object' && unit.residentCurrentId?._id ? unit.residentCurrentId._id : '';
}

function unitLabel(unit: Unit) {
  return `Quadra ${unit.quadra} · ${unit.tipo === 'CASA' ? 'Casa' : 'Lote'} ${unit.numero}`;
}
