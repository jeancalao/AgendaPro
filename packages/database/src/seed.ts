// Seed de dados de exemplo para desenvolvimento
import { PrismaClient, AppointmentStatus, DayOfWeek } from '@prisma/client';
import { addDays, addMinutes, setHours, setMinutes, setSeconds } from 'date-fns';

const prisma = new PrismaClient();

// Retorna uma data no futuro com hora/minuto específicos
function futureDate(daysFromNow: number, hour: number, minute: number): Date {
  const base = addDays(new Date(), daysFromNow);
  return setSeconds(setMinutes(setHours(base, hour), minute), 0);
}

async function main() {
  console.log('🌱 Iniciando seed...');

  // Limpa dados existentes (ordem respeitando FK)
  await prisma.appointment.deleteMany();
  await prisma.client.deleteMany();
  await prisma.blockedSlot.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.service.deleteMany();
  await prisma.professional.deleteMany();

  // ── Profissional ──────────────────────────────────────────────────────────
  const joao = await prisma.professional.create({
    data: {
      supabaseId: 'seed-supabase-id-joao',
      name: 'João Silva',
      email: 'joao.silva@agendapro.dev',
      phone: '(11) 99999-1234',
      slug: 'joao-silva',
      bio: 'Personal trainer certificado CREF com 8 anos de experiência. Especialista em hipertrofia e emagrecimento funcional.',
      timezone: 'America/Sao_Paulo',
      subscriptionPlan: 'PRO',
    },
  });
  console.log(`✅ Profissional criado: ${joao.name}`);

  // ── Serviços ──────────────────────────────────────────────────────────────
  const [avaliacaoFisica, treinoFuncional, consultoriaOnline] = await Promise.all([
    prisma.service.create({
      data: {
        professionalId: joao.id,
        name: 'Avaliação Física',
        description: 'Avaliação completa: composição corporal, força, flexibilidade e condicionamento cardiovascular.',
        durationMinutes: 60,
        price: 150.00,
        color: '#E74C3C',
      },
    }),
    prisma.service.create({
      data: {
        professionalId: joao.id,
        name: 'Treino Funcional',
        description: 'Sessão de treino funcional personalizado com foco em movimentos multiarticulares.',
        durationMinutes: 50,
        price: 120.00,
        color: '#2ECC71',
      },
    }),
    prisma.service.create({
      data: {
        professionalId: joao.id,
        name: 'Consultoria Online',
        description: 'Consultoria via videochamada: montagem de planilha de treino e orientações nutricionais básicas.',
        durationMinutes: 30,
        price: 80.00,
        color: '#3498DB',
      },
    }),
  ]);
  console.log('✅ Serviços criados: Avaliação Física, Treino Funcional, Consultoria Online');

  // ── Disponibilidade (segunda a sexta, 07:00–20:00) ────────────────────────
  const workDays: DayOfWeek[] = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
  ];

  await prisma.availability.createMany({
    data: workDays.map((day) => ({
      professionalId: joao.id,
      dayOfWeek: day,
      startTime: '07:00',
      endTime: '20:00',
    })),
  });
  console.log('✅ Disponibilidade criada: segunda a sexta, 07:00–20:00');

  // ── Clientes ──────────────────────────────────────────────────────────────
  const clientsData = [
    { name: 'Ana Beatriz Costa',   email: 'ana.costa@email.com',     phone: '(11) 98888-0001' },
    { name: 'Carlos Mendes',       email: 'carlos.mendes@email.com', phone: '(11) 98888-0002' },
    { name: 'Fernanda Oliveira',   email: 'fernanda.oli@email.com',  phone: '(11) 98888-0003' },
    { name: 'Ricardo Pereira',     email: 'ricardo.p@email.com',     phone: '(11) 98888-0004' },
    { name: 'Juliana Santos',      email: 'ju.santos@email.com',     phone: '(11) 98888-0005' },
  ];

  const createdClients = await Promise.all(
    clientsData.map((c) =>
      prisma.client.create({
        data: { ...c, professionalId: joao.id },
      })
    )
  );
  console.log(`✅ ${createdClients.length} clientes criados`);

  const [ana, carlos, fernanda, ricardo, juliana] = createdClients;

  // ── Agendamentos (10 nos próximos 30 dias, status variados) ───────────────
  const appointmentsData: Array<{
    clientId: string;
    serviceId: string;
    daysFromNow: number;
    hour: number;
    status: AppointmentStatus;
  }> = [
    { clientId: ana.id,      serviceId: treinoFuncional.id,   daysFromNow: 1,  hour: 8,  status: 'CONFIRMED' },
    { clientId: carlos.id,   serviceId: avaliacaoFisica.id,   daysFromNow: 2,  hour: 10, status: 'CONFIRMED' },
    { clientId: fernanda.id, serviceId: consultoriaOnline.id, daysFromNow: 3,  hour: 14, status: 'PENDING'   },
    { clientId: ricardo.id,  serviceId: treinoFuncional.id,   daysFromNow: 5,  hour: 7,  status: 'CONFIRMED' },
    { clientId: juliana.id,  serviceId: avaliacaoFisica.id,   daysFromNow: 7,  hour: 9,  status: 'PENDING'   },
    { clientId: ana.id,      serviceId: treinoFuncional.id,   daysFromNow: 8,  hour: 8,  status: 'CONFIRMED' },
    { clientId: carlos.id,   serviceId: consultoriaOnline.id, daysFromNow: 10, hour: 11, status: 'CONFIRMED' },
    { clientId: fernanda.id, serviceId: treinoFuncional.id,   daysFromNow: 14, hour: 15, status: 'PENDING'   },
    { clientId: ricardo.id,  serviceId: avaliacaoFisica.id,   daysFromNow: 20, hour: 16, status: 'CONFIRMED' },
    { clientId: juliana.id,  serviceId: treinoFuncional.id,   daysFromNow: 25, hour: 7,  status: 'PENDING'   },
  ];

  // Mapeia serviço → duração para calcular endDateTime
  const durationMap: Record<string, number> = {
    [avaliacaoFisica.id]:   avaliacaoFisica.durationMinutes,
    [treinoFuncional.id]:   treinoFuncional.durationMinutes,
    [consultoriaOnline.id]: consultoriaOnline.durationMinutes,
  };

  await Promise.all(
    appointmentsData.map(({ clientId, serviceId, daysFromNow, hour, status }) => {
      const startDateTime = futureDate(daysFromNow, hour, 0);
      const endDateTime   = addMinutes(startDateTime, durationMap[serviceId]);
      return prisma.appointment.create({
        data: {
          professionalId: joao.id,
          clientId,
          serviceId,
          startDateTime,
          endDateTime,
          status,
        },
      });
    })
  );
  console.log('✅ 10 agendamentos criados nos próximos 30 dias');

  console.log('\n🎉 Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
