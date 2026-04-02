// Hook para o resumo mensal do dashboard com polling
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Appointment } from './useAppointments';

export interface DashboardSummary {
  totalAppointments:     number;
  completedAppointments: number;
  cancelledAppointments: number;
  totalRevenue:          number;
  upcomingToday:         number;
  todayAppointments:     Appointment[];
  newClients:            number;
  pendingTotal:          number;  // para o badge de atenção no sidebar
}

export function useDashboardSummary(refetchInterval = 60_000) {
  return useQuery<DashboardSummary>({
    queryKey:       ['dashboard-summary'],
    queryFn:        async () => {
      const { data } = await api.get('/dashboard/summary');
      return data.data;
    },
    refetchInterval,
  });
}
