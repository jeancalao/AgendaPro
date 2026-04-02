// Rota de resumo do dashboard — protegida por autenticação
import { Router, Request, Response } from 'express';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { prisma }        from '../lib/prisma';
import { validateToken } from '../middlewares/auth.middleware';

export const dashboardRouter = Router();
dashboardRouter.use(validateToken);

// ── GET /dashboard/summary ────────────────────────────────────────────────────
// Retorna métricas do mês atual + próximos do dia + pendentes
dashboardRouter.get('/summary', async (req: Request, res: Response): Promise<void> => {
  const professionalId = req.user!.id;
  const now = new Date();

  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);
  const todayStart = startOfDay(now);
  const todayEnd   = endOfDay(now);

  // Busca tudo em paralelo para máxima performance
  const [monthAppointments, todayUpcoming, newClients, pendingTotal] = await Promise.all([
    // Todos os agendamentos do mês (com preço para calcular receita)
    prisma.appointment.findMany({
      where: {
        professionalId,
        startDateTime: { gte: monthStart, lte: monthEnd },
      },
      include: { service: { select: { price: true } } },
    }),
    // Agendamentos de hoje ainda não concluídos
    prisma.appointment.findMany({
      where: {
        professionalId,
        startDateTime: { gte: todayStart, lte: todayEnd },
        status:        { in: ['CONFIRMED', 'PENDING'] },
      },
      include: {
        client:  { select: { name: true } },
        service: { select: { name: true, color: true, durationMinutes: true } },
      },
      orderBy: { startDateTime: 'asc' },
    }),
    // Novos clientes no mês
    prisma.client.count({
      where: { professionalId, createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    // Agendamentos PENDING (badge de atenção no sidebar)
    prisma.appointment.count({
      where: { professionalId, status: 'PENDING' },
    }),
  ]);

  // Calcula métricas a partir dos dados do mês
  const completedAppointments  = monthAppointments.filter((a) => a.status === 'COMPLETED');
  const cancelledAppointments  = monthAppointments.filter((a) => a.status === 'CANCELLED');

  // Receita = soma dos preços dos agendamentos concluídos no mês
  const totalRevenue = completedAppointments.reduce(
    (sum, a) => sum + Number(a.service.price),
    0
  );

  res.json({
    success: true,
    data: {
      // Métricas mensais
      totalAppointments:     monthAppointments.length,
      completedAppointments: completedAppointments.length,
      cancelledAppointments: cancelledAppointments.length,
      totalRevenue,
      // Hoje
      upcomingToday: todayUpcoming.length,
      todayAppointments: todayUpcoming,
      // Clientes novos no mês
      newClients,
      // Para o badge de atenção na sidebar
      pendingTotal,
    },
  });
});
