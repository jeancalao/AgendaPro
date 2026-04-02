// Hook para listagem, perfil, criação, edição e remoção de clientes
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface ClientLastAppointment {
  startDateTime: string;
  status:        string;
  service:       { name: string };
}

export interface Client {
  id:                string;
  name:              string;
  email:             string;
  phone?:            string;
  notes?:            string;
  createdAt:         string;
  totalAppointments: number;
  lastAppointment:   ClientLastAppointment | null;
}

export interface ClientAppointment {
  id:            string;
  startDateTime: string;
  endDateTime:   string;
  status:        string;
  notes?:        string;
  cancelReason?: string;
  service: {
    id:              string;
    name:            string;
    price:           number;
    color:           string;
    durationMinutes: number;
  };
}

export interface ClientStats {
  totalSessions:     number;
  completedSessions: number;
  cancelledSessions: number;
  noShowSessions:    number;
  attendanceRate:    number;
  cancellationRate:  number;
  totalRevenue:      number;
}

export interface ClientProfile {
  id:           string;
  name:         string;
  email:        string;
  phone?:       string;
  notes?:       string;
  createdAt:    string;
  appointments: ClientAppointment[];
  stats:        ClientStats;
}

export interface ClientsResponse {
  data: Client[];
  meta: { total: number; page: number; totalPages: number };
}

// ─── useClients — lista paginada ──────────────────────────────────────────────
export function useClients(params: { q?: string; page?: number; limit?: number } = {}) {
  const { q, page = 1, limit = 20 } = params;
  return useQuery<ClientsResponse>({
    queryKey: ['clients', { q, page, limit }],
    queryFn:  async () => {
      const { data } = await api.get('/clients', {
        params: { q: q || undefined, page, limit },
      });
      return { data: data.data, meta: data.meta };
    },
  });
}

// ─── useClientsList — array plano para dropdowns/selects ─────────────────────
export function useClientsList(search?: string) {
  return useQuery<Client[]>({
    queryKey: ['clients-list', search],
    queryFn:  async () => {
      const { data } = await api.get('/clients', {
        params: { q: search || undefined, limit: 100 },
      });
      return data.data;
    },
  });
}

// ─── useClientProfile — perfil completo + histórico + stats ──────────────────
export function useClientProfile(id: string | undefined) {
  return useQuery<ClientProfile>({
    queryKey: ['clients', id],
    queryFn:  async () => {
      const { data } = await api.get(`/clients/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

// ─── useCreateClient ──────────────────────────────────────────────────────────
export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; phone?: string; notes?: string }) =>
      api.post('/clients', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

// ─── useUpdateClient ──────────────────────────────────────────────────────────
export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id:     string;
      name?:  string;
      email?: string;
      phone?: string | null;
      notes?: string | null;
    }) => api.put(`/clients/${id}`, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['clients', id] });
    },
  });
}

// ─── useDeleteClient ──────────────────────────────────────────────────────────
export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}
