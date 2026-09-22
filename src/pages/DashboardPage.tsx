import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { CompetenceInput } from '../components/CompetenceInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowDownRight, ArrowUpRight, Banknote, Building2, CalendarDays, Landmark, Receipt, ShieldCheck, WalletCards } from 'lucide-react';
import { currentCompetence } from '../utils/competence';
import { formatCents } from '../utils/money';

const fallback = {
  competence: currentCompetence(),
  unitsCount: 0,
  revenueForecast: 0,
  revenueReceived: 0,
  revenuePending: 0,
  pendingUnitsCount: 0,
  expensePaid: 0,
  openCommitments: 0,
  bankBalance: 0,
  availableBalance: 0,
  unmatchedCreditsCount: 0
};

export function DashboardPage() {
  const [data, setData] = useState(fallback);
  const [competence, setCompetence] = useState(fallback.competence);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get('/dashboard', { params: { competence } }),
      api.get('/bank-transactions/credits/unmatched', { params: { competence, status: 'UNMATCHED' } })
    ])
      .then(([dashboardResponse, creditsResponse]) => {
        if (!active) return;
        setData((previous) => ({
          ...previous,
          ...dashboardResponse.data,
          unmatchedCreditsCount: creditsResponse.data.items.length
        }));
        setError('');
      })
      .catch((caught) => {
        if (active) setError(apiErrorMessage(caught, 'Não foi possível carregar o dashboard.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [competence]);

  function changeCompetence(value: string) {
    setLoading(true);
    setCompetence(value);
  }

  const collectionRate = data.revenueForecast > 0
    ? Math.round((data.revenueReceived / data.revenueForecast) * 100)
    : 0;
  const pendingRate = data.unitsCount > 0
    ? Math.round((data.pendingUnitsCount / data.unitsCount) * 100)
    : 0;
  const netPosition = data.revenueReceived - data.expensePaid;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(247,185,85,0.18),_transparent_32%),linear-gradient(135deg,_#07111f_0%,_#0f172a_52%,_#0b1324_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.65fr] lg:p-8">
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Financeiro do condomínio
                </span>
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                    Painel executivo da competência
                  </h1>
                  <p className="text-base leading-7 text-slate-300 sm:text-lg">
                    Acompanhe arrecadação, pendências, despesas, saldo e conciliação em uma visão única para decisões rápidas.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <HeroMetric label="Arrecadação" value={`${collectionRate}%`} hint="Recebido sobre previsto" tone="success" />
                <HeroMetric label="Pendência" value={`${pendingRate}%`} hint="Unidades com saldo aberto" tone="warning" />
                <HeroMetric label="Posição líquida" value={formatCents(netPosition)} hint="Recebido menos despesas pagas" tone={netPosition >= 0 ? 'success' : 'danger'} />
              </div>
            </div>

            <Card className="border-white/10 bg-slate-950/45 text-white shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <CalendarDays className="h-4 w-4 text-amber-300" />
                  Competência
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Selecione o mês financeiro</label>
                  <CompetenceInput value={competence} onChange={changeCompetence} />
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Saldo disponível</p>
                  {loading ? <Skeleton className="mt-3 h-9 w-36 bg-white/15" /> : <strong className="mt-2 block text-3xl font-black text-white">{formatCents(data.availableBalance)}</strong>}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

      {error && (
        <Alert variant="destructive" className="border-red-400/30 bg-red-950/50 text-red-100">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCardItem icon={Banknote} label="Receita prevista" value={formatCents(data.revenueForecast)} loading={loading} variant="primary" />
          <StatCardItem icon={ArrowUpRight} label="Recebido" value={formatCents(data.revenueReceived)} loading={loading} variant="success" />
          <StatCardItem icon={ArrowDownRight} label="Pendente" value={formatCents(data.revenuePending)} loading={loading} variant="warning" />
          <StatCardItem icon={Building2} label="Unidades pendentes" value={`${data.pendingUnitsCount} de ${data.unitsCount}`} loading={loading} variant="warning" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
          <InsightPanel
            title="Receitas"
            icon={WalletCards}
            loading={loading}
            items={[
              ['Previsto', formatCents(data.revenueForecast)],
              ['Recebido', formatCents(data.revenueReceived)],
              ['Pendente', formatCents(data.revenuePending)]
            ]}
            footer={`${collectionRate}% da receita prevista já entrou.`}
          />
          <InsightPanel
            title="Despesas e compromissos"
            icon={Receipt}
            loading={loading}
            items={[
              ['Despesas pagas', formatCents(data.expensePaid)],
              ['Compromissos abertos', formatCents(data.openCommitments)],
              ['Posição líquida', formatCents(netPosition)]
            ]}
            footer={netPosition >= 0 ? 'Resultado da competência está positivo.' : 'Atenção: despesas pagas superam recebimentos.'}
          />
          <InsightPanel
            title="Banco e conciliação"
            icon={Landmark}
            loading={loading}
            items={[
              ['Saldo bancário', formatCents(data.bankBalance)],
              ['Saldo disponível', formatCents(data.availableBalance)],
              ['Créditos não conciliados', `${data.unmatchedCreditsCount}`]
            ]}
            footer={data.unmatchedCreditsCount > 0 ? 'Há créditos aguardando conciliação.' : 'Sem créditos pendentes de conciliação.'}
          />
        </section>
      </div>
    </div>
  );
}

interface StatCardItemProps {
  icon: typeof Banknote;
  label: string;
  value: string;
  loading?: boolean;
  variant?: 'primary' | 'success' | 'warning' | 'destructive' | 'info';
}

function StatCardItem({ icon: Icon, label, value, loading, variant = 'primary' }: StatCardItemProps) {
  const variantStyles = {
    primary: 'border-blue-300/20 bg-blue-400/10 text-blue-100',
    success: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
    warning: 'border-amber-300/20 bg-amber-400/10 text-amber-100',
    destructive: 'border-red-300/20 bg-red-400/10 text-red-100',
    info: 'border-slate-300/20 bg-slate-400/10 text-slate-100'
  };

  const iconStyles = {
    primary: 'bg-blue-300/15 text-blue-200',
    success: 'bg-emerald-300/15 text-emerald-200',
    warning: 'bg-amber-300/15 text-amber-200',
    destructive: 'bg-red-300/15 text-red-200',
    info: 'bg-slate-300/15 text-slate-200'
  };

  return (
    <Card className={`${variantStyles[variant]} border shadow-none backdrop-blur-xl`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-slate-300">{label}</p>
            {loading ? (
              <Skeleton className="h-8 w-28 bg-white/15" />
            ) : (
              <p className="text-2xl font-black tracking-tight text-white">
                {value}
              </p>
            )}
          </div>
          <span className={`rounded-2xl p-3 ${iconStyles[variant]}`}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

type HeroMetricProps = {
  label: string;
  value: string;
  hint: string;
  tone: 'success' | 'warning' | 'danger';
};

function HeroMetric({ label, value, hint, tone }: HeroMetricProps) {
  const toneClass = {
    success: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    warning: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    danger: 'border-red-300/20 bg-red-300/10 text-red-100'
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">{label}</p>
      <strong className="mt-2 block text-2xl font-black text-white">{value}</strong>
      <span className="mt-1 block text-sm text-slate-300">{hint}</span>
    </div>
  );
}

type InsightPanelProps = {
  title: string;
  icon: typeof Banknote;
  loading: boolean;
  items: Array<[string, string]>;
  footer: string;
};

function InsightPanel({ title, icon: Icon, loading, items, footer }: InsightPanelProps) {
  return (
    <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg text-white">
          <span className="rounded-2xl bg-white/10 p-2 text-amber-200">
            <Icon className="h-5 w-5" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {items.map(([label, value]) => (
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3" key={label}>
              <span className="text-sm text-slate-300">{label}</span>
              {loading ? <Skeleton className="h-5 w-24 bg-white/15" /> : <strong className="text-right font-bold text-white">{value}</strong>}
            </div>
          ))}
        </div>
        <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">{footer}</p>
      </CardContent>
    </Card>
  );
}
