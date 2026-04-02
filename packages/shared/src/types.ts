// Tipos TypeScript compartilhados entre frontend e backend

// Profissões suportadas
export type ProfessionType =
  | 'personal_trainer'
  | 'psychologist'
  | 'nutritionist'
  | 'physiotherapist'
  | 'coach'
  | 'other';

// Status do agendamento
export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

// Resposta padrão da API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Resposta paginada
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// DTOs do Profissional
export interface ProfessionalDto {
  id: string;
  name: string;
  email: string;
  phone?: string;
  profession: ProfessionType;
  bio?: string;
  avatarUrl?: string;
  slug: string;
  timezone: string;
}

// DTOs do Serviço
export interface ServiceDto {
  id: string;
  professionalId: string;
  name: string;
  description?: string;
  durationMin: number;
  price: number; // em centavos
  active: boolean;
}

// DTOs do Cliente
export interface ClientDto {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

// DTOs do Agendamento
export interface AppointmentDto {
  id: string;
  professionalId: string;
  client: ClientDto;
  service: ServiceDto;
  startsAt: string; // ISO 8601
  endsAt: string;   // ISO 8601
  status: AppointmentStatus;
  notes?: string;
}

// Slot de horário disponível
export interface TimeSlot {
  startsAt: string; // ISO 8601
  endsAt: string;   // ISO 8601
  available: boolean;
}
