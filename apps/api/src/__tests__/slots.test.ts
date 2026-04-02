// Testes da lógica de cálculo de slots disponíveis
import {
  computeAvailableSlots,
  timeToMinutes,
  minutesToTime,
  TimeSlot,
} from '../lib/slots';
import { DayOfWeek } from '@agendapro/database';

// ─── helpers ────────────────────────────────────────────────────────────────

// Cria uma segunda-feira em uma data específica
function monday(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day); // mês 0-indexed
}

function makeAvailability(dayOfWeek: DayOfWeek, start: string, end: string) {
  return { dayOfWeek, startTime: start, endTime: end, isActive: true };
}

function makeAppointment(date: Date, startHour: number, endHour: number) {
  const s = new Date(date); s.setHours(startHour, 0, 0, 0);
  const e = new Date(date); e.setHours(endHour, 0, 0, 0);
  return { startDateTime: s, endDateTime: e };
}

function makeBlockedSlot(date: Date, startHour: number, endHour: number) {
  const s = new Date(date); s.setHours(startHour, 0, 0, 0);
  const e = new Date(date); e.setHours(endHour, 0, 0, 0);
  return { startDateTime: s, endDateTime: e };
}

// 2024-01-08 é uma segunda-feira
const MON = monday(2024, 1, 8);

// ─── timeToMinutes ───────────────────────────────────────────────────────────
describe('timeToMinutes', () => {
  it('converte "00:00" para 0',   () => expect(timeToMinutes('00:00')).toBe(0));
  it('converte "01:00" para 60',  () => expect(timeToMinutes('01:00')).toBe(60));
  it('converte "09:30" para 570', () => expect(timeToMinutes('09:30')).toBe(570));
  it('converte "23:59" para 1439',() => expect(timeToMinutes('23:59')).toBe(1439));
});

// ─── minutesToTime ───────────────────────────────────────────────────────────
describe('minutesToTime', () => {
  it('converte 0 para "00:00"',    () => expect(minutesToTime(0)).toBe('00:00'));
  it('converte 60 para "01:00"',   () => expect(minutesToTime(60)).toBe('01:00'));
  it('converte 570 para "09:30"',  () => expect(minutesToTime(570)).toBe('09:30'));
  it('converte 1439 para "23:59"', () => expect(minutesToTime(1439)).toBe('23:59'));
});

// ─── computeAvailableSlots ───────────────────────────────────────────────────
describe('computeAvailableSlots', () => {
  it('retorna array vazio quando não há disponibilidade para o dia', () => {
    const slots = computeAvailableSlots({
      date:            MON,
      durationMin:     60,
      availabilities:  [], // sem disponibilidade
      appointments:    [],
      blockedSlots:    [],
    });
    expect(slots).toHaveLength(0);
  });

  it('retorna array vazio quando disponibilidade está inativa', () => {
    const slots = computeAvailableSlots({
      date:            MON,
      durationMin:     60,
      availabilities:  [{ dayOfWeek: DayOfWeek.MONDAY, startTime: '09:00', endTime: '18:00', isActive: false }],
      appointments:    [],
      blockedSlots:    [],
    });
    expect(slots).toHaveLength(0);
  });

  it('gera slots corretos sem colisões', () => {
    const slots = computeAvailableSlots({
      date:            MON,
      durationMin:     60,
      availabilities:  [makeAvailability(DayOfWeek.MONDAY, '09:00', '12:00')],
      appointments:    [],
      blockedSlots:    [],
    });
    // 09:00–10:00, 10:00–11:00, 11:00–12:00
    expect(slots).toHaveLength(3);
    expect(slots[0]).toEqual({ startTime: '09:00', endTime: '10:00', available: true });
    expect(slots[2]).toEqual({ startTime: '11:00', endTime: '12:00', available: true });
    expect(slots.every((s: TimeSlot) => s.available)).toBe(true);
  });

  it('marca slot como indisponível quando há agendamento na mesma hora', () => {
    const slots = computeAvailableSlots({
      date:            MON,
      durationMin:     60,
      availabilities:  [makeAvailability(DayOfWeek.MONDAY, '09:00', '12:00')],
      appointments:    [makeAppointment(MON, 10, 11)], // bloqueia 10:00–11:00
      blockedSlots:    [],
    });
    expect(slots[0].available).toBe(true);  // 09:00–10:00: livre
    expect(slots[1].available).toBe(false); // 10:00–11:00: ocupado
    expect(slots[2].available).toBe(true);  // 11:00–12:00: livre
  });

  it('marca slot como indisponível quando há BlockedSlot cobrindo o horário', () => {
    const slots = computeAvailableSlots({
      date:            MON,
      durationMin:     60,
      availabilities:  [makeAvailability(DayOfWeek.MONDAY, '09:00', '13:00')],
      appointments:    [],
      blockedSlots:    [makeBlockedSlot(MON, 11, 13)], // bloqueia 11:00–13:00
    });
    expect(slots[0].available).toBe(true);  // 09:00–10:00
    expect(slots[1].available).toBe(true);  // 10:00–11:00
    expect(slots[2].available).toBe(false); // 11:00–12:00: dentro do bloqueio
    expect(slots[3].available).toBe(false); // 12:00–13:00: dentro do bloqueio
  });

  it('detecta colisão parcial (agendamento começa durante o slot)', () => {
    const slots = computeAvailableSlots({
      date:            MON,
      durationMin:     60,
      availabilities:  [makeAvailability(DayOfWeek.MONDAY, '09:00', '12:00')],
      appointments:    [makeAppointment(MON, 9, 10)], // começa às 09:30 teoricamente
      blockedSlots:    [],
    });
    expect(slots[0].available).toBe(false); // 09:00–10:00: colidiu
  });

  it('gera slots de 30 minutos corretamente', () => {
    const slots = computeAvailableSlots({
      date:            MON,
      durationMin:     30,
      availabilities:  [makeAvailability(DayOfWeek.MONDAY, '08:00', '10:00')],
      appointments:    [],
      blockedSlots:    [],
    });
    // 08:00–08:30, 08:30–09:00, 09:00–09:30, 09:30–10:00
    expect(slots).toHaveLength(4);
    expect(slots[1].startTime).toBe('08:30');
  });

  it('retorna vazio para dia diferente do que tem disponibilidade', () => {
    // MON = segunda, colocamos disponibilidade apenas na terça
    const slots = computeAvailableSlots({
      date:            MON,
      durationMin:     60,
      availabilities:  [makeAvailability(DayOfWeek.TUESDAY, '09:00', '18:00')],
      appointments:    [],
      blockedSlots:    [],
    });
    expect(slots).toHaveLength(0);
  });
});
