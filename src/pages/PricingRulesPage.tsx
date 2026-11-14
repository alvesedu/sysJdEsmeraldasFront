import { useEffect, useState, type FormEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, apiErrorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { centsToReaisInput, formatCents, reaisInputToCents } from '../utils/money';
import { AlertCircle, CheckCircle2, CircleDollarSign, History, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';

type UnitType = 'CASA' | 'LOTE';
type PricingRule = { _id: string; unitType: UnitType; amount: number; effectiveFrom: string; effectiveTo: string | null; active: boolean };
type PricingForm = { unitType: UnitType; amount: string; effectiveFrom: string; effectiveTo: string; active: boolean };

const emptyForm: PricingForm = { unitType: 'CASA', amount: '', effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '', active: true };
const primaryActionClass = 'inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100';
const iconActionClass = 'inline-grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-amber-300/40 hover:bg-amber-300/10 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40';

export function PricingRulesPage() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [form, setForm] = useState<PricingForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingRule, setDeletingRule] = useState<PricingRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadRules();
  }, []);

  async function loadRules() {
    setLoading(true);
    try {
      const { data } = await api.get('/pricing-rules');
      setRules(data.items);
      setError('');
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar os valores mensais.'));
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
    setMessage('');
  }

  function startEdit(rule: PricingRule) {
    setEditingId(rule._id);
    setForm({
      unitType: rule.unitType,
      amount: centsToReaisInput(rule.amount),
      effectiveFrom: dateInputValue(rule.effectiveFrom),
      effectiveTo: rule.effectiveTo ? dateInputValue(rule.effectiveTo) : '',
      active: rule.active
    });
    setShowForm(true);
    setError('');
    setMessage('');
  }

  async function submitRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        unitType: form.unitType,
        amount: reaisInputToCents(form.amount),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        ...(editingId ? { active: form.active } : {})
      };
      if (editingId) await api.patch(`/pricing-rules/${editingId}`, payload);
      else await api.post('/pricing-rules', payload);
      setShowForm(false);
      setEditingId(null);
      setMessage(editingId ? 'Valor mensal atualizado.' : 'Valor mensal cadastrado.');
      await loadRules();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível salvar o valor. Verifique se a vigência não se sobrepõe a outra regra.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivateRule() {
    if (!deletingRule) return;
    setSubmitting(true);
    setError('');
    try {
      await api.delete(`/pricing-rules/${deletingRule._id}`);
      setDeletingRule(null);
      setMessage('Valor mensal inativado. O histórico foi preservado.');
      await loadRules();
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível inativar o valor mensal.'));
    } finally {
      setSubmitting(false);
    }
  }

  const activeRules = rules.filter((rule) => rule.active);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(247,185,85,0.16),_transparent_34%),linear-gradient(135deg,_#07111f_0%,_#0f172a_54%,_#0b1324_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-200"><ShieldCheck className="h-3.5 w-3.5" /> Administração financeira</span>
                <div className="max-w-3xl space-y-3"><h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Valores mensais</h1><p className="text-base leading-7 text-slate-300 sm:text-lg">Gerencie os valores de CASA e LOTE por vigência. Reajustes novos não alteram cobranças já geradas.</p></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3"><Metric label="Regras" value={`${rules.length}`} hint="Histórico completo" icon={History} /><Metric label="Ativas" value={`${activeRules.length}`} hint="Em uso para novas cobranças" icon={CheckCircle2} /><Metric label="Tipos" value={`${new Set(activeRules.map((rule) => rule.unitType)).size}`} hint="Casa e lote" icon={CircleDollarSign} /></div>
            </div>
            <Card className="border-white/10 bg-slate-950/45 text-white shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-white"><CircleDollarSign className="h-4 w-4 text-amber-300" />Ações</CardTitle></CardHeader><CardContent className="grid gap-4"><p className="text-sm leading-6 text-slate-400">Cadastre uma nova vigência para um reajuste ou edite uma regra existente. A exclusão é uma inativação para preservar o histórico.</p><button className={primaryActionClass} onClick={startCreate} type="button"><Plus className="h-4 w-4" />Novo valor mensal</button></CardContent></Card>
          </div>
        </section>

        {error ? <Alert variant="destructive" className="border-red-400/30 bg-red-950/50 text-red-100"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}
        {message ? <Alert className="border-emerald-300/25 bg-emerald-400/10 text-emerald-100"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert> : null}

        {showForm ? <Modal title={editingId ? 'Editar valor mensal' : 'Novo valor mensal'} subtitle="Valores em reais. A API armazena em centavos." onClose={() => setShowForm(false)}><form className="form-grid compact-form" onSubmit={submitRule}><label>Tipo<select required value={form.unitType} onChange={(event) => setForm({ ...form, unitType: event.target.value as UnitType })}><option value="CASA">Casa</option><option value="LOTE">Lote</option></select></label><label>Valor mensal (R$)<input required inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="Ex.: 250,00" /></label><label>Início da vigência<input required type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} /></label><label>Fim da vigência (opcional)<input type="date" value={form.effectiveTo} onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} /></label>{editingId ? <label>Situação<select value={form.active ? 'active' : 'inactive'} onChange={(event) => setForm({ ...form, active: event.target.value === 'active' })}><option value="active">Ativa</option><option value="inactive">Inativa</option></select></label> : null}<p className="form-hint">Cobranças existentes mantêm o valor original. A regra é aplicada apenas quando uma nova cobrança for gerada.</p><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar valor'}</button></form></Modal> : null}

        {deletingRule ? <Modal title="Inativar valor mensal" subtitle="O histórico será preservado." onClose={() => setDeletingRule(null)}><div className="modal-stack"><p className="confirm-message">Deseja inativar {unitTypeLabel(deletingRule.unitType)} de {formatCents(deletingRule.amount)}? Essa regra deixará de ser usada para novas cobranças.</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setDeletingRule(null)}>Cancelar</button><button className="danger-button" type="button" disabled={submitting} onClick={() => void deactivateRule()}>{submitting ? 'Inativando...' : 'Inativar valor'}</button></div></div></Modal> : null}

        <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl"><CardHeader className="flex-row items-start justify-between gap-4 space-y-0"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Tabela de vigências</p><CardTitle className="mt-2 text-xl text-white">Valores cadastrados</CardTitle></div><span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">{rules.length}</span></CardHeader><CardContent>{loading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-16 rounded-2xl bg-white/10" key={index} />)}</div> : <div className="overflow-x-auto rounded-3xl border border-white/10"><table className="min-w-[900px] w-full border-collapse text-left"><thead className="bg-slate-950/55 text-xs uppercase tracking-[0.18em] text-slate-400"><tr><th className="px-4 py-4">Tipo</th><th className="px-4 py-4">Valor</th><th className="px-4 py-4">Início</th><th className="px-4 py-4">Fim</th><th className="px-4 py-4">Status</th><th className="px-4 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-white/10">{rules.map((rule) => <tr className="bg-white/[0.025] transition hover:bg-amber-300/5" key={rule._id}><td className="px-4 py-4 font-bold text-white">{unitTypeLabel(rule.unitType)}</td><td className="px-4 py-4 font-black text-emerald-100">{formatCents(rule.amount)}</td><td className="px-4 py-4 text-slate-300">{formatDate(rule.effectiveFrom)}</td><td className="px-4 py-4 text-slate-300">{rule.effectiveTo ? formatDate(rule.effectiveTo) : 'Sem término'}</td><td className="px-4 py-4"><StatusBadge value={rule.active ? 'PAID' : 'CANCELLED'} label={rule.active ? 'Ativa' : 'Inativa'} /></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button className={iconActionClass} type="button" title="Editar" aria-label={`Editar valor de ${unitTypeLabel(rule.unitType)}`} onClick={() => startEdit(rule)}><Pencil size={16} /></button>{rule.active ? <button className={iconActionClass} type="button" title="Inativar" aria-label={`Inativar valor de ${unitTypeLabel(rule.unitType)}`} onClick={() => setDeletingRule(rule)}><Trash2 size={16} /></button> : null}</div></td></tr>)}</tbody></table>{rules.length === 0 ? <div className="p-8 text-center text-slate-300">Nenhum valor mensal cadastrado. O sistema usará o padrão técnico até que uma regra seja cadastrada.</div> : null}</div>}</CardContent></Card>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint }: { icon: typeof History; label: string; value: string; hint: string }) { return <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">{label}</p><Icon className="h-4 w-4 text-amber-200" /></div><strong className="mt-2 block truncate text-2xl font-black text-white">{value}</strong><span className="mt-1 block text-sm text-slate-300">{hint}</span></div>; }
function unitTypeLabel(type: UnitType) { return type === 'CASA' ? 'Casa' : 'Lote'; }
function dateInputValue(value: string) { return value.slice(0, 10); }
function formatDate(value: string) { return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); }
