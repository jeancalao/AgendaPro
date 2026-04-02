// Middleware de autenticação via Supabase JWT
import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { prisma } from '../lib/prisma';

export async function validateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Token não fornecido' });
    return;
  }

  const token = authHeader.slice(7); // remove "Bearer "

  // Valida o JWT com o Supabase
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
    return;
  }

  // Busca o profissional no banco pelo supabaseId
  const professional = await prisma.professional.findUnique({
    where: { supabaseId: data.user.id },
  });

  if (!professional) {
    res.status(401).json({ success: false, error: 'Profissional não encontrado' });
    return;
  }

  if (!professional.isActive) {
    res.status(403).json({ success: false, error: 'Conta desativada' });
    return;
  }

  req.user = professional;
  next();
}
