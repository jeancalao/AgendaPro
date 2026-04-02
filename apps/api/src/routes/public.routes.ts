// Rotas públicas — acessíveis sem autenticação
// São usadas pela página de agendamento do cliente final
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { addMinutes, isAfter, startOfDay, parseISO, format } from 'date-fns';
import { prisma } from '../lib/prisma';
import { computeAvailableSlots } from '../lib/slots';
import {
  sendAppointmentConfirmation,
  sendAppointmentCancelled,
  generateCancelToken,
} from '../services/email.service';

export const publicRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /public/:slug
// Retorna perfil público do profissional + serviços ativos + dias disponíveis
// ─────────────────────────────────────────────────────────────────────────────
publicRouter.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;

  const professional = await prisma.professional.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      bio: true,
      avatarUrl: true,
      timezone: true,
      isActive: true,
      services: {
        where:   { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, name: true, description: true,
          durationMinutes: true, price: true, color: true,
        },
      },
      availabilities: {
        where:   { isActive: true },
        select:  { dayOfWeek: true },
      },
    },
  });

  if (!professional || !professional.isActive) {
    res.status(404).json({
      success: false,
      error: 'Profissional não encontrado. Verifique o link e tente novamente.',
    });
    return;
  }

  // Lista de dias da semana com disponibilidade (para highlight no calendário)
  const availableDays = [...new Set(professional.availabilities.map((a) => a.dayOfWeek))];

  res.json({
    success: true,
    data: {
      professional: {
        name:      professional.name,
        bio:       professional.bio,
        avatarUrl: professional.avatarUrl,
        timezone:  professional.timezone,
      },
      services:      professional.services,
      availableDays,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /public/:slug/slots?serviceId=X&date=YYYY-MM-DD
// Retorna slots disponíveis para um serviço em uma data específica
// ─────────────────────────────────────────────────────────────────────────────
publicRouter.get('/:slug/slots', async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const { serviceId, date: dateStr } = req.query;

  if (!serviceId || !dateStr) {
    res.status(400).json({ success: false, error: 'Parâmetros serviceId e date são obrigatórios' });
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr as string)) {
    res.status(400).json({ success: false, error: 'Formato de data inválido. Use YYYY-MM-DD' });
    return;
  }

  // Valida que a data não é no passado
  const requestedDate = parseISO(dateStr as string);
  const today         = startOfDay(new Date());

  if (!isAfter(requestedDate, today) && requestedDate.getTime() !== today.getTime()) {
    res.status(400).json({ success: false, error: 'Não é possível agendar em datas passadas' });
    return;
  }

  const professional = await prisma.professional.findUnique({
    where: { slug, isActive: true },
    select: { id: true },
  });

  if (!professional) {
    res.status(404).json({ success: false, error: 'Profissional não encontrado' });
    return;
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId as string, professionalId: professional.id, isActive: true },
  });

  if (!service) {
    res.status(404).json({ success: false, error: 'Serviço não encontrado' });
    return;
  }

  const dayStart = new Date(requestedDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(requestedDate); dayEnd.setHours(23, 59, 59, 999);

  const [availabilities, appointments, blockedSlots] = await Promise.all([
    prisma.availability.findMany({ where: { professionalId: professional.id } }),
    prisma.appointment.findMany({
      where: {
        professionalId: professional.id,
        startDateTime:  { gte: dayStart },
        endDateTime:    { lte: dayEnd },
        status:         { in: ['CONFIRMED', 'PENDING'] },
      },
    }),
    prisma.blockedSlot.findMany({
      where: {
        professionalId: professional.id,
        startDateTime:  { lt: dayEnd },
        endDateTime:    { gt: dayStart },
      },
    }),
  ]);

  const slots = computeAvailableSlots({
    date:           requestedDate,
    durationMin:    service.durationMinutes,
    availabilities,
    appointments,
    blockedSlots,
  });

  res.json({ success: true, data: slots });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /public/:slug/appointments
// Cria um agendamento sem necessidade de autenticação
// Previne double booking com transação atômica
// ─────────────────────────────────────────────────────────────────────────────
const appointmentSchema = z.object({
  serviceId:   z.string().min(1, 'Serviço obrigatório'),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use YYYY-MM-DD'),
  startTime:   z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido. Use HH:mm'),
  clientName:  z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  clientEmail: z.string().email('E-mail inválido'),
  clientPhone: z
    .string()
    .min(10, 'Telefone inválido')
    .max(20)
    .regex(/^[\d\s()\-+]+$/, 'Telefone com caracteres inválidos'),
});

publicRouter.post('/:slug/appointments', async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;

  const parsed = appointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { serviceId, date: dateStr, startTime, clientName, clientEmail, clientPhone } = parsed.data;

  // Valida data não é no passado
  const requestedDate = parseISO(dateStr);
  const today         = startOfDay(new Date());
  if (!isAfter(requestedDate, today) && requestedDate.getTime() !== today.getTime()) {
    res.status(400).json({ success: false, error: 'Não é possível agendar em datas passadas' });
    return;
  }

  const professional = await prisma.professional.findUnique({
    where: { slug, isActive: true },
    select: { id: true },
  });

  if (!professional) {
    res.status(404).json({ success: false, error: 'Profissional não encontrado' });
    return;
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, professionalId: professional.id, isActive: true },
  });

  if (!service) {
    res.status(404).json({ success: false, error: 'Serviço não encontrado ou inativo' });
    return;
  }

  // Calcula startDateTime e endDateTime a partir da data + horário
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const startDateTime = new Date(requestedDate);
  startDateTime.setHours(startHour, startMinute, 0, 0);
  const endDateTime = addMinutes(startDateTime, service.durationMinutes);

  // Previne agendamento no passado (data OK mas hora no passado)
  if (!isAfter(startDateTime, new Date())) {
    res.status(400).json({ success: false, error: 'Horário selecionado já passou' });
    return;
  }

  try {
    // Transação atômica: verifica disponibilidade + cria agendamento
    const appointment = await prisma.$transaction(async (tx) => {
      // Lock otimista: revalida se o slot ainda está disponível
      const conflict = await tx.appointment.findFirst({
        where: {
          professionalId: professional.id,
          status:         { in: ['CONFIRMED', 'PENDING'] },
          // Colisão: intervalos se sobrepõem
          startDateTime:  { lt: endDateTime },
          endDateTime:    { gt: startDateTime },
        },
      });

      if (conflict) {
        throw new Error('SLOT_TAKEN');
      }

      // Verifica se o horário está dentro da disponibilidade configurada
      const dayAvailabilities = await tx.availability.findMany({
        where: { professionalId: professional.id, isActive: true },
      });

      const slots = computeAvailableSlots({
        date:           requestedDate,
        durationMin:    service.durationMinutes,
        availabilities: dayAvailabilities,
        appointments:   [], // já verificado acima com o conflict check
        blockedSlots:   [],
      });

      const slotExists = slots.some((s) => s.startTime === startTime && s.available);
      if (!slotExists) {
        throw new Error('SLOT_UNAVAILABLE');
      }

      // Upsert do cliente pelo email (cria se não existir, mantém existente)
      const client = await tx.client.upsert({
        where:  { professionalId_email: { professionalId: professional.id, email: clientEmail } },
        update: { name: clientName, phone: clientPhone },
        create: {
          professionalId: professional.id,
          name:           clientName,
          email:          clientEmail,
          phone:          clientPhone,
        },
      });

      // Cria o agendamento
      return tx.appointment.create({
        data: {
          professionalId: professional.id,
          serviceId:      service.id,
          clientId:       client.id,
          startDateTime,
          endDateTime,
          status:         'CONFIRMED',
        },
        include: {
          service:      { select: { name: true, durationMinutes: true, price: true } },
          professional: { select: { name: true } },
        },
      });
    });

    // Código de confirmação: últimos 8 caracteres do ID em maiúsculas
    const confirmationCode = appointment.id.slice(-8).toUpperCase();

    // Link para o Google Agenda
    const googleCalendarUrl = buildGoogleCalendarUrl({
      title:      `${appointment.service.name} com ${appointment.professional.name}`,
      start:      startDateTime,
      end:        endDateTime,
      description: `Agendamento confirmado. Código: ${confirmationCode}`,
    });

    // Envia e-mail de confirmação (não bloqueia a resposta)
    sendAppointmentConfirmation({
      appointmentId:    appointment.id,
      clientName,
      clientEmail,
      professionalName: appointment.professional.name,
      serviceName:      appointment.service.name,
      servicePrice:     appointment.service.price,
      startDateTime:    appointment.startDateTime,
      endDateTime:      appointment.endDateTime,
    });

    res.status(201).json({
      success: true,
      data: {
        appointment: {
          id:             appointment.id,
          startDateTime:  appointment.startDateTime,
          endDateTime:    appointment.endDateTime,
          status:         appointment.status,
          service:        appointment.service,
          professional:   appointment.professional,
        },
        confirmationCode,
        googleCalendarUrl,
      },
    });
  } catch (err: any) {
    if (err.message === 'SLOT_TAKEN') {
      res.status(409).json({
        success: false,
        error:   'Esse horário foi reservado por outra pessoa agora mesmo. Escolha outro horário.',
      });
      return;
    }
    if (err.message === 'SLOT_UNAVAILABLE') {
      res.status(400).json({
        success: false,
        error:   'Horário indisponível. Por favor, selecione outro horário.',
      });
      return;
    }
    // Erro inesperado — relança para o handler global
    throw err;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /public/cancel/:appointmentId/:token
// Cancela agendamento via link do e-mail (sem autenticação)
// ─────────────────────────────────────────────────────────────────────────────
publicRouter.get('/cancel/:appointmentId/:token', async (req: Request, res: Response): Promise<void> => {
  const { appointmentId, token } = req.params;

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      client:       { select: { name: true, email: true } },
      service:      { select: { name: true, price: true, durationMinutes: true } },
      professional: { select: { name: true } },
    },
  });

  if (!appointment) {
    res.status(404).json({ success: false, error: 'Agendamento não encontrado' });
    return;
  }

  // Valida o token de segurança
  const expectedToken = generateCancelToken(appointmentId, appointment.client.email);
  if (token !== expectedToken) {
    res.status(403).json({ success: false, error: 'Link de cancelamento inválido' });
    return;
  }

  // Só cancela se ainda estiver ativo
  if (appointment.status === 'CANCELLED') {
    res.json({ success: true, message: 'Agendamento já estava cancelado' });
    return;
  }

  if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
    res.status(422).json({ success: false, error: 'Esse agendamento não pode mais ser cancelado' });
    return;
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data:  { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Cancelado pelo cliente via link do e-mail' },
  });

  // Notifica o cliente sobre o cancelamento
  sendAppointmentCancelled({
    appointmentId,
    clientName:       appointment.client.name,
    clientEmail:      appointment.client.email,
    professionalName: appointment.professional.name,
    serviceName:      appointment.service.name,
    servicePrice:     appointment.service.price,
    startDateTime:    appointment.startDateTime,
    endDateTime:      appointment.endDateTime,
    cancelReason:     'Cancelado pelo cliente',
  });

  res.json({ success: true, message: 'Agendamento cancelado com sucesso' });
});

// ─── Utilitário: gera link do Google Agenda ──────────────────────────────────
function buildGoogleCalendarUrl(params: {
  title:       string;
  start:       Date;
  end:         Date;
  description: string;
}): string {
  // Formato exigido pelo Google: YYYYMMDDTHHmmssZ
  const fmt = (d: Date) => format(d, "yyyyMMdd'T'HHmmss");
  const base = 'https://calendar.google.com/calendar/render';
  const qs   = new URLSearchParams({
    action:  'TEMPLATE',
    text:    params.title,
    dates:   `${fmt(params.start)}/${fmt(params.end)}`,
    details: params.description,
  });
  return `${base}?${qs.toString()}`;
}
