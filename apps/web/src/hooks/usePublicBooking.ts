// Hook para chamadas à API pública de agendamento (sem autenticação)
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

// Cliente sem interceptors de auth (público)
const publicApi = axios.create({ baseURL: '/api/v1/public' });

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface PublicService {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  color: string;
}

export interface PublicProfessional {
  name: string;
  bio?: string;
  avatarUrl?: string;
  timezone: string;
}

export type DayOfWeek =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY'
  | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface PublicProfile {
  professional: PublicProfessional;
  services:     PublicService[];
  availableDays: DayOfWeek[];
}

export interface TimeSlot {
  startTime: string; // "HH:mm"
  endTime:   string; // "HH:mm"
  available: boolean;
}

export interface BookingInput {
  serviceId:   string;
  date:        string;   // "YYYY-MM-DD"
  startTime:   string;   // "HH:mm"
  clientName:  string;
  clientEmail: string;
  clientPhone: string;
}

export interface BookingResult {
  appointment: {
    id:            string;
    startDateTime: string;
    endDateTime:   string;
    status:        string;
    service:       { name: string; durationMinutes: number; price: number };
    professional:  { name: string };
  };
  confirmationCode:  string;
  googleCalendarUrl: string;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function usePublicProfile(slug: string) {
  return useQuery<PublicProfile>({
    queryKey: ['public-profile', slug],
    queryFn:  async () => {
      const { data } = await publicApi.get(`/${slug}`);
      return data.data;
    },
    retry: 1,
  });
}

export function usePublicSlots(slug: string, serviceId: string | null, date: string | null) {
  return useQuery<TimeSlot[]>({
    queryKey: ['public-slots', slug, serviceId, date],
    queryFn:  async () => {
      const { data } = await publicApi.get(`/${slug}/slots`, {
        params: { serviceId, date },
      });
      return data.data;
    },
    enabled: !!(serviceId && date), // só busca quando ambos estão selecionados
    staleTime: 30_000,              // 30s — slots podem ser tomados
  });
}

export function useCreateBooking(slug: string) {
  return useMutation<BookingResult, Error, BookingInput>({
    mutationFn: async (input) => {
      const { data } = await publicApi.post(`/${slug}/appointments`, input);
      return data.data;
    },
  });
}
