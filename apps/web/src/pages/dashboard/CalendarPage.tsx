// Página de calendário — visão Dia e Semana com blocos de agendamento
import { useState, useMemo } from 'react';
import {
  format, addDays, subDays, startOfWeek, endOfWeek,
  parseISO, isSameDay, differenceInMinutes, startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAppointments } from '../../hooks/useAppointments';
import { StatusBadge } from '../../components/dashboard/StatusBadge';
import { useUpdateAppointmentStatus, useCreateAppointment, type Appointment, type AppointmentStatus } from '../../hooks/useAppointments';
import { useClientsList } from '../../hooks/useClients';
import { useServices }    from '../../hooks/useServices';

// ─── Constantes de layout da timeline ────────────────────────────────────────
const HOUR_HEIGHT   = 80;   // px por hora
const START_HOUR    = 7;    // 07:00
const END_HOUR      = 21;   // 21:00
const TOTAL_HOURS   = END_HOUR - START_HOUR;
const TOTAL_HEIGHT  = TOTAL_HOURS * HOUR_HEIGHT;

type ViewMode = 'day' | 'week';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function appointmentTop(iso: string): number {
  const d = parseISO(iso);
  return ((d.getHours() - START_HOUR) * 60 + d.getMinutes()) / 60 * HOUR_HEIGHT;
}

function appointmentHeight(startIso: string, endIso: string): number {
  const mins = differenceInMinutes(parseISO(endIso), parseISO(startIso));
  return (mins / 60) * HOUR_HEIGHT;
}

// ─── Bloco de agendamento na timeline ────────────────────────────────────────
interface ApptBlockProps {
  appt:    Appointment;
  onClick: (appt: Appointment) => void;
}

function ApptBlock({ appt, onClick }: ApptBlockProps) {
  const top    = appointmentTop(appt.startDateTime);
  const height = Math.max(appointmentHeight(appt.startDateTime, appt.endDateTime), 32);

  return (
    <button
      onClick={() => onClick(appt)}
      className="absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden
                 border border-white/40 shadow-sm hover:brightness-95 transition-all"
      style={{ top, height, backgroundColor: appt.service.color + 'CC' }}
    >
      <p className="text-xs font-semibold text-white leading-tight truncate">
        {format(parseISO(appt.startDateTime), 'HH:mm')} {appt.client.name}
      </p>
      {height > 44 && (
        <p className="text-xs text-white/80 truncate">{appt.service.name}</p>
      )}
    </button>
  );
}

// ─── Painel lateral de detalhes ───────────────────────────────────────────────
interface DetailPanelProps {
  appt:    Appointment | null;
  onClose: () => void;
}

function DetailPanel({ appt, onClose }: DetailPanelProps) {
  const updateStatus = useUpdateAppointmentStatus();
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelInput, setShowCancelInput] = useState(false);

  if (!appt) return null;

  const VALID_TRANSITIONS: Record<string, AppointmentStatus[]> = {
    PENDING:   ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
    COMPLETED: [], CANCELLED: [], NO_SHOW: [],
  };

  const actions = VALID_TRANSITIONS[appt.status] ?? [];

  const actionLabels: Record<AppointmentStatus, string> = {
    CONFIRMED: 'Confirmar',
    COMPLETED: 'Concluir',
    CANCELLED: 'Cancelar',
    NO_SHOW:   'Não compareceu',
    PENDING:   '',
  };

  const actionColors: Record<AppointmentStatus, string> = {
    CONFIRMED: 'bg-blue-600 text-white hover:bg-blue-700',
    COMPLETED: 'bg-emerald-600 text-white hover:bg-emerald-700',
    CANCELLED: 'bg-red-50 text-red-600 hover:bg-red-100',
    NO_SHOW:   'bg-gray-100 text-gray-600 hover:bg-gray-200',
    PENDING:   '',
  };

  function handleAction(status: AppointmentStatus) {
    if (status === 'CANCELLED') { setShowCancelInput(true); return; }
    updateStatus.mutate({ id: appt!.id, status }, { onSuccess: onClose });
  }

  function handleConfirmCancel() {
    updateStatus.mutate(
      { id: appt!.id, status: 'CANCELLED', cancelReason },
      { onSuccess: () => { onClose(); setShowCancelInput(false); } },
    );
  }

  return (
    <div className="absolute inset-y-0 right-0 w-72 bg-white border-l border-gray-100 shadow-xl z-10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800 text-sm">Detalhes</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: appt.service.color }} />
          <div>
            <p className="font-semibold text-gray-800">{appt.service.name}</p>
            <StatusBadge status={appt.status} />
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Horário</p>
          <p className="text-sm text-gray-700">
            {format(parseISO(appt.startDateTime), "dd/MM/yyyy 'das' HH:mm")}
            {' às '}{format(parseISO(appt.endDateTime), 'HH:mm')}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Cliente</p>
          <p className="text-sm font-medium text-gray-700">{appt.client.name}</p>
          <p className="text-xs text-gray-400">{appt.client.email}</p>
          {appt.client.phone && <p className="text-xs text-gray-400">{appt.client.phone}</p>}
        </div>

        {appt.notes && (
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Observações</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{appt.notes}</p>
          </div>
        )}

        {appt.status === 'CANCELLED' && appt.cancelReason && (
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Motivo</p>
            <p className="text-sm text-red-600">{appt.cancelReason}</p>
          </div>
        )}

        {showCancelInput && (
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-medium">Motivo do cancelamento</label>
            <textarea
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none
                         focus:outline-none focus:ring-2 focus:ring-red-300"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Opcional..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleConfirmCancel}
                disabled={updateStatus.isPending}
                className="flex-1 py-2 text-xs font-medium bg-red-600 text-white rounded-lg
                           hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {updateStatus.isPending ? 'Aguarde...' : 'Confirmar cancelamento'}
              </button>
              <button
                onClick={() => setShowCancelInput(false)}
                className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200
                           rounded-lg hover:bg-gray-50 transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>

      {!showCancelInput && actions.length > 0 && (
        <div className="p-4 border-t border-gray-100 space-y-2">
          {actions.map((action) => (
            <button
              key={action}
              onClick={() => handleAction(action)}
              disabled={updateStatus.isPending}
              className={`w-full py-2 text-xs font-semibold rounded-lg transition-colors
                          disabled:opacity-50 ${actionColors[action]}`}
            >
              {actionLabels[action]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal novo agendamento ───────────────────────────────────────────────────
interface NewApptModalProps {
  defaultDate: Date;
  onClose:     () => void;
}

function NewApptModal({ defaultDate, onClose }: NewApptModalProps) {
  // useClientsList retorna Client[] direto (sem paginação) — ideal para selects
  const { data: clients  = [] } = useClientsList();
  const { data: services = [] } = useServices();
  const createAppt = useCreateAppointment();

  const [form, setForm] = useState({
    clientId:      '',
    serviceId:     '',
    startDateTime: format(defaultDate, "yyyy-MM-dd'T'HH:mm"),
    notes:         '',
  });
  const [error, setError] = useState('');

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.clientId || !form.serviceId || !form.startDateTime) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    try {
      await createAppt.mutateAsync({
        clientId:      form.clientId,
        serviceId:     form.serviceId,
        startDateTime: new Date(form.startDateTime).toISOString(),
        notes:         form.notes || undefined,
      });
      onClose();
    } catch {
      setError('Não foi possível criar o agendamento. Verifique conflitos de horário.');
    }
  }

  const activeServices = services.filter((s: { isActive: boolean }) => s.isActive);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Novo Agendamento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
              value={form.clientId}
              onChange={(e) => set('clientId', e.target.value)}
            >
              <option value="">Selecione...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serviço *</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
              value={form.serviceId}
              onChange={(e) => set('serviceId', e.target.value)}
            >
              <option value="">Selecione...</option>
              {activeServices.map((s: { id: string; name: string; durationMinutes: number }) => (
                <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes}min)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora *</label>
            <input
              type="datetime-local"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
              value={form.startDateTime}
              onChange={(e) => set('startDateTime', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Opcional..."
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={createAppt.isPending}
              className="flex-1 py-2.5 bg-[#2E75B6] text-white text-sm font-semibold
                         rounded-lg hover:bg-[#2563a8] disabled:opacity-50 transition-colors"
            >
              {createAppt.isPending ? 'Criando...' : 'Criar Agendamento'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600
                         rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CalendarPage ─────────────────────────────────────────────────────────────
export function CalendarPage() {
  const [view, setView]           = useState<ViewMode>('day');
  const [current, setCurrent]     = useState(new Date());
  const [selected, setSelected]   = useState<Appointment | null>(null);
  const [showModal, setShowModal] = useState(false);

  const rangeStart = view === 'day'
    ? format(current, 'yyyy-MM-dd')
    : format(startOfWeek(current, { locale: ptBR }), 'yyyy-MM-dd');
  const rangeEnd = view === 'day'
    ? format(current, 'yyyy-MM-dd')
    : format(endOfWeek(current, { locale: ptBR }), 'yyyy-MM-dd');

  const { data, isLoading } = useAppointments({
    startDate: rangeStart,
    endDate:   rangeEnd,
    limit:     200,
    refetchInterval: 60_000,
  });

  const appointments = data?.appointments ?? [];

  function prev()    { setCurrent((d) => view === 'day' ? subDays(d, 1) : subDays(d, 7)); }
  function next()    { setCurrent((d) => view === 'day' ? addDays(d, 1) : addDays(d, 7)); }
  function goToday() { setCurrent(new Date()); }

  const periodLabel = view === 'day'
    ? format(current, "EEEE, d 'de' MMMM", { locale: ptBR })
    : (() => {
        const ws = startOfWeek(current, { locale: ptBR });
        const we = endOfWeek(current, { locale: ptBR });
        return `${format(ws, 'd MMM', { locale: ptBR })} – ${format(we, 'd MMM yyyy', { locale: ptBR })}`;
      })();

  const weekDays = useMemo(() => {
    const ws = startOfWeek(current, { locale: ptBR });
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [current]);

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  return (
    <div className="flex flex-col h-full relative">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-100 bg-white flex-shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Hoje
          </button>
          <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
          <h2 className="text-sm font-semibold text-gray-700 ml-1 capitalize">{periodLabel}</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['day', 'week'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                  ${view === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {v === 'day' ? 'Dia' : 'Semana'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2E75B6] text-white
                       text-xs font-semibold rounded-lg hover:bg-[#2563a8] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Novo
          </button>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="flex-1 overflow-hidden relative flex">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-[#2E75B6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : view === 'day' ? (
            <div className="relative" style={{ height: TOTAL_HEIGHT }}>
              {hours.map((h) => (
                <div key={h} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}>
                  <span className="absolute left-2 text-xs text-gray-300 -translate-y-2 select-none">
                    {String(h).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
              <div className="absolute inset-0 ml-14">
                {appointments.map((a) => <ApptBlock key={a.id} appt={a} onClick={setSelected} />)}
              </div>
            </div>
          ) : (
            <div className="flex min-w-0">
              <div className="flex-shrink-0 w-12 relative" style={{ height: TOTAL_HEIGHT }}>
                {hours.map((h) => (
                  <div key={h} className="absolute left-0 right-0" style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}>
                    <span className="text-xs text-gray-300 pl-1 -translate-y-2 block select-none">
                      {String(h).padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-7 border-l border-gray-100">
                {weekDays.map((day) => {
                  const dayAppts = appointments.filter((a) => isSameDay(parseISO(a.startDateTime), day));
                  const isToday_ = isSameDay(day, new Date());
                  return (
                    <div key={day.toISOString()} className="border-r border-gray-100 relative" style={{ height: TOTAL_HEIGHT }}>
                      <div className={`sticky top-0 z-10 text-center py-1 text-xs font-medium ${isToday_ ? 'text-[#2E75B6]' : 'text-gray-400'}`}>
                        {format(day, 'EEE d', { locale: ptBR })}
                      </div>
                      {hours.map((h) => (
                        <div key={h} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: (h - START_HOUR) * HOUR_HEIGHT + 24 }} />
                      ))}
                      <div className="absolute inset-x-0 top-6">
                        {dayAppts.map((a) => <ApptBlock key={a.id} appt={a} onClick={setSelected} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DetailPanel appt={selected} onClose={() => setSelected(null)} />
      </div>

      {showModal && (
        <NewApptModal defaultDate={startOfDay(current)} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
