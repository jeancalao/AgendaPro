// Testes das rotas públicas — foco no double booking e validações
import request from 'supertest';
import express from 'express';
import { publicRouter } from '../routes/public.routes';

// Mocks
jest.mock('../lib/prisma', () => ({
  prisma: {
    professional: { findUnique: jest.fn(), findFirst: jest.fn() },
    service:      { findFirst:  jest.fn() },
    availability: { findMany:   jest.fn() },
    appointment:  { findMany:   jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    blockedSlot:  { findMany:   jest.fn() },
    client:       { upsert:     jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '../lib/prisma';

const mockProfFindUnique  = prisma.professional.findUnique as jest.Mock;
const mockServiceFindFirst = prisma.service.findFirst as jest.Mock;
const mockTransaction     = prisma.$transaction as jest.Mock;
const mockAvailFindMany   = prisma.availability.findMany as jest.Mock;
const mockApptFindMany    = prisma.appointment.findMany as jest.Mock;
const mockBlockFindMany   = prisma.blockedSlot.findMany as jest.Mock;

// Dados de exemplo
const PROFESSIONAL = { id: 'prof-1', isActive: true };
const SERVICE      = { id: 'svc-1', durationMinutes: 60, name: 'Avaliação', price: 150.00 };
// Data futura fixa para os testes (sempre no futuro)
const FUTURE_DATE  = '2099-06-10'; // terça-feira

const app = express();
app.use(express.json());
app.use('/public', publicRouter);

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /public/:slug', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna 404 quando slug não encontrado', async () => {
    mockProfFindUnique.mockResolvedValue(null);
    const res = await request(app).get('/public/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('retorna 404 quando profissional está inativo', async () => {
    mockProfFindUnique.mockResolvedValue({ ...PROFESSIONAL, isActive: false });
    const res = await request(app).get('/public/joao-silva');
    expect(res.status).toBe(404);
  });

  it('retorna perfil público com serviços e dias disponíveis', async () => {
    mockProfFindUnique.mockResolvedValue({
      ...PROFESSIONAL,
      name: 'João Silva', bio: 'Personal trainer', avatarUrl: null,
      timezone: 'America/Sao_Paulo', isActive: true,
      services:       [{ id: 'svc-1', name: 'Avaliação', durationMinutes: 60, price: 150, color: '#2E75B6', description: null }],
      availabilities: [{ dayOfWeek: 'MONDAY' }, { dayOfWeek: 'WEDNESDAY' }],
    });
    const res = await request(app).get('/public/joao-silva');
    expect(res.status).toBe(200);
    expect(res.body.data.professional.name).toBe('João Silva');
    expect(res.body.data.services).toHaveLength(1);
    expect(res.body.data.availableDays).toContain('MONDAY');
    expect(res.body.data.availableDays).toContain('WEDNESDAY');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /public/:slug/slots', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna 400 sem parâmetros obrigatórios', async () => {
    const res = await request(app).get('/public/joao-silva/slots');
    expect(res.status).toBe(400);
  });

  it('retorna 400 para data no passado', async () => {
    const res = await request(app)
      .get('/public/joao-silva/slots?serviceId=svc-1&date=2000-01-01');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/passad/i);
  });

  it('retorna 400 para formato de data inválido', async () => {
    const res = await request(app)
      .get('/public/joao-silva/slots?serviceId=svc-1&date=10-06-2099');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/formato/i);
  });

  it('retorna slots disponíveis para data válida', async () => {
    mockProfFindUnique.mockResolvedValue(PROFESSIONAL);
    mockServiceFindFirst.mockResolvedValue(SERVICE);
    // Disponibilidade para todos os dias da semana (independe do dia que FUTURE_DATE cai)
    const allDays = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];
    mockAvailFindMany.mockResolvedValue(
      allDays.map((dayOfWeek) => ({ dayOfWeek, startTime: '09:00', endTime: '11:00', isActive: true }))
    );
    mockApptFindMany.mockResolvedValue([]);
    mockBlockFindMany.mockResolvedValue([]);

    const res = await request(app)
      .get(`/public/joao-silva/slots?serviceId=svc-1&date=${FUTURE_DATE}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data[0]).toHaveProperty('startTime');
    expect(res.body.data[0]).toHaveProperty('available');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /public/:slug/appointments', () => {
  const validBody = {
    serviceId:   'svc-1',
    date:        FUTURE_DATE,
    startTime:   '09:00',
    clientName:  'Maria Silva',
    clientEmail: 'maria@email.com',
    clientPhone: '(11) 99999-9999',
  };

  beforeEach(() => jest.clearAllMocks());

  it('retorna 400 com campos obrigatórios faltando', async () => {
    const res = await request(app).post('/public/joao-silva/appointments')
      .send({ serviceId: 'svc-1' }); // sem date, startTime, clientName, etc.
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('retorna 400 com e-mail inválido', async () => {
    const res = await request(app).post('/public/joao-silva/appointments')
      .send({ ...validBody, clientEmail: 'email-invalido' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/e-mail/i);
  });

  it('retorna 400 para data no passado', async () => {
    const res = await request(app).post('/public/joao-silva/appointments')
      .send({ ...validBody, date: '2000-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/passad/i);
  });

  it('retorna 404 quando profissional não encontrado', async () => {
    mockProfFindUnique.mockResolvedValue(null);
    const res = await request(app).post('/public/joao-silva/appointments')
      .send(validBody);
    expect(res.status).toBe(404);
  });

  it('retorna 409 quando slot foi tomado (double booking)', async () => {
    mockProfFindUnique.mockResolvedValue(PROFESSIONAL);
    mockServiceFindFirst.mockResolvedValue(SERVICE);
    // Simula a transação lançando o erro de SLOT_TAKEN
    mockTransaction.mockImplementation(async (fn: Function) => {
      throw new Error('SLOT_TAKEN');
    });

    const res = await request(app).post('/public/joao-silva/appointments')
      .send(validBody);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/horário foi reservado/i);
  });

  it('retorna 201 com confirmationCode no agendamento bem-sucedido', async () => {
    mockProfFindUnique.mockResolvedValue(PROFESSIONAL);
    mockServiceFindFirst.mockResolvedValue(SERVICE);

    const fakeAppointment = {
      id:            'cuid1234abcd5678',
      startDateTime: new Date(`${FUTURE_DATE}T09:00:00`),
      endDateTime:   new Date(`${FUTURE_DATE}T10:00:00`),
      status:        'CONFIRMED',
      service:       { name: 'Avaliação', durationMinutes: 60, price: 150 },
      professional:  { name: 'João Silva' },
    };

    mockTransaction.mockImplementation(async (fn: Function) => fn({
      appointment: { findFirst: jest.fn().mockResolvedValue(null) },
      availability: { findMany: jest.fn().mockResolvedValue([
        { dayOfWeek: 'TUESDAY', startTime: '09:00', endTime: '18:00', isActive: true },
      ]) },
      client:      { upsert: jest.fn().mockResolvedValue({ id: 'client-1' }) },
      appointment2: { create: jest.fn().mockResolvedValue(fakeAppointment) },
    }));

    // A transação mock retorna o fakeAppointment diretamente
    mockTransaction.mockResolvedValue(fakeAppointment);

    const res = await request(app).post('/public/joao-silva/appointments')
      .send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.data.confirmationCode).toBeDefined();
    expect(res.body.data.confirmationCode).toHaveLength(8);
    expect(res.body.data.googleCalendarUrl).toContain('calendar.google.com');
  });
});
