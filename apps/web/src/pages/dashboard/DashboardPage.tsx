// Página inicial do dashboard — cards de resumo + próximos agendamentos
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDashboardSummary } from '../../hooks/useDashboardSummary';
import { StatusBadge } from '../../components/dashboard/StatusBadge';

// ─── Ícones inline ────────────────────────────────────────────────────────────
const Icons = {
  calendar: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  money:    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  check:    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  x:        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  users:    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
};

// ─── Card de resumo ───────────────────────────────────────────────────────────
interface SummaryCardProps {
  label:     string;
  value:     string | number;
  icon:      React.ReactNode;
  iconBg:    string;
  iconColor: string;
  loading:   boolean;
}

function SummaryCard({ label, value, icon, iconBg, iconColor, loading }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        {loading
          ? <div className="mt-1 h-7 w-16 bg-gray-100 rounded animate-pulse" />
          : <p className="text-2xl font-bold text-gray-800 tabular-nums">{value}</p>
        }
      </div>
    </div>
  );
}

// ─── Linha de agendamento próximo ─────────────────────────────────────────────
function upcomingDateLabel(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d))    return `Hoje, ${format(d, 'HH:mm')}`;
  if (isTomorrow(d)) return `Amanhã, ${format(d, 'HH:mm')}`;
  return format(d, "dd/MM, HH:mm");
}

// ─── DashboardPage ────────────────────────────────────────────────────────────
export function DashboardPage() {
  const { data: summary, isLoading } = useDashboardSummary();

  const revenue = summary
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.totalRevenue)
    : 'R$ 0,00';

  // Mês atual para o título dos cards mensais
  const monthLabel = format(new Date(), 'MMMM', { locale: ptBR });
  const monthCap   = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const upcoming = summary?.todayAppointments ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">

      {/* ── Cabeçalho ── */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Visão Geral</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          label="Hoje"
          value={summary?.upcomingToday ?? 0}
          icon={Icons.calendar}
          iconBg="bg-blue-50"
          iconColor="text-[#2E75B6]"
          loading={isLoading}
        />
        <SummaryCard
          label={`Receita — ${monthCap}`}
          value={revenue}
          icon={Icons.money}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          loading={isLoading}
        />
        <SummaryCard
          label={`Confirmados — ${monthCap}`}
          value={summary?.completedAppointments ?? 0}
          icon={Icons.check}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          loading={isLoading}
        />
        <SummaryCard
          label={`Cancelados — ${monthCap}`}
          value={summary?.cancelledAppointments ?? 0}
          icon={Icons.x}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          loading={isLoading}
        />
      </div>

      {/* ── Novos clientes ── */}
      {!isLoading && (summary?.newClients ?? 0) > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <span className="text-[#2E75B6]">{Icons.users}</span>
          <p className="text-sm text-blue-700">
            <span className="font-semibold">{summary!.newClients} novo{summary!.newClients > 1 ? 's' : ''} cliente{summary!.newClients > 1 ? 's' : ''}</span>
            {' '}cadastrado{summary!.newClients > 1 ? 's' : ''} neste mês
          </p>
        </div>
      )}

      {/* ── Agendamentos de hoje ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Agendamentos de Hoje
        </h2>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
                <div className="flex gap-3 items-center">
                  <div className="w-1 h-12 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && upcoming.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">Nenhum agendamento para hoje</p>
          </div>
        )}

        {!isLoading && upcoming.length > 0 && (
          <div className="space-y-2">
            {upcoming.map((appt) => (
              <div
                key={appt.id}
                className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm"
              >
                {/* Barra colorida do serviço */}
                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ backgroundColor: appt.service.color }}
                />

                {/* Horário */}
                <div className="text-center flex-shrink-0 w-16">
                  <p className="text-sm font-bold text-gray-800 tabular-nums">
                    {format(parseISO(appt.startDateTime), 'HH:mm')}
                  </p>
                  <p className="text-xs text-gray-400 tabular-nums">
                    {format(parseISO(appt.endDateTime), 'HH:mm')}
                  </p>
                </div>

                {/* Cliente + serviço */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{appt.client.name}</p>
                  <p className="text-xs text-gray-400 truncate">{appt.service.name}</p>
                </div>

                {/* Status */}
                <StatusBadge status={appt.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
