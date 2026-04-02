// Hook com react-query para gerenciar disponibilidade semanal
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface AvailabilityEntry {
  id?: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime:   string;
  isActive:  boolean;
}

const QUERY_KEY = ['availability'];

export function useAvailability() {
  return useQuery<AvailabilityEntry[]>({
    queryKey: QUERY_KEY,
    queryFn:  async () => {
      const { data } = await api.get('/availability');
      return data.data;
    },
  });
}

export function useSaveAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: Omit<AvailabilityEntry, 'id'>[]) =>
      api.put('/availability', entries),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
