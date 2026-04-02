// Hook para gerenciamento de agendamentos com polling automático
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface AppointmentClient {
  id: string; name: string; email: string; phone?: string;
}
export interface AppointmentService {
  id: string; name: string; durationMinutes: number; price: number; color: string;
}
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface Appointment {
  id: string;
  startDateTime: string;
  endDateTime:   string;
  status:        AppointmentStatus;
  notes?:        string;
  cancelReason?: string;
  cancelledAt?:  string;
  client:        AppointmentClient;
  service:       AppointmentService;
}

export interface AppointmentsResponse {
  appointments: Appointment[];
  total:        number;
  page:         number;
  totalPages:   number;
}

interface UseAppointmentsParams {
  startDate?:       string;
  endDate?:         string;
  status?:          AppointmentStatus | '';
  clientId?:        string;
  page?:            number;
  limit?:           number;
  refetchInterval?: number;
}

const BASE_KEY = 'appointments';

export function useAppointments(params: UseAppointmentsParams = {}) {
  const { startDate, endDate, status, clientId, page = 1, limit = 20, refetchInterval } = params;

  return useQuery<AppointmentsResponse>({
    queryKey:       [BASE_KEY, { startDate, endDate, status, clientId, page, limit }],
    queryFn:        async () => {
      const { data } = await api.get('/appointments', {
        params: { startDate, endDate, status: status || undefined, clientId, page, limit },
      });
      return data.data;
    },
    refetchInterval,
  });
}

export function useAppointmentsToday(refetchInterval = 60_000) {
  return useQuery<{
    appointments:   Appointment[];
    totalToday:     number;
    completedToday: number;
    pendingToday:   number;
  }>({
    queryKey:       [BASE_KEY, 'today'],
    queryFn:        async () => {
      const { data } = await api.get('/appointments/today');
      return data.data;
    },
    refetchInterval,
  });
}

// Mutação: atualiza status de um agendamento
export function useUpdateAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, cancelReason }: {
      id: string; status: AppointmentStatus; cancelReason?: string;
    }) => api.patch(`/appointments/${id}/status`, { status, cancelReason }),
    onSuccess: () => {
      // Invalida todas as queries de agendamentos e dashboard
      qc.invalidateQueries({ queryKey: [BASE_KEY] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

// Mutação: cria agendamento manual pelo profissional
export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      serviceId: string; clientId: string; startDateTime: string; notes?: string;
    }) => api.post('/appointments', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BASE_KEY] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}
