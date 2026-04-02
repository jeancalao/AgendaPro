// Hook com react-query para gerenciar serviços
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface Service {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  color: string;
  isActive: boolean;
}

export interface ServiceInput {
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  color: string;
}

const QUERY_KEY = ['services'];

export function useServices() {
  return useQuery<Service[]>({
    queryKey: QUERY_KEY,
    queryFn:  async () => {
      const { data } = await api.get('/services');
      return data.data;
    },
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceInput) => api.post('/services', input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ServiceInput & { id: string }) =>
      api.put(`/services/${id}`, input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/services/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useToggleService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/services/${id}/toggle`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
