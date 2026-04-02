// Rotas de agendamentos — todas protegidas por autenticação
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { parseISO, startOfDay, endOfDay, addMinutes, isAfter } from 'date-fns';
import { AppointmentStatus } from '@agendapro/database';
import { prisma }         from '../lib/prisma';
import { validateToken }  from '../middlewares/auth.middleware';
import {
  sendAppointmentConfirmation,
  sendAppointmentCancelled,
} from '../services/email.service';

export const appointmentsRouter = Router();
appointmentsRouter.use(validateToken);

// Campos comuns de retorno (incluir em todos os findMany)
const APPOINTMENT_INCLUDE = {
  client:  { select: { id: true, name: true, email: true, phone: true } },
  service: { select: { id: true, name: true, durationMinutes: true, price: true, color: true } },
} as const;

// Transições de status permitidas
const VALID_TRANSITIONS: Record<string, AppointmentStatus[]> = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW:   [],
};

// ── GET /appointments ─────────────────────────────────────────────────────────
// Query: startDate, endDate (YYYY-MM-DD), status, clientId, page, limit
appointmentsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const { startDate, endDate, status, clientId } = req.query;
  const page  = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip  = (page - 1) * limit;

  const where: any = { professionalId: req.user!.id };

  if (startDate && endDate) {
    where.startDateTime = {
      gte: startOfDay(parseISO(startDate as string)),
      lte: endOfDay(parseISO(endDate as string)),
    };
  }
  if (status)   where.status   = status;
  if (clientId) where.clientId = clientId;

  const [appointments, total] = await prisma.$transaction([
    prisma.appointment.findMany({
      where,
      include:  APPOINTMENT_INCLUDE,
      orderBy:  { startDateTime: 'asc' },
      skip,
      take: limit,
    }),
    prisma.appointment.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      appointments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ── GET /appointments/today ───────────────────────────────────────────────────
appointmentsRouter.get('/today', async (req: Request, res: Response): Promise<void> => {
  const professionalId = req.user!.id;
  const todayStart = startOfDay(new Date());
  const todayEnd   = endOfDay(new Date());

  const appointments = await prisma.appointment.findMany({
    where: {
      professionalId,
      startDateTime: { gte: todayStart, lte: todayEnd },
    },
    include:  APPOINTMENT_INCLUDE,
    orderBy:  { startDateTime: 'asc' },
  });

  const totalToday     = appointments.length;
  const completedToday = appointments.filter((a) => a.status === 'COMPLETED').length;
  const pendingToday   = appointments.filter((a) => a.status === 'PENDING').length;

  res.json({
    success: true,
    data: { appointments, totalToday, completedToday, pendingToday },
  });
});

// ── GET /appointments/:id ─────────────────────────────────────────────────────
appointmentsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const appointment = await prisma.appointment.findFirst({
    where: { id: req.params.id, professionalId: req.user!.id },
    include: APPOINTMENT_INCLUDE,
  });

  if (!appointment) {
    res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    return;
  }

  res.json({ success: true, data: appointment });
});

// ── PATCH /appointments/:id/status ────────────────────────────────────────────
const statusSchema = z.object({
  status:       z.nativeEnum(AppointmentStatus),
  cancelReason: z.string().max(300).optional(),
});

appointmentsRouter.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const existing = await prisma.appointment.findFirst({
    where: { id: req.params.id, professionalId: req.user!.id },
  });

  if (!existing) {
    res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    return;
  }

  const { status: newStatus, cancelReason } = parsed.data;
  const allowed = VALID_TRANSITIONS[existing.status] ?? [];

  if (!allowed.includes(newStatus)) {
    res.status(422).json({
      success: false,
      error: `Transição inválida: ${existing.status} → ${newStatus}`,
    });
    return;
  }

  const appointment = await prisma.appointment.update({
    where: { id: req.params.id },
    data: {
      status: newStatus,
      ...(newStatus === 'CANCELLED' ? {
        cancelReason:  cancelReason ?? null,
        cancelledAt:   new Date(),
      } : {}),
    },
    include: APPOINTMENT_INCLUDE,
  });

  // Notifica o cliente em caso de cancelamento
  if (newStatus === 'CANCELLED') {
    sendAppointmentCancelled({
      appointmentId:    appointment.id,
      clientName:       appointment.client.name,
      clientEmail:      appointment.client.email,
      professionalName: req.user!.name,
      serviceName:      appointment.service.name,
      servicePrice:     appointment.service.price,
      startDateTime:    appointment.startDateTime,
      endDateTime:      appointment.endDateTime,
      cancelReason:     cancelReason,
    });
  }

  res.json({ success: true, data: appointment });
});

// ── POST /appointments (criação manual pelo profissional) ─────────────────────
const createSchema = z.object({
  serviceId:     z.string().min(1),
  clientId:      z.string().min(1),
  startDateTime: z.string().datetime({ message: 'Data/hora inválida. Use ISO 8601' }),
  notes:         z.string().max(500).optional(),
});

appointmentsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { serviceId, clientId, startDateTime: startStr, notes } = parsed.data;
  const startDateTime = new Date(startStr);

  if (!isAfter(startDateTime, new Date())) {
    res.status(400).json({ success: false, error: 'Data/hora já passou' });
    return;
  }

  const professionalId = req.user!.id;

  // Valida que serviço e cliente pertencem ao profissional
  const [service, client] = await Promise.all([
    prisma.service.findFirst({ where: { id: serviceId, professionalId, isActive: true } }),
    prisma.client.findFirst({ where: { id: clientId,  professionalId } }),
  ]);

  if (!service) {
    res.status(404).json({ success: false, error: 'Serviço não encontrado' });
    return;
  }
  if (!client) {
    res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    return;
  }

  const endDateTime = addMinutes(startDateTime, service.durationMinutes);

  // Verifica conflito de horário
  const conflict = await prisma.appointment.findFirst({
    where: {
      professionalId,
      status:        { in: ['CONFIRMED', 'PENDING'] },
      startDateTime: { lt: endDateTime },
      endDateTime:   { gt: startDateTime },
    },
  });

  if (conflict) {
    res.status(409).json({
      success: false,
      error:   'Já existe um agendamento nesse horário',
    });
    return;
  }

  const appointment = await prisma.appointment.create({
    data: { professionalId, serviceId, clientId, startDateTime, endDateTime, notes, status: 'CONFIRMED' },
    include: APPOINTMENT_INCLUDE,
  });

  // Envia confirmação ao cliente
  sendAppointmentConfirmation({
    appointmentId:    appointment.id,
    clientName:       appointment.client.name,
    clientEmail:      appointment.client.email,
    professionalName: req.user!.name,
    serviceName:      appointment.service.name,
    servicePrice:     appointment.service.price,
    startDateTime:    appointment.startDateTime,
    endDateTime:      appointment.endDateTime,
  });

  res.status(201).json({ success: true, data: appointment });
});
