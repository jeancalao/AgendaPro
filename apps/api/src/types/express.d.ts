// Em arquivo .d.ts ambient (sem import/export no topo),
// declare namespace Express augmenta diretamente o namespace global do Express
declare namespace Express {
  interface Request {
    user?: import('@prisma/client').Professional;
  }
}
