// Página de agendamentos — tabela com filtros, ações, paginação e exportação CSV
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useAppointments,
  useUpdateAppointmentStatus,
  type AppointmentStatus,
  type Appointment,
} from '../../hooks/useAppointments';
import { StatusBadge, statusLabel } from '../../components/dashboard/StatusBadge';

// ─── Constantes ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: AppointmentStatus | ''; label: string }[] = [
  { value: '',          label: 'Todos'             },
  { value: 'PENDING',   label: 'Pendente'          },
  { value: 'CONFIRMED', label: 'Confirmado'        },
  { value: 'COMPLETED', label: 'Concluído'         },
  { value: 'CANCELLED', label: 'Cancelado'         },
  { value: 'NO_SHOW',   label: 'Não compareceu'   },
];

const VALID_TRANSITIONS: Record<string, AppointmentStatus[]> = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [], CANCELLED: [], NO_SHOW: [],
};

const ACTION_LABELS: Record<AppointmentStatus, string> = {
  CONFIRMED: 'Confirmar',
  COMPLETED: 'Concluir',
  CANCELLED: 'Cancelar',
  NO_SHOW:   'Não compareceu',
  PENDING:   '',
};

// ─── Modal de confirmação de cancelamento ──────────────────────────────────────
interface CancelModalProps {
  appt:    Appointment;
  onClose: () => void;
}

function CancelModal({ appt, onClose }: CancelModalProps) {
  const updateStatus = useUpdateAppointmentStatus();
  const [reason, setReason] = useState('');

  function handleConfirm() {
    updateStatus.mutate(
      { id: appt.id, status: 'CANCELLED', cancelReason: reason },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Cancelar agendamento</h3>
        <p className="text-sm text-gray-500">
          Tem certeza que deseja cancelar o agendamento de{' '}
          <span className="font-medium text-gray-700">{appt.client.name}</span>?
        </p>
        <div>
          <label className="block text-xs text-gray-500 font-medium mb-1">
            Motivo (opcional)
          </label>
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none
                       focus:outline-none focus:ring-2 focus:ring-red-300"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: solicitado pelo cliente..."
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={updateStatus.isPending}
            className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold
                       rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {updateStatus.isPending ? 'Cancelando...' : 'Cancelar agendamento'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600
                       rounded-lg hover:bg-gray-50 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Exportação CSV ────────────────────────────────────────────────────────────
function exportToCsv(appointments: Appointment[]) {
  const header = ['Data', 'Horário', 'Cliente', 'E-mail', 'Telefone', 'Serviço', 'Duração (min)', 'Preço (R$)', 'Status'];
  const rows = appointments.map((a) => [
    format(parseISO(a.startDateTime), 'dd/MM/yyyy'),
    format(parseISO(a.startDateTime), 'HH:mm'),
    a.client.name,
    a.client.email,
    a.client.phone ?? '',
    a.service.name,
    a.service.durationMinutes,
    a.service.price.toFixed(2).replace('.', ','),
    statusLabel(a.status),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `agendamentos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── AppointmentsPage ──────────────────────────────────────────────────────────
export function AppointmentsPage() {
  const [page,      setPage]      = useState(1);
  const [status,    setStatus]    = useState<AppointmentStatus | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');

  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const updateStatus = useUpdateAppointmentStatus();

  const { data, isLoading, isFetching } = useAppointments({
    page,
    limit:     PAGE_SIZE,
    status,
    startDate: startDate || undefined,
    endDate:   endDate   || undefined,
    refetchInterval: 60_000,
  });

  const appointments = data?.appointments ?? [];
  const totalPages   = data?.totalPages   ?? 1;
  const total        = data?.total        ?? 0;

  // Exporta todos os registros da página atual
  function handleExport() {
    exportToCsv(appointments);
  }

  // Atualiza status sem abrir modal (exceto cancelamento)
  function handleAction(appt: Appointment, newStatus: AppointmentStatus) {
    if (newStatus === 'CANCELLED') {
      setCancelTarget(appt);
      return;
    }
    updateStatus.mutate({ id: appt.id, status: newStatus });
  }

  function resetFilters() {
    setStatus('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  const hasFilters = !!status || !!startDate || !!endDate;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 max-w-6xl mx-auto">
      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Agendamentos</h1>
          {!isLoading && (
            <p className="text-sm text-gray-400 mt-0.5">
              {total} resultado{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={handleExport}
          disabled={appointments.length === 0}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm
                     font-medium text-gray-600 rounded-lg hover:bg-gray-50
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3 flex-wrap items-end">
        {/* Data início */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Data inicial</label>
          <input
            type="date"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          />
        </div>

        {/* Data fim */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Data final</label>
          <input
            type="date"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          />
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Status</label>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
            value={status}
            onChange={(e) => { setStatus(e.target.value as AppointmentStatus | ''); setPage(1); }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Limpar filtros */}
        {hasFilters && (
          <button
            onClick={resetFilters}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Limpar filtros
          </button>
        )}

        {isFetching && !isLoading && (
          <div className="w-4 h-4 border-2 border-[#2E75B6] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* ── Tabela ── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">
              {hasFilters ? 'Nenhum agendamento encontrado com esses filtros.' : 'Nenhum agendamento ainda.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Data / Hora</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Cliente</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Serviço</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {appointments.map((appt) => {
                    const actions = VALID_TRANSITIONS[appt.status] ?? [];
                    return (
                      <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                        {/* Data */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium text-gray-800 tabular-nums">
                            {format(parseISO(appt.startDateTime), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                          <p className="text-xs text-gray-400 tabular-nums">
                            {format(parseISO(appt.startDateTime), 'HH:mm')}
                            {' – '}
                            {format(parseISO(appt.endDateTime), 'HH:mm')}
                          </p>
                        </td>

                        {/* Cliente */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{appt.client.name}</p>
                          <p className="text-xs text-gray-400">{appt.client.email}</p>
                        </td>

                        {/* Serviço */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: appt.service.color }}
                            />
                            <span className="text-gray-700">{appt.service.name}</span>
                          </div>
                          <p className="text-xs text-gray-400 ml-4">
                            {appt.service.durationMinutes}min
                            {' · '}
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(appt.service.price)}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={appt.status} />
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {actions.map((action) => (
                              <button
                                key={action}
                                onClick={() => handleAction(appt, action)}
                                disabled={updateStatus.isPending}
                                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors
                                  disabled:opacity-50
                                  ${action === 'CANCELLED'
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                    : action === 'CONFIRMED'
                                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                    : action === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                              >
                                {ACTION_LABELS[action]}
                              </button>
                            ))}
                            {actions.length === 0 && (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden divide-y divide-gray-50">
              {appointments.map((appt) => {
                const actions = VALID_TRANSITIONS[appt.status] ?? [];
                return (
                  <div key={appt.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-800">{appt.client.name}</p>
                        <p className="text-xs text-gray-400">{appt.client.email}</p>
                      </div>
                      <StatusBadge status={appt.status} />
                    </div>

                    <div className="flex gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">Data</p>
                        <p className="font-medium text-gray-700 tabular-nums">
                          {format(parseISO(appt.startDateTime), 'dd/MM/yyyy')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Horário</p>
                        <p className="font-medium text-gray-700 tabular-nums">
                          {format(parseISO(appt.startDateTime), 'HH:mm')}
                          {' – '}
                          {format(parseISO(appt.endDateTime), 'HH:mm')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Serviço</p>
                        <p className="font-medium text-gray-700">{appt.service.name}</p>
                      </div>
                    </div>

                    {actions.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {actions.map((action) => (
                          <button
                            key={action}
                            onClick={() => handleAction(appt, action)}
                            disabled={updateStatus.isPending}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                              disabled:opacity-50
                              ${action === 'CANCELLED'
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : action === 'CONFIRMED'
                                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                : action === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                          >
                            {ACTION_LABELS[action]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600
                         hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600
                         hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Modal cancelamento */}
      {cancelTarget && (
        <CancelModal
          appt={cancelTarget}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}
