// Rotas de clientes — protegidas por autenticação
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma }        from '../lib/prisma';
import { validateToken } from '../middlewares/auth.middleware';

export const clientsRouter = Router();
clientsRouter.use(validateToken);

// ── Helpers ────────────────────────────────────────────────────────────────────
const CLIENT_BASE_SELECT = {
  id:        true,
  name:      true,
  email:     true,
  phone:     true,
  notes:     true,
  isActive:  true,
  createdAt: true,
  updatedAt: true,
};

// ── GET /clients ───────────────────────────────────────────────────────────────
// Lista paginada com busca por nome/email/telefone + contadores
clientsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const { q, page = '1', limit = '20' } = req.query;
  const pageNum  = Math.max(1, parseInt(page  as string, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const professionalId = req.user!.id;

  const where = {
    professionalId,
    isActive: true,
    ...(q ? {
      OR: [
        { name:  { contains: q as string, mode: 'insensitive' as const } },
        { email: { contains: q as string, mode: 'insensitive' as const } },
        { phone: { contains: q as string, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      select: {
        ...CLIENT_BASE_SELECT,
        _count: {
          select: { appointments: true },
        },
        appointments: {
          orderBy: { startDateTime: 'desc' },
          take: 1,
          select: {
            startDateTime: true,
            status:        true,
            service:       { select: { name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
      skip,
      take: limitNum,
    }),
    prisma.client.count({ where }),
  ]);

  // Achata totalAppointments e lastAppointment na resposta
  const data = clients.map((c) => ({
    id:                c.id,
    name:              c.name,
    email:             c.email,
    phone:             c.phone,
    notes:             c.notes,
    createdAt:         c.createdAt,
    totalAppointments: c._count.appointments,
    lastAppointment:   c.appointments[0] ?? null,
  }));

  res.json({
    success: true,
    data,
    meta: { total, page: pageNum, totalPages: Math.ceil(total / limitNum) },
  });
});

// ── GET /clients/:id ───────────────────────────────────────────────────────────
// Perfil completo + histórico + estatísticas
clientsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const professionalId = req.user!.id;
  const { id } = req.params;

  const client = await prisma.client.findFirst({
    where: { id, professionalId, isActive: true },
    select: {
      ...CLIENT_BASE_SELECT,
      appointments: {
        orderBy: { startDateTime: 'desc' },
        take: 50,
        select: {
          id:            true,
          startDateTime: true,
          endDateTime:   true,
          status:        true,
          notes:         true,
          cancelReason:  true,
          service:       {
            select: { id: true, name: true, price: true, color: true, durationMinutes: true },
          },
        },
      },
    },
  });

  if (!client) {
    res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    return;
  }

  // Estatísticas sobre todos os agendamentos (não só os últimos 50)
  const [allStats] = await prisma.$queryRaw<
    { total: bigint; completed: bigint; cancelled: bigint; no_show: bigint; revenue: string | null }[]
  >`
    SELECT
      COUNT(*)                                               AS total,
      COUNT(*) FILTER (WHERE a.status = 'COMPLETED')         AS completed,
      COUNT(*) FILTER (WHERE a.status = 'CANCELLED')         AS cancelled,
      COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')           AS no_show,
      SUM(s.price) FILTER (WHERE a.status = 'COMPLETED')    AS revenue
    FROM appointments a
    JOIN services s ON s.id = a."serviceId"
    WHERE a."clientId"       = ${id}
      AND a."professionalId" = ${professionalId}
  `;

  const total     = Number(allStats.total);
  const completed = Number(allStats.completed);
  const cancelled = Number(allStats.cancelled);
  const noShow    = Number(allStats.no_show);

  const stats = {
    totalSessions:     total,
    completedSessions: completed,
    cancelledSessions: cancelled,
    noShowSessions:    noShow,
    attendanceRate:    total > 0 ? Math.round((completed / total) * 100) : 0,
    cancellationRate:  total > 0 ? Math.round(((cancelled + noShow) / total) * 100) : 0,
    totalRevenue:      Number(allStats.revenue ?? 0),
  };

  res.json({
    success: true,
    data: {
      id:           client.id,
      name:         client.name,
      email:        client.email,
      phone:        client.phone,
      notes:        client.notes,
      createdAt:    client.createdAt,
      appointments: client.appointments,
      stats,
    },
  });
});

// ── POST /clients ──────────────────────────────────────────────────────────────
const createSchema = z.object({
  name:  z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

clientsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { name, email, phone, notes } = parsed.data;
  const professionalId = req.user!.id;

  // Verifica duplicata — reativa se estiver soft-deletado
  const existing = await prisma.client.findUnique({
    where: { professionalId_email: { professionalId, email } },
  });

  if (existing) {
    if (!existing.isActive) {
      const reactivated = await prisma.client.update({
        where: { id: existing.id },
        data:  { name, phone, notes, isActive: true },
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      });
      res.status(201).json({ success: true, data: reactivated });
      return;
    }
    res.status(409).json({ success: false, error: 'Cliente com esse e-mail já existe' });
    return;
  }

  const client = await prisma.client.create({
    data:   { professionalId, name, email, phone, notes },
    select: { id: true, name: true, email: true, phone: true, createdAt: true },
  });

  res.status(201).json({ success: true, data: client });
});

// ── PUT /clients/:id ───────────────────────────────────────────────────────────
const updateSchema = z.object({
  name:  z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

clientsRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const professionalId = req.user!.id;
  const { id } = req.params;

  const existing = await prisma.client.findFirst({
    where: { id, professionalId, isActive: true },
  });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    return;
  }

  // Verifica conflito de email se mudou
  if (parsed.data.email && parsed.data.email !== existing.email) {
    const conflict = await prisma.client.findUnique({
      where: { professionalId_email: { professionalId, email: parsed.data.email } },
    });
    if (conflict) {
      res.status(409).json({ success: false, error: 'Já existe um cliente com esse e-mail' });
      return;
    }
  }

  const updated = await prisma.client.update({
    where: { id },
    data:  parsed.data,
    select: CLIENT_BASE_SELECT,
  });

  res.json({ success: true, data: updated });
});

// ── DELETE /clients/:id ────────────────────────────────────────────────────────
// Soft delete — verifica agendamentos futuros ativos antes de excluir
clientsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const professionalId = req.user!.id;
  const { id } = req.params;

  const client = await prisma.client.findFirst({
    where: { id, professionalId, isActive: true },
  });
  if (!client) {
    res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    return;
  }

  const futureCount = await prisma.appointment.count({
    where: {
      clientId:      id,
      professionalId,
      startDateTime: { gt: new Date() },
      status:        { in: ['PENDING', 'CONFIRMED'] },
    },
  });

  if (futureCount > 0) {
    res.status(409).json({
      success: false,
      error:   `Este cliente possui ${futureCount} agendamento(s) futuro(s). Cancele-os antes de excluir.`,
    });
    return;
  }

  await prisma.client.update({
    where: { id },
    data:  { isActive: false },
  });

  res.json({ success: true, message: 'Cliente removido com sucesso' });
});
