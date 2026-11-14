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
type Region = { quadra: Quadra; x: number; y: number; width: number; height: number; columns: number };

const regions: Region[] = [
  { quadra: 'D', x: 82, y: 100, width: 150, height: 218, columns: 3 },
  { quadra: 'C', x: 250, y: 100, width: 176, height: 218, columns: 4 },
  { quadra: 'B', x: 446, y: 145, width: 300, height: 174, columns: 6 },
  { quadra: 'A', x: 768, y: 100, width: 132, height: 174, columns: 3 },
  { quadra: 'G', x: 82, y: 390, width: 150, height: 132, columns: 3 },
  { quadra: 'F', x: 250, y: 390, width: 176, height: 132, columns: 4 },
  { quadra: 'E', x: 446, y: 374, width: 354, height: 148, columns: 8 },
  { quadra: 'H', x: 446, y: 548, width: 354, height: 90, columns: 8 }
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
    const residentName = typeof unit.residentCurrentId === 'object' ? unit.residentCurrentId?.name ?? '' : '';
    const matchesSearch = !search || `${unit.quadra} ${unit.numero} ${unit.tipo} ${residentName}`.toLocaleLowerCase('pt-BR').includes(search);
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
            <div className="space-y-4"><span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-100"><Map className="h-3.5 w-3.5" /> Planta oficial</span><div className="space-y-3"><h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Mapa do condomínio</h1><p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Explore as quadras A–H e consulte as unidades cadastradas sem incluir a Alameda Vida Nova no perímetro.</p></div></div>
            <Card className="border-white/10 bg-slate-950/45 text-white shadow-none"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-white"><Search className="h-4 w-4 text-amber-300" />Filtros do mapa</CardTitle></CardHeader><CardContent className="grid gap-4"><label className={labelClass}>Buscar unidade ou morador<input className={fieldClass} value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Ex.: E 19 ou Eduardo" /></label><div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Tipo<select className={fieldClass} value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">Todos</option><option value="CASA">Casa</option><option value="LOTE">Lote</option></select></label><label className={labelClass}>Status<select className={fieldClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Todos</option><option value="ATIVA">Ativa</option><option value="INATIVA">Inativa</option></select></label></div></CardContent></Card>
          </div>
        </section>

        {error ? <Alert variant="destructive" className="border-red-400/30 bg-red-950/50 text-red-100"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="overflow-hidden border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl"><CardHeader className="flex-row items-start justify-between gap-4 space-y-0"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Planta vetorial</p><CardTitle className="mt-2 text-xl text-white">Jardim das Esmeraldas</CardTitle></div><span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-sm font-black text-emerald-100">{visibleUnits.length} unidade(s)</span></CardHeader><CardContent><div className="flex flex-wrap gap-2 pb-4">{(['TODAS', ...regions.map((region) => region.quadra)] as const).map((quadra) => <button className={`rounded-xl border px-3 py-2 text-xs font-black transition ${selectedQuadra === quadra ? 'border-amber-300/50 bg-amber-300/15 text-amber-100' : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white'}`} key={quadra} type="button" onClick={() => setSelectedQuadra(quadra)}>{quadra === 'TODAS' ? 'Todas' : `Quadra ${quadra}`} {quadra !== 'TODAS' ? <span className="ml-1 opacity-60">{counts[quadra] ?? 0}</span> : null}</button>)}</div><VectorMap regions={regions} units={units} visibleUnitIds={new Set(visibleUnits.map((unit) => unit._id))} selectedQuadra={selectedQuadra} counts={counts} onQuadraSelect={setSelectedQuadra} onUnitSelect={setSelectedUnit} /><div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400"><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded border-2 border-cyan-200/60 bg-cyan-300/10" />Quadra disponível</span><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded border-2 border-amber-200 bg-amber-300/30" />Quadra selecionada</span><span className="inline-flex items-center gap-2"><CircleDot className="h-3 w-3 text-slate-400" />Alameda Vida Nova fora do condomínio</span><span className="text-slate-500">Visualização operacional, não cadastral.</span></div></CardContent></Card>

          <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl"><CardHeader><p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Cadastro</p><CardTitle className="mt-2 text-xl text-white">Unidades da seleção</CardTitle></CardHeader><CardContent>{loading ? <div className="space-y-3"><Skeleton className="h-14 rounded-2xl bg-white/10" /><Skeleton className="h-14 rounded-2xl bg-white/10" /><Skeleton className="h-14 rounded-2xl bg-white/10" /></div> : <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">{visibleUnits.map((unit) => <button className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-amber-300/40 hover:bg-amber-300/10" key={unit._id} type="button" onClick={() => setSelectedUnit(unit)}><div className="flex items-start justify-between gap-3"><div><p className="font-black text-white">Quadra {unit.quadra} · {unitTypeLabel(unit.tipo)} {unit.numero}</p><p className="mt-1 truncate text-xs text-slate-400">{residentName(unit)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${unit.status === 'ATIVA' ? 'bg-emerald-300/10 text-emerald-100' : 'bg-slate-300/10 text-slate-300'}`}>{unit.status === 'ATIVA' ? 'Ativa' : 'Inativa'}</span></div></button>)}{visibleUnits.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Nenhuma unidade encontrada para os filtros.</div> : null}</div>}</CardContent></Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-3"><Summary icon={Building2} label="Unidades cadastradas" value={`${units.length}`} /><Summary icon={Home} label="Casas" value={`${units.filter((unit) => unit.tipo === 'CASA').length}`} /><Summary icon={Landmark} label="Lotes" value={`${units.filter((unit) => unit.tipo === 'LOTE').length}`} /></div>

        {selectedUnit ? <Modal title={`Quadra ${selectedUnit.quadra} · ${unitTypeLabel(selectedUnit.tipo)} ${selectedUnit.numero}`} subtitle="Detalhes da unidade selecionada no mapa" onClose={() => setSelectedUnit(null)}><div className="summary-grid detail-summary"><div className="mini-card"><span>Morador atual</span><strong>{residentName(selectedUnit)}</strong></div><div className="mini-card"><span>Status</span><strong>{selectedUnit.status === 'ATIVA' ? 'Ativa' : 'Inativa'}</strong></div><div className="mini-card"><span>Mensalidade</span><strong>{formatCents(selectedUnit.monthlyValue)}</strong></div><div className="mini-card"><span>Identidade</span><strong>{selectedUnit.unitKey}</strong></div></div></Modal> : null}
      </div>
    </div>
  );
}

function VectorMap({ regions, units, visibleUnitIds, selectedQuadra, counts, onQuadraSelect, onUnitSelect }: { regions: Region[]; units: Unit[]; visibleUnitIds: Set<string>; selectedQuadra: Quadra | 'TODAS'; counts: Record<string, number>; onQuadraSelect: (quadra: Quadra) => void; onUnitSelect: (unit: Unit) => void }) {
  const trees = [[35, 120], [460, 105], [705, 116], [920, 120], [50, 570], [305, 575], [850, 570], [940, 600]];
  return <div className="relative overflow-hidden rounded-3xl border border-emerald-200/20 bg-[#b8d394] shadow-inner shadow-emerald-950/30"><svg className="block h-auto w-full" viewBox="0 0 1000 700" role="img" aria-label="Mapa vetorial interativo colorido das quadras do Condomínio Jardim das Esmeraldas"><defs><linearGradient id="map-ground" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#d7e8ad" /><stop offset="0.52" stopColor="#a5ca7d" /><stop offset="1" stopColor="#79ae70" /></linearGradient><pattern id="map-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#356847" strokeOpacity="0.08" /></pattern><filter id="map-shadow"><feDropShadow dx="0" dy="7" floodColor="#163b24" floodOpacity="0.25" stdDeviation="7" /></filter></defs><rect width="1000" height="700" fill="url(#map-ground)" /><rect width="1000" height="700" fill="url(#map-grid)" /><text x="48" y="48" fill="#305b3a" fontSize="13" fontWeight="900" letterSpacing="3">PLANTA DO CONDOMÍNIO</text><text x="48" y="70" fill="#47764d" fontSize="11" fontWeight="700">JARDIM DAS ESMERALDAS · QUADRAS A–H</text>{trees.map(([x, y]) => <MapTree key={`${x}-${y}`} x={x} y={y} />)}<MapRoad x="40" y="330" width="920" label="AV. PRINCIPAL" horizontal /><MapRoad x="410" y="520" width="430" label="4ª AVENIDA" horizontal /><MapRoad x="395" y="72" width="510" label="2ª AVENIDA" horizontal /><MapRoad x="55" y="72" width="225" label="RETORNO" horizontal /><MapRoad x="232" y="80" width="280" label="TRANSVERSAL" /><MapRoad x="740" y="78" width="270" label="TRANSVERSAL" /><MapRoad x="230" y="370" width="250" label="TRANSVERSAL" /><MapRoad x="800" y="355" width="170" label="TRANSVERSAL" /><MapAmenity x={848} y={388} /><g opacity="0.46"><path d="M20 615 C120 560 215 590 290 650 M700 650 C785 580 870 570 980 620" fill="none" stroke="#4c955b" strokeWidth="42" strokeLinecap="round" /><text x="790" y="625" fill="#e8f2c9" fontSize="12" fontWeight="900">ÁREA VERDE</text></g>{regions.map((region) => { const regionUnits = units.filter((unit) => unit.quadra === region.quadra); const selected = selectedQuadra === region.quadra; return <g key={region.quadra}><rect x={region.x} y={region.y} width={region.width} height={region.height} rx="12" fill={selected ? '#f4d365' : '#91bc6e'} fillOpacity={selected ? '0.8' : '0.76'} stroke={selected ? '#996b24' : '#4e884e'} strokeOpacity="0.95" strokeWidth={selected ? '4' : '3'} filter="url(#map-shadow)" onClick={() => onQuadraSelect(region.quadra)} /><text x={region.x + 16} y={region.y + 26} fill="#254c2c" fontSize="21" fontWeight="900" onClick={() => onQuadraSelect(region.quadra)}>{region.quadra}</text><text x={region.x + 16} y={region.y + 45} fill="#3d6f3b" fontSize="10" fontWeight="900">{counts[region.quadra] ?? 0} UNIDADES</text>{regionUnits.map((unit, index) => <MapUnit key={unit._id} unit={unit} index={index} region={region} active={visibleUnitIds.has(unit._id)} onSelect={onUnitSelect} />)}</g>; })}</svg></div>;
}

function MapRoad({ x, y, width, label, horizontal = false }: { x: number | string; y: number | string; width: number | string; label: string; horizontal?: boolean }) {
  const xValue = Number(x);
  const yValue = Number(y);
  const widthValue = Number(width);
  return <g opacity="0.94"><rect x={xValue} y={yValue} width={horizontal ? widthValue : 24} height={horizontal ? 24 : widthValue} rx="12" fill="#3e4b43" stroke="#f0e4bc" strokeOpacity="0.72" strokeWidth="2" /><path d={horizontal ? `M${xValue + 10} ${yValue + 12} H${xValue + widthValue - 10}` : `M${xValue + 12} ${yValue + 10} V${yValue + widthValue - 10}`} stroke="#fff8d6" strokeDasharray="11 9" strokeOpacity="0.9" /><text x={horizontal ? xValue + widthValue / 2 : xValue + 12} y={horizontal ? yValue + 15 : yValue + widthValue / 2} fill="#fff8d6" fontSize="9" fontWeight="900" textAnchor="middle" transform={horizontal ? undefined : `rotate(-90 ${xValue + 12} ${yValue + widthValue / 2})`}>{label}</text></g>;
}

function MapUnit({ unit, index, region, active, onSelect }: { unit: Unit; index: number; region: Region; active: boolean; onSelect: (unit: Unit) => void }) {
  const rows = Math.max(1, Math.ceil((index + 1) / region.columns));
  const gap = 6;
  const tileWidth = (region.width - 26 - gap * (region.columns - 1)) / region.columns;
  const tileHeight = Math.max(17, Math.min(27, (region.height - 58 - gap * (rows - 1)) / rows));
  const x = region.x + 14 + (index % region.columns) * (tileWidth + gap);
  const y = region.y + 54 + Math.floor(index / region.columns) * (tileHeight + gap);
  const paid = unit.status === 'ATIVA' && Boolean(unit.residentCurrentId);
  return <g role="button" tabIndex={0} aria-label={`Abrir ${unitTypeLabel(unit.tipo)} ${unit.numero}, quadra ${unit.quadra}`} opacity={active ? 1 : 0.2} onClick={(event) => { event.stopPropagation(); onSelect(unit); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(unit); } }}><rect x={x} y={y} width={tileWidth} height={tileHeight} rx="5" fill={unit.tipo === 'CASA' ? '#d97745' : paid ? '#67a65c' : '#d6bc62'} fillOpacity="0.95" stroke={active ? '#fff8d6' : '#fff'} strokeOpacity="0.8" /><text x={x + tileWidth / 2} y={y + tileHeight / 2 + 3} fill="#2c3423" fontSize="9" fontWeight="900" textAnchor="middle">{unit.numero}</text></g>;
}

function MapTree({ x, y }: { x: number; y: number }) { return <g opacity="0.78"><circle cx={x} cy={y} r="13" fill="#3f813c" /><circle cx={x - 8} cy={y + 5} r="8" fill="#5da64b" /><circle cx={x + 8} cy={y + 5} r="8" fill="#2e6f3a" /><path d={`M${x} ${y + 10} V${y + 20}`} stroke="#78543a" strokeWidth="3" /></g>; }

function MapAmenity({ x, y }: { x: number; y: number }) { return <g><rect x={x} y={y} width="115" height="118" rx="18" fill="#d7e7cf" stroke="#568761" strokeOpacity="0.8" strokeWidth="2" /><rect x={x + 16} y={y + 16} width="32" height="42" rx="8" fill="#29a9d1" /><rect x={x + 58} y={y + 16} width="32" height="42" rx="8" fill="#3cc1df" /><rect x={x + 18} y={y + 72} width="72" height="22" rx="8" fill="#e3934b" /><text x={x + 57} y={y + 110} fill="#386641" fontSize="9" fontWeight="900" textAnchor="middle">ÁREA DE LAZER</text></g>; }

function Summary({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) { return <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-cyan-100"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.16em] opacity-75">{label}</span><Icon className="h-4 w-4" /></div><strong className="mt-2 block text-2xl font-black text-white">{value}</strong></div>; }
function unitTypeLabel(type: UnitType) { return type === 'CASA' ? 'Casa' : 'Lote'; }
function residentName(unit: Unit) { return typeof unit.residentCurrentId === 'object' ? unit.residentCurrentId?.name ?? 'Sem morador atual' : 'Sem morador atual'; }
