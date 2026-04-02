// Lógica de cálculo de slots disponíveis (função pura — testável isoladamente)
import { Availability, Appointment, BlockedSlot, DayOfWeek } from '@agendapro/database';

export interface TimeSlot {
  startTime: string;  // "HH:mm"
  endTime:   string;  // "HH:mm"
  available: boolean;
}

// Converte "HH:mm" para minutos desde meia-noite
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Converte minutos desde meia-noite para "HH:mm"
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Mapeamento: número do JS (0=dom) → enum DayOfWeek
const JS_DAY_TO_ENUM: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

export interface ComputeSlotsParams {
  date:          Date;
  durationMin:   number;
  availabilities: Pick<Availability, 'dayOfWeek' | 'startTime' | 'endTime' | 'isActive'>[];
  appointments:   Pick<Appointment,  'startDateTime' | 'endDateTime'>[];
  blockedSlots:   Pick<BlockedSlot,  'startDateTime' | 'endDateTime'>[];
}

/**
 * Calcula todos os slots de tempo para uma data, marcando quais estão disponíveis.
 * - Divide a disponibilidade do dia em fatias pela duração do serviço.
 * - Remove slots que colidem com agendamentos confirmados ou horários bloqueados.
 */
export function computeAvailableSlots(params: ComputeSlotsParams): TimeSlot[] {
  const { date, durationMin, availabilities, appointments, blockedSlots } = params;

  const dayOfWeek = JS_DAY_TO_ENUM[date.getDay()];

  // Disponibilidade ativa para o dia da semana
  const dayAvailability = availabilities.find(
    (a) => a.dayOfWeek === dayOfWeek && a.isActive
  );

  if (!dayAvailability) return [];

  const startMin = timeToMinutes(dayAvailability.startTime);
  const endMin   = timeToMinutes(dayAvailability.endTime);
  const slots:   TimeSlot[] = [];

  // Gera todos os slots em sequência
  for (let t = startMin; t + durationMin <= endMin; t += durationMin) {
    const slotStart = minutesToTime(t);
    const slotEnd   = minutesToTime(t + durationMin);

    // Verifica colisão com agendamentos
    const slotStartMs = dateAtTime(date, slotStart).getTime();
    const slotEndMs   = dateAtTime(date, slotEnd).getTime();

    const blockedByAppointment = appointments.some((appt) => {
      const apptStart = new Date(appt.startDateTime).getTime();
      const apptEnd   = new Date(appt.endDateTime).getTime();
      // Colisão: os intervalos se sobrepõem
      return slotStartMs < apptEnd && slotEndMs > apptStart;
    });

    const blockedBySlot = blockedSlots.some((bs) => {
      const bsStart = new Date(bs.startDateTime).getTime();
      const bsEnd   = new Date(bs.endDateTime).getTime();
      return slotStartMs < bsEnd && slotEndMs > bsStart;
    });

    slots.push({
      startTime: slotStart,
      endTime:   slotEnd,
      available: !blockedByAppointment && !blockedBySlot,
    });
  }

  return slots;
}

// Helper: retorna Date com a hora de "HH:mm" aplicada na data fornecida
function dateAtTime(date: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}
