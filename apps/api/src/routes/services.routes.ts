// Rotas de gerenciamento de serviços do profissional
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validateToken } from '../middlewares/auth.middleware';

export const servicesRouter = Router();

// Todas as rotas exigem autenticação
servicesRouter.use(validateToken);

// Schema de validação
const serviceSchema = z.object({
  name:           z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  description:    z.string().max(500).optional(),
  durationMinutes: z
    .number({ required_error: 'Duração obrigatória' })
    .min(15, 'Duração mínima: 15 min')
    .max(480, 'Duração máxima: 480 min')
    .refine((v) => v % 5 === 0, 'Duração deve ser múltiplo de 5'),
  price:  z.number().min(0).max(99999),
  color:  z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um hex válido, ex: #2E75B6'),
  isActive: z.boolean().optional(),
});

// ── GET /services ────────────────────────────────────────────────────────────
servicesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const services = await prisma.service.findMany({
    where:   { professionalId: req.user!.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: services });
});

// ── POST /services ───────────────────────────────────────────────────────────
servicesRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const service = await prisma.service.create({
    data: { ...parsed.data, professionalId: req.user!.id },
  });
  res.status(201).json({ success: true, data: service });
});

// ── PUT /services/:id ─────────────────────────────────────────────────────────
servicesRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  // Verifica propriedade
  const existing = await prisma.service.findFirst({
    where: { id: req.params.id, professionalId: req.user!.id },
  });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Serviço não encontrado' });
    return;
  }

  const service = await prisma.service.update({
    where: { id: req.params.id },
    data:  parsed.data,
  });
  res.json({ success: true, data: service });
});

// ── DELETE /services/:id (soft delete) ───────────────────────────────────────
servicesRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const existing = await prisma.service.findFirst({
    where: { id: req.params.id, professionalId: req.user!.id },
  });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Serviço não encontrado' });
    return;
  }

  await prisma.service.update({
    where: { id: req.params.id },
    data:  { isActive: false },
  });
  res.json({ success: true, message: 'Serviço desativado' });
});

// ── PATCH /services/:id/toggle ────────────────────────────────────────────────
servicesRouter.patch('/:id/toggle', async (req: Request, res: Response): Promise<void> => {
  const existing = await prisma.service.findFirst({
    where: { id: req.params.id, professionalId: req.user!.id },
  });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Serviço não encontrado' });
    return;
  }

  const service = await prisma.service.update({
    where: { id: req.params.id },
    data:  { isActive: !existing.isActive },
  });
  res.json({ success: true, data: service });
});
