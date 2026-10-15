import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, apiErrorMessage } from '../api/client';
import { currentCompetence, formatCompetence } from '../utils/competence';
import { formatCents } from '../utils/money';
import { AlertCircle, Banknote, BarChart3, Building2, CalendarRange, CircleDollarSign, Landmark, Receipt, RefreshCw, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';

type MonthRevenue = { month: string; forecast: number; received: number; pending: number };
type ReportData = {
  period: { from: string; to: string; months: string[] };
  revenue: { totals: { forecast: number; received: number; pending: number }; byMonth: MonthRevenue[] };
  delinquency: { totalAmount: number; peopleCount: number; chargesCount: number; items: { residentName: string; unitLabel: string; charges: number; amount: number; maxDaysOverdue: number }[] };
  unitPosition: { unitId: string; unitLabel: string; residentName: string; forecast: number; received: number; pending: number }[];
  expenses: { totalAmount: number; amountUnavailableCount: number; items: { categoryId: string; categoryName: string; amount: number; count: number }[] };
  cashFlow: { totalCredits: number; totalDebits: number; net: number; byMonth: { month: string; credits: number; debits: number; net: number }[] };
  reconciliation: { totalTransactions: number; totalCredits: number; totalDebits: number; byStatus: { status: string; count: number; amount: number }[] };
};

const fieldClass = 'mt-2 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20';
const chartColors = { received: 'bg-emerald-300', pending: 'bg-amber-300', credit: 'bg-cyan-300', debit: 'bg-rose-300', expense: 'bg-orange-300' };
const defaultTo = currentCompetence();
const defaultFrom = shiftCompetence(defaultTo, -5);

export function ReportsPage() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [appliedPeriod, setAppliedPeriod] = useState({ from: defaultFrom, to: defaultTo });
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadReports(period = appliedPeriod) {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ReportData>('/reports', { params: period });
      setData(response.data);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível carregar os relatórios.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    api.get<ReportData>('/reports', { params: { from: defaultFrom, to: defaultTo } })
      .then((response) => {
        if (active) setData(response.data);
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar os relatórios.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (from > to) {
      setError('A competência inicial deve ser anterior ou igual à competência final.');
      return;
    }
    const next = { from, to };
    setAppliedPeriod(next);
    void loadReports(next);
  }

  const topUnits = useMemo(() => (data?.unitPosition ?? []).slice().sort((left, right) => right.pending - left.pending).slice(0, 8), [data]);
  const maxRevenue = Math.max(...(data?.revenue.byMonth.map((item) => item.forecast) ?? [1]), 1);
  const maxCash = Math.max(...(data?.cashFlow.byMonth.flatMap((item) => [item.credits, item.debits]) ?? [1]), 1);
  const maxExpense = Math.max(...(data?.expenses.items.map((item) => item.amount) ?? [1]), 1);
  const maxDelinquency = Math.max(...(data?.delinquency.items.map((item) => item.amount) ?? [1]), 1);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.14),_transparent_32%),linear-gradient(135deg,_#07111f_0%,_#0f172a_54%,_#0b1324_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:p-8">
            <div className="space-y-4">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100"><BarChart3 className="h-3.5 w-3.5" /> Visão financeira</span>
              <div className="space-y-3"><h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Relatórios</h1><p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Receitas, despesas, inadimplência, posição patrimonial e conciliação em um único painel.</p></div>
            </div>
            <form className="grid items-end gap-3 sm:grid-cols-2 lg:min-w-[430px]" onSubmit={applyFilters}>
              <label className="text-sm font-semibold text-slate-300"><span className="flex items-center gap-2"><CalendarRange className="h-4 w-4 text-amber-300" /> De</span><input className={fieldClass} type="month" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
              <label className="text-sm font-semibold text-slate-300"><span>Até</span><input className={fieldClass} type="month" value={to} onChange={(event) => setTo(event.target.value)} /></label>
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2" disabled={loading} type="submit"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar relatório</button>
            </form>
          </div>
        </section>

        {error ? <Alert variant="destructive" className="border-red-400/30 bg-red-950/50 text-red-100"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}
        {loading && !data ? <LoadingState /> : data ? <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={TrendingUp} label="Recebido no período" value={formatCents(data.revenue.totals.received)} hint={`Previsão ${formatCents(data.revenue.totals.forecast)}`} tone="emerald" />
            <MetricCard icon={CircleDollarSign} label="Em inadimplência" value={formatCents(data.delinquency.totalAmount)} hint={`${data.delinquency.peopleCount} devedor(es) • ${data.delinquency.chargesCount} cobrança(s)`} tone="rose" />
            <MetricCard icon={TrendingDown} label="Despesas" value={formatCents(data.expenses.totalAmount)} hint={`${data.expenses.items.length} categoria(s) com valor`} tone="orange" />
            <MetricCard icon={WalletCards} label="Fluxo líquido" value={formatCents(data.cashFlow.net)} hint={`${data.reconciliation.totalTransactions} lançamento(s) bancário(s)`} tone={data.cashFlow.net >= 0 ? 'cyan' : 'rose'} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <ReportCard eyebrow="Receitas" title="Recebimentos por competência" icon={Banknote}>
              <div className="space-y-4">{data.revenue.byMonth.map((item) => <StackedMonthBar key={item.month} label={formatCompetence(item.month)} first={item.received} second={item.pending} total={maxRevenue} firstLabel="Recebido" secondLabel="Em aberto" firstColor={chartColors.received} secondColor={chartColors.pending} />)}</div>
              <Legend items={[[chartColors.received, 'Recebido'], [chartColors.pending, 'Em aberto']]} />
            </ReportCard>
            <ReportCard eyebrow="Carteira" title="Inadimplência" icon={TrendingDown}>
              <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-3xl font-black text-rose-100">{formatCents(data.delinquency.totalAmount)}</p><p className="mt-1 text-sm text-slate-400">saldo vencido no período</p></div><span className="rounded-full bg-rose-300/10 px-3 py-1 text-xs font-bold text-rose-100">{data.delinquency.peopleCount} devedor(es)</span></div>
              <div className="space-y-4">{data.delinquency.items.slice(0, 6).map((item) => <HorizontalBar key={`${item.residentName}-${item.unitLabel}`} label={item.residentName} detail={`${item.unitLabel} • ${item.maxDaysOverdue} dia(s)`} value={item.amount} max={maxDelinquency} color={chartColors.debit} />)}</div>
              {!data.delinquency.items.length ? <EmptyState text="Nenhuma cobrança vencida encontrada." /> : null}
            </ReportCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ReportCard eyebrow="Patrimônio" title="Posição por unidade" icon={Building2}>
              <div className="overflow-x-auto"><table className="min-w-[620px] w-full text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500"><tr><th className="pb-3">Unidade / morador</th><th className="pb-3">Recebido</th><th className="pb-3">Em aberto</th></tr></thead><tbody className="divide-y divide-white/10">{topUnits.map((item) => <tr key={item.unitId}><td className="py-3"><p className="font-bold text-white">{item.unitLabel}</p><p className="text-xs text-slate-400">{item.residentName}</p></td><td className="py-3 text-emerald-100">{formatCents(item.received)}</td><td className="py-3 font-bold text-amber-100">{formatCents(item.pending)}</td></tr>)}</tbody></table></div>
              {!topUnits.length ? <EmptyState text="Nenhuma unidade com cobrança no período." /> : null}
            </ReportCard>
            <ReportCard eyebrow="Despesas" title="Despesas por categoria" icon={Receipt}>
              <div className="space-y-4">{data.expenses.items.map((item) => <HorizontalBar key={item.categoryId} label={item.categoryName} detail={`${item.count} lançamento(s)`} value={item.amount} max={maxExpense} color={chartColors.expense} />)}</div>
              {data.expenses.amountUnavailableCount ? <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">{data.expenses.amountUnavailableCount} despesa(s) não possuem valor próprio associado a uma transação bancária e ficaram fora do total.</p> : null}
              {!data.expenses.items.length && !data.expenses.amountUnavailableCount ? <EmptyState text="Nenhuma despesa encontrada no período." /> : null}
            </ReportCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <ReportCard eyebrow="Tesouraria" title="Fluxo de caixa bancário" icon={Landmark}>
              <div className="space-y-4">{data.cashFlow.byMonth.map((item) => <StackedMonthBar key={item.month} label={formatCompetence(item.month)} first={item.credits} second={item.debits} total={maxCash} firstLabel="Entradas" secondLabel="Saídas" firstColor={chartColors.credit} secondColor={chartColors.debit} />)}</div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3"><SummaryStat label="Entradas" value={formatCents(data.cashFlow.totalCredits)} /><SummaryStat label="Saídas" value={formatCents(data.cashFlow.totalDebits)} /><SummaryStat label="Saldo" value={formatCents(data.cashFlow.net)} /></div>
            </ReportCard>
            <ReportCard eyebrow="Banco" title="Conciliação bancária" icon={Landmark}>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">{data.reconciliation.byStatus.map((item) => <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" key={item.status}><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-white">{statusLabel(item.status)}</p><span className="text-xs text-slate-400">{item.count} item(ns)</span></div><p className="mt-2 text-lg font-black text-cyan-100">{formatCents(item.amount)}</p></div>)}</div>
            </ReportCard>
          </div>
        </> : null}
      </div>
    </div>
  );
}

function ReportCard({ eyebrow, title, icon: Icon, children }: { eyebrow: string; title: string; icon: typeof BarChart3; children: ReactNode }) {
  return <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl"><CardHeader><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-100"><Icon className="h-4 w-4" /> {eyebrow}</p><CardTitle className="mt-2 text-xl text-white">{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>;
}

function MetricCard({ icon: Icon, label, value, hint, tone }: { icon: typeof TrendingUp; label: string; value: string; hint: string; tone: 'emerald' | 'rose' | 'orange' | 'cyan' }) {
  const tones = { emerald: 'text-emerald-200 bg-emerald-300/10', rose: 'text-rose-200 bg-rose-300/10', orange: 'text-orange-200 bg-orange-300/10', cyan: 'text-cyan-200 bg-cyan-300/10' };
  return <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl"><CardContent className="flex items-start justify-between gap-4 p-5"><div><p className="text-sm font-semibold text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p><p className="mt-2 text-xs text-slate-500">{hint}</p></div><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span></CardContent></Card>;
}

function StackedMonthBar({ label, first, second, total, firstLabel, secondLabel, firstColor, secondColor }: { label: string; first: number; second: number; total: number; firstLabel: string; secondLabel: string; firstColor: string; secondColor: string }) {
  return <div><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="font-bold text-slate-300">{label}</span><span className="text-slate-500">{formatCents(first + second)}</span></div><div className="flex h-3 overflow-hidden rounded-full bg-white/10"><span className={`${firstColor} transition-all`} style={{ width: `${Math.max((first / total) * 100, first ? 2 : 0)}%` }} title={`${firstLabel}: ${formatCents(first)}`} /><span className={`${secondColor} transition-all`} style={{ width: `${Math.max((second / total) * 100, second ? 2 : 0)}%` }} title={`${secondLabel}: ${formatCents(second)}`} /></div></div>;
}

function HorizontalBar({ label, detail, value, max, color }: { label: string; detail: string; value: number; max: number; color: string }) {
  return <div><div className="mb-2 flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{label}</p><p className="truncate text-xs text-slate-500">{detail}</p></div><span className="shrink-0 text-sm font-black text-amber-100">{formatCents(value)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.max((value / max) * 100, value ? 3 : 0)}%` }} /></div></div>;
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>;
}

function Legend({ items }: { items: [string, string][] }) {
  return <div className="mt-5 flex flex-wrap gap-4">{items.map(([color, label]) => <span className="inline-flex items-center gap-2 text-xs text-slate-400" key={label}><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>)}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">{text}</div>;
}

function LoadingState() {
  return <div className="grid gap-6 sm:grid-cols-2"><Skeleton className="h-28 rounded-[1.5rem] bg-white/10" /><Skeleton className="h-28 rounded-[1.5rem] bg-white/10" /><Skeleton className="h-80 rounded-[1.5rem] bg-white/10 sm:col-span-2" /></div>;
}

function statusLabel(status: string) {
  return { UNMATCHED: 'Não conciliado', PARTIALLY_MATCHED: 'Parcial', MATCHED: 'Conciliado' }[status] ?? status;
}

function shiftCompetence(value: string, offset: number) {
  const [year, month] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
}
