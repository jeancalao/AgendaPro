// Testes do middleware validateToken
import { Request, Response, NextFunction } from 'express';
import { validateToken } from '../middlewares/auth.middleware';

// Mock do supabaseAdmin
jest.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

// Mock do prisma
jest.mock('../lib/prisma', () => ({
  prisma: {
    professional: {
      findUnique: jest.fn(),
    },
  },
}));

import { supabaseAdmin } from '../lib/supabase';
import { prisma } from '../lib/prisma';

const mockSupabase = supabaseAdmin.auth.getUser as jest.Mock;
const mockPrisma   = prisma.professional.findUnique as jest.Mock;

// Fábrica de mocks do Express
function buildMocks() {
  const req  = { headers: {} } as Partial<Request>;
  const res  = {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  } as Partial<Response>;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe('validateToken middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna 401 quando Authorization header ausente', async () => {
    const { req, res, next } = buildMocks();
    await validateToken(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Token não fornecido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 quando Authorization não começa com Bearer', async () => {
    const { req, res, next } = buildMocks();
    req.headers = { authorization: 'Basic abc123' };
    await validateToken(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 quando Supabase retorna erro', async () => {
    const { req, res, next } = buildMocks();
    req.headers = { authorization: 'Bearer token-invalido' };
    mockSupabase.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
    await validateToken(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Token inválido ou expirado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 quando profissional não encontrado no banco', async () => {
    const { req, res, next } = buildMocks();
    req.headers = { authorization: 'Bearer token-valido' };
    mockSupabase.mockResolvedValue({ data: { user: { id: 'uid-123' } }, error: null });
    mockPrisma.mockResolvedValue(null);
    await validateToken(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Profissional não encontrado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 403 quando profissional está desativado', async () => {
    const { req, res, next } = buildMocks();
    req.headers = { authorization: 'Bearer token-valido' };
    mockSupabase.mockResolvedValue({ data: { user: { id: 'uid-123' } }, error: null });
    mockPrisma.mockResolvedValue({ id: 'prof-1', isActive: false });
    await validateToken(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('injeta req.user e chama next() com token válido', async () => {
    const { req, res, next } = buildMocks();
    req.headers = { authorization: 'Bearer token-valido' };
    const professional = { id: 'prof-1', name: 'João', isActive: true };
    mockSupabase.mockResolvedValue({ data: { user: { id: 'uid-123' } }, error: null });
    mockPrisma.mockResolvedValue(professional);
    await validateToken(req as Request, res as Response, next);
    expect((req as Request).user).toEqual(professional);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
