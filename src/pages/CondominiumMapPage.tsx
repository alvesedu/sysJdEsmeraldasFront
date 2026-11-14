import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, apiErrorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import type { Unit, UnitType } from '../types/domain';
import { AlertCircle, Building2, CircleDot, Home, Landmark, Map, Search } from 'lucide-react';
import { formatCents } from '../utils/money';

type Quadra = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
type Region = { quadra: Quadra; left: number; top: number; width: number; height: number };

const regions: Region[] = [
  { quadra: 'D', left: 8, top: 21, width: 12, height: 36 },
  { quadra: 'C', left: 20, top: 20, width: 15, height: 36 },
  { quadra: 'B', left: 31, top: 27, width: 25, height: 25 },
  { quadra: 'A', left: 53, top: 20, width: 12, height: 24 },
  { quadra: 'G', left: 7, top: 55, width: 13, height: 22 },
  { quadra: 'F', left: 19, top: 55, width: 14, height: 22 },
  { quadra: 'E', left: 31, top: 52, width: 37, height: 23 },
  { quadra: 'H', left: 31, top: 73, width: 37, height: 16 }
];

const fieldClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const labelClass = 'text-sm font-semibold text-slate-300';

export function CondominiumMapPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedQuadra, setSelectedQuadra] = useState<Quadra | 'TODAS'>('TODAS');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [filters, setFilters] = useState({ search: '', type: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/units')
      .then(({ data }) => {
        if (active) setUnits(data.items);
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar o mapa do condomínio.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleUnits = useMemo(() => units.filter((unit) => {
    const matchesQuadra = selectedQuadra === 'TODAS' || unit.quadra === selectedQuadra;
    const matchesType = !filters.type || unit.tipo === filters.type;
    const matchesStatus = !filters.status || unit.status === filters.status;
    const search = filters.search.trim().toLocaleLowerCase('pt-BR');
    const resident = residentName(unit);
    const matchesSearch = !search || `${unit.quadra} ${unit.numero} ${unit.tipo} ${resident}`.toLocaleLowerCase('pt-BR').includes(search);
    return matchesQuadra && matchesType && matchesStatus && matchesSearch;
  }), [filters, selectedQuadra, units]);

  const counts = useMemo(() => regions.reduce<Record<string, number>>((result, region) => {
    result[region.quadra] = units.filter((unit) => unit.quadra === region.quadra).length;
    return result;
  }, {}), [units]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.14),_transparent_32%),linear-gradient(135deg,_#07111f_0%,_#0f172a_54%,_#0b1324_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
            <div className="space-y-4"><span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-100"><Map className="h-3.5 w-3.5" /> Planta original</span><div className="space-y-3"><h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Mapa do condomínio</h1><p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Consulte a planta original do Jardim das Esmeraldas e encontre as unidades cadastradas sem incluir a Alameda Vida Nova no perímetro.</p></div></div>
            <Card className="border-white/10 bg-slate-950/45 text-white shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-white"><Search className="h-4 w-4 text-amber-300" />Filtros do mapa</CardTitle></CardHeader><CardContent className="grid gap-4"><label className={labelClass}>Buscar unidade ou morador<input className={fieldClass} value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Ex.: E 19 ou Eduardo" /></label><div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Tipo<select className={fieldClass} value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">Todos</option><option value="CASA">Casa</option><option value="LOTE">Lote</option></select></label><label className={labelClass}>Status<select className={fieldClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Todos</option><option value="ATIVA">Ativa</option><option value="INATIVA">Inativa</option></select></label></div></CardContent></Card>
          </div>
        </section>

        {error ? <Alert variant="destructive" className="border-red-400/30 bg-red-950/50 text-red-100"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="overflow-hidden border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl"><CardHeader className="flex-row items-start justify-between gap-4 space-y-0"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Planta original</p><CardTitle className="mt-2 text-xl text-white">Jardim das Esmeraldas</CardTitle></div><span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-sm font-black text-emerald-100">{visibleUnits.length} unidade(s)</span></CardHeader><CardContent><div className="flex flex-wrap gap-2 pb-4">{(['TODAS', ...regions.map((region) => region.quadra)] as const).map((quadra) => <button className={`rounded-xl border px-3 py-2 text-xs font-black transition ${selectedQuadra === quadra ? 'border-amber-300/50 bg-amber-300/15 text-amber-100' : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white'}`} key={quadra} type="button" onClick={() => setSelectedQuadra(quadra)}>{quadra === 'TODAS' ? 'Todas' : `Quadra ${quadra}`} {quadra !== 'TODAS' ? <span className="ml-1 opacity-60">{counts[quadra] ?? 0}</span> : null}</button>)}</div><OriginalMap regions={regions} counts={counts} selectedQuadra={selectedQuadra} onQuadraSelect={setSelectedQuadra} /><div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400"><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded border-2 border-cyan-200/80 bg-cyan-300/20" />Quadra interativa</span><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded border-2 border-amber-200 bg-amber-300/40" />Quadra selecionada</span><span className="inline-flex items-center gap-2"><CircleDot className="h-3 w-3 text-slate-400" />Alameda Vida Nova fora do condomínio</span></div></CardContent></Card>

          <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl"><CardHeader><p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Cadastro</p><CardTitle className="mt-2 text-xl text-white">Unidades da seleção</CardTitle></CardHeader><CardContent>{loading ? <div className="space-y-3"><Skeleton className="h-14 rounded-2xl bg-white/10" /><Skeleton className="h-14 rounded-2xl bg-white/10" /><Skeleton className="h-14 rounded-2xl bg-white/10" /></div> : <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">{visibleUnits.map((unit) => <button className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-amber-300/40 hover:bg-amber-300/10" key={unit._id} type="button" onClick={() => setSelectedUnit(unit)}><div className="flex items-start justify-between gap-3"><div><p className="font-black text-white">Quadra {unit.quadra} · {unitTypeLabel(unit.tipo)} {unit.numero}</p><p className="mt-1 truncate text-xs text-slate-400">{residentName(unit)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${unit.status === 'ATIVA' ? 'bg-emerald-300/10 text-emerald-100' : 'bg-slate-300/10 text-slate-300'}`}>{unit.status === 'ATIVA' ? 'Ativa' : 'Inativa'}</span></div></button>)}{visibleUnits.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Nenhuma unidade encontrada para os filtros.</div> : null}</div>}</CardContent></Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-3"><Summary icon={Building2} label="Unidades cadastradas" value={`${units.length}`} /><Summary icon={Home} label="Casas" value={`${units.filter((unit) => unit.tipo === 'CASA').length}`} /><Summary icon={Landmark} label="Lotes" value={`${units.filter((unit) => unit.tipo === 'LOTE').length}`} /></div>

        {selectedUnit ? <Modal title={`Quadra ${selectedUnit.quadra} · ${unitTypeLabel(selectedUnit.tipo)} ${selectedUnit.numero}`} subtitle="Detalhes da unidade selecionada no mapa" onClose={() => setSelectedUnit(null)}><div className="summary-grid detail-summary"><div className="mini-card"><span>Morador atual</span><strong>{residentName(selectedUnit)}</strong></div><div className="mini-card"><span>Status</span><strong>{selectedUnit.status === 'ATIVA' ? 'Ativa' : 'Inativa'}</strong></div><div className="mini-card"><span>Mensalidade</span><strong>{formatCents(selectedUnit.monthlyValue)}</strong></div><div className="mini-card"><span>Identidade</span><strong>{selectedUnit.unitKey}</strong></div></div></Modal> : null}
      </div>
    </div>
  );
}

function OriginalMap({ regions, counts, selectedQuadra, onQuadraSelect }: { regions: Region[]; counts: Record<string, number>; selectedQuadra: Quadra | 'TODAS'; onQuadraSelect: (quadra: Quadra) => void }) {
  return <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-white/10 bg-emerald-950 shadow-2xl"><img className="absolute inset-0 h-full w-full object-cover" src="/condominio-planta.png" alt="Planta original do Condomínio Jardim das Esmeraldas" />{regions.map((region) => <button className={`group absolute rounded-2xl border-2 transition ${selectedQuadra === region.quadra ? 'border-amber-200 bg-amber-300/30 shadow-[0_0_0_4px_rgba(252,211,77,0.2)]' : 'border-cyan-100/45 bg-cyan-300/10 hover:border-cyan-50 hover:bg-cyan-200/20'}`} style={{ left: `${region.left}%`, top: `${region.top}%`, width: `${region.width}%`, height: `${region.height}%` }} key={region.quadra} type="button" onClick={() => onQuadraSelect(region.quadra)} aria-label={`Selecionar quadra ${region.quadra}`}><span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-slate-950/80 px-2 py-1 text-sm font-black text-white shadow-lg transition group-hover:scale-110">{region.quadra}</span><span className="absolute bottom-1 right-1 rounded-full bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-bold text-cyan-50">{counts[region.quadra] ?? 0}</span></button>)}</div>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) { return <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-cyan-100"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.16em] opacity-75">{label}</span><Icon className="h-4 w-4" /></div><strong className="mt-2 block text-2xl font-black text-white">{value}</strong></div>; }
function unitTypeLabel(type: UnitType) { return type === 'CASA' ? 'Casa' : 'Lote'; }
function residentName(unit: Unit) { return typeof unit.residentCurrentId === 'object' ? unit.residentCurrentId?.name ?? 'Sem morador atual' : 'Sem morador atual'; }
