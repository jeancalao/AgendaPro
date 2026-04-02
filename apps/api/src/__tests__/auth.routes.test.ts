// Testes das rotas de autenticação
import request from 'supertest';
import express from 'express';
import { authRouter } from '../routes/auth.routes';

// Mock das dependências externas
jest.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser:    jest.fn(),
        generateLink:  jest.fn(),
        signOut:       jest.fn(),
      },
      signInWithPassword:       jest.fn(),
      resetPasswordForEmail:    jest.fn(),
    },
  },
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    professional: {
      findUnique:   jest.fn(),
      create:       jest.fn(),
    },
  },
}));

jest.mock('../middlewares/auth.middleware', () => ({
  validateToken: (_req: any, _res: any, next: any) => {
    _req.user = { id: 'prof-1', name: 'João', email: 'joao@test.com' };
    next();
  },
}));

import { supabaseAdmin } from '../lib/supabase';
import { prisma } from '../lib/prisma';

const mockCreateUser          = supabaseAdmin.auth.admin.createUser as jest.Mock;
const mockSignIn              = supabaseAdmin.auth.signInWithPassword as jest.Mock;
const mockFindUnique          = prisma.professional.findUnique as jest.Mock;
const mockCreate              = prisma.professional.create as jest.Mock;

// Monta app mínimo para testes
const app = express();
app.use(express.json());
app.use('/auth', authRouter);

describe('POST /auth/register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna 400 com dados inválidos (slug inválido)', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'João', email: 'joao@test.com', password: '123456', slug: 'João Silva!!',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('retorna 409 quando slug já existe', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existing' });
    const res = await request(app).post('/auth/register').send({
      name: 'João', email: 'joao@test.com', password: '123456', slug: 'joao-silva',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('slug');
  });

  it('retorna 409 quando e-mail já cadastrado no Supabase', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    });
    const res = await request(app).post('/auth/register').send({
      name: 'João', email: 'joao@test.com', password: '123456', slug: 'joao-silva',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('E-mail já cadastrado');
  });

  it('retorna 201 com profissional criado com sucesso', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({
      data:  { user: { id: 'uid-123' } },
      error: null,
    });
    mockCreate.mockResolvedValue({
      id: 'prof-1', name: 'João', email: 'joao@test.com', slug: 'joao-silva',
    });
    const res = await request(app).post('/auth/register').send({
      name: 'João Silva', email: 'joao@test.com', password: '123456', slug: 'joao-silva',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.professional.slug).toBe('joao-silva');
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna 401 com credenciais inválidas', async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
    const res = await request(app).post('/auth/login').send({
      email: 'x@x.com', password: 'errada',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('E-mail ou senha inválidos');
  });

  it('retorna 200 com token e profissional no login bem-sucedido', async () => {
    mockSignIn.mockResolvedValue({
      data: {
        user:    { id: 'uid-123' },
        session: { access_token: 'tok-abc', refresh_token: 'ref-xyz' },
      },
      error: null,
    });
    mockFindUnique.mockResolvedValue({
      id: 'prof-1', name: 'João', email: 'joao@test.com', isActive: true,
    });
    const res = await request(app).post('/auth/login').send({
      email: 'joao@test.com', password: '123456',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe('tok-abc');
    expect(res.body.data.professional.name).toBe('João');
  });
});

describe('GET /auth/me', () => {
  it('retorna dados do profissional logado', async () => {
    const res = await request(app).get('/auth/me')
      .set('Authorization', 'Bearer qualquer-token');
    expect(res.status).toBe(200);
    expect(res.body.data.professional.name).toBe('João');
  });
});

describe('POST /auth/forgot-password', () => {
  it('sempre retorna sucesso (sem revelar se e-mail existe)', async () => {
    (supabaseAdmin.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({});
    const res = await request(app).post('/auth/forgot-password')
      .send({ email: 'qualquer@email.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
