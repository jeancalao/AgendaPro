// Rotas de autenticação do AgendaPRO
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { prisma } from '../lib/prisma';
import { validateToken } from '../middlewares/auth.middleware';
import { sendWelcomeProfessional } from '../services/email.service';

export const authRouter = Router();

// Schema de validação do registro
const registerSchema = z.object({
  name:     z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  phone:    z.string().optional(),
  slug:     z
    .string()
    .min(3, 'Slug deve ter ao menos 3 caracteres')
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
});

const loginSchema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

// ──────────────────────────────────────────
// POST /auth/register
// ──────────────────────────────────────────
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { name, email, password, phone, slug } = parsed.data;

  // Verifica slug duplicado
  const slugExists = await prisma.professional.findUnique({ where: { slug } });
  if (slugExists) {
    res.status(409).json({ success: false, error: `O slug "${slug}" já está em uso. Escolha outro.` });
    return;
  }

  // Cria usuário no Supabase Auth via signUp (funciona com anon key)
  const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
    email,
    password,
  });

  if (authError) {
    if (authError.message.toLowerCase().includes('already')) {
      res.status(409).json({ success: false, error: 'E-mail já cadastrado' });
      return;
    }
    res.status(400).json({ success: false, error: authError.message });
    return;
  }

  if (!authData.user) {
    res.status(400).json({ success: false, error: 'Erro ao criar usuário no Supabase' });
    return;
  }

  // Cria o profissional no banco
  const professional = await prisma.professional.create({
    data: {
      supabaseId: authData.user.id,
      name,
      email,
      phone,
      slug,
    },
    select: {
      id: true, name: true, email: true, phone: true,
      slug: true, bio: true, avatarUrl: true,
      timezone: true, subscriptionPlan: true, createdAt: true,
    },
  });

  // Envia e-mail de boas-vindas
  sendWelcomeProfessional({
    professionalName:  professional.name,
    professionalEmail: professional.email,
    slug:              professional.slug,
  });

  // Retorna o profissional criado (o frontend faz login após o registro)
  res.status(201).json({ success: true, data: { professional } });
});

// ──────────────────────────────────────────
// POST /auth/login
// ──────────────────────────────────────────
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    return;
  }

  const { email, password } = parsed.data;

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Loga o erro real no terminal da API para diagnóstico
    console.error('[LOGIN ERROR]', error?.message);

    // Mensagem específica para e-mail não confirmado
    if (error?.message?.includes('Email not confirmed')) {
      res.status(401).json({
        success: false,
        error: 'E-mail não confirmado. No Supabase, vá em Authentication → Providers → Email e desative "Confirm email".',
      });
      return;
    }

    res.status(401).json({ success: false, error: 'E-mail ou senha inválidos' });
    return;
  }

  const professional = await prisma.professional.findUnique({
    where: { supabaseId: data.user.id },
    select: {
      id: true, name: true, email: true, phone: true,
      slug: true, bio: true, avatarUrl: true,
      timezone: true, subscriptionPlan: true, isActive: true,
    },
  });

  if (!professional || !professional.isActive) {
    res.status(401).json({ success: false, error: 'Conta não encontrada ou desativada' });
    return;
  }

  res.json({
    success: true,
    data: {
      professional,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
  });
});

// ──────────────────────────────────────────
// GET /auth/me  (protegida)
// ──────────────────────────────────────────
authRouter.get('/me', validateToken, async (req: Request, res: Response): Promise<void> => {
  res.json({ success: true, data: { professional: req.user } });
});

// ──────────────────────────────────────────
// POST /auth/logout  (protegida)
// ──────────────────────────────────────────
authRouter.post('/logout', validateToken, async (req: Request, res: Response): Promise<void> => {
  await supabaseAdmin.auth.signOut();
  res.json({ success: true, message: 'Logout realizado com sucesso' });
});

// ──────────────────────────────────────────
// POST /auth/forgot-password
// ──────────────────────────────────────────
authRouter.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ success: false, error: 'E-mail obrigatório' });
    return;
  }

  // Sempre retorna sucesso por segurança (não revela se e-mail existe)
  await supabaseAdmin.auth.resetPasswordForEmail(email);

  res.json({ success: true, message: 'Se o e-mail estiver cadastrado, você receberá as instruções.' });
});
