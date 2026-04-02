/// <reference path="./types/express.d.ts" />
// Ponto de entrada do servidor Express
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter }         from './routes/auth.routes';
import { servicesRouter }     from './routes/services.routes';
import { availabilityRouter } from './routes/availability.routes';
import { publicRouter }       from './routes/public.routes';
import { appointmentsRouter } from './routes/appointments.routes';
import { dashboardRouter }    from './routes/dashboard.routes';
import { clientsRouter }      from './routes/clients.routes';
import { startReminderJob }  from './jobs/reminder.job';

const app = express();
const PORT = process.env.PORT || 3001;

// Origens permitidas: variável de ambiente + localhost + IP local para testes no celular
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  /^http:\/\/192\.168\.\d+\.\d+:5173$/,  // qualquer IP 192.168.x.x na porta 5173
  /^http:\/\/10\.\d+\.\d+\.\d+:5173$/,   // IPs 10.x.x.x (redes corporativas)
];

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Sem origin = requisição direta (curl, Postman, servidor) → permite
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    callback(allowed ? null : new Error('CORS: origem não permitida'), allowed);
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rotas protegidas (requerem autenticação)
app.use('/api/v1/auth',         authRouter);
app.use('/api/v1/services',     servicesRouter);
app.use('/api/v1/availability', availabilityRouter);
app.use('/api/v1/appointments', appointmentsRouter);
app.use('/api/v1/dashboard',    dashboardRouter);
app.use('/api/v1/clients',      clientsRouter);

// Rotas públicas — sem autenticação (página de agendamento do cliente)
app.use('/api/v1/public', publicRouter);

// Middleware de erro global
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
  startReminderJob();
});

export default app;
