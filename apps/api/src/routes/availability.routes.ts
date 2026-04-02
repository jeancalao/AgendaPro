// Rotas de disponibilidade e cálculo de slots
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DayOfWeek } from '@agendapro/database';
import { prisma } from '../lib/prisma';
import { validateToken } from '../middlewares/auth.middleware';
import { computeAvailableSlots } from '../lib/slots';

export const availabilityRouter = Router();

availabilityRouter.use(validateToken);

const availabilitySchema = z.array(
  z.object({
    dayOfWeek: z.nativeEnum(DayOfWeek),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido. Use HH:mm'),
    endTime:   z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido. Use HH:mm'),
    isActive:  z.boolean(),
  })
);

// ── GET /availability ─────────────────────────────────────────────────────────
availabilityRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const availabilities = await prisma.availability.findMany({
    where:   { professionalId: req.user!.id },
    orderBy: { dayOfWeek: 'asc' },
  });
  res.json({ success: true, data: availabilities });
});

// ── PUT /availability ─────────────────────────────────────────────────────────
// Salva a semana inteira: deleta os existentes e recria (upsert completo)
availabilityRouter.put('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = availabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const professionalId = req.user!.id;

  // Valida que startTime < endTime em cada entrada
  for (const entry of parsed.data) {
    if (entry.startTime >= entry.endTime) {
      res.status(400).json({
        success: false,
        error: `${entry.dayOfWeek}: horário de início deve ser anterior ao horário de fim`,
      });
      return;
    }
  }

  // Substitui toda a disponibilidade em uma transação
  const [, availabilities] = await prisma.$transaction([
    prisma.availability.deleteMany({ where: { professionalId } }),
    prisma.availability.createMany({
      data: parsed.data.map((d) => ({ ...d, professionalId })),
    }),
  ]);

  res.json({ success: true, data: availabilities });
});

// ── GET /availability/slots ───────────────────────────────────────────────────
// Query: serviceId, date (YYYY-MM-DD)
availabilityRouter.get('/slots', async (req: Request, res: Response): Promise<void> => {
  const { serviceId, date: dateStr } = req.query;

  if (!serviceId || !dateStr) {
    res.status(400).json({ success: false, error: 'Parâmetros serviceId e date são obrigatórios' });
    return;
  }

  // Valida formato YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr as string)) {
    res.status(400).json({ success: false, error: 'Formato de data inválido. Use YYYY-MM-DD' });
    return;
  }

  const date = new Date(`${dateStr}T00:00:00`);
  if (isNaN(date.getTime())) {
    res.status(400).json({ success: false, error: 'Data inválida' });
    return;
  }

  // Verifica se o serviço pertence ao profissional
  const service = await prisma.service.findFirst({
    where: { id: serviceId as string, professionalId: req.user!.id, isActive: true },
  });
  if (!service) {
    res.status(404).json({ success: false, error: 'Serviço não encontrado' });
    return;
  }

  const professionalId = req.user!.id;

  // Busca disponibilidade, agendamentos do dia e slots bloqueados em paralelo
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  const [availabilities, appointments, blockedSlots] = await Promise.all([
    prisma.availability.findMany({ where: { professionalId } }),
    prisma.appointment.findMany({
      where: {
        professionalId,
        startDateTime: { gte: dayStart },
        endDateTime:   { lte: dayEnd },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    }),
    prisma.blockedSlot.findMany({
      where: {
        professionalId,
        startDateTime: { lt: dayEnd },
        endDateTime:   { gt: dayStart },
      },
    }),
  ]);

  const slots = computeAvailableSlots({
    date,
    durationMin: service.durationMinutes,
    availabilities,
    appointments,
    blockedSlots,
  });

  res.json({ success: true, data: slots });
});
