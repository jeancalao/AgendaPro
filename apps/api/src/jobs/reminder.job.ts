// Job de lembretes — executa a cada hora
// Envia e-mail para agendamentos que ocorrem entre 23h e 25h no futuro
// e que ainda não receberam lembrete (reminderSentAt === null)
import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendAppointmentReminder } from '../services/email.service';

export function startReminderJob(): void {
  // Executa no início de cada hora: "0 * * * *"
  cron.schedule('0 * * * *', async () => {
    const now     = new Date();
    const from    = new Date(now.getTime() + 23 * 60 * 60 * 1000); // +23h
    const until   = new Date(now.getTime() + 25 * 60 * 60 * 1000); // +25h

    try {
      const appointments = await prisma.appointment.findMany({
        where: {
          status:         { in: ['CONFIRMED', 'PENDING'] },
          reminderSentAt: null,
          startDateTime:  { gte: from, lte: until },
        },
        include: {
          client:       { select: { name: true, email: true } },
          service:      { select: { name: true, price: true, durationMinutes: true } },
          professional: { select: { name: true } },
        },
      });

      if (appointments.length === 0) return;

      console.log(`[REMINDER JOB] ${appointments.length} lembrete(s) a enviar`);

      await Promise.all(
        appointments.map(async (appt) => {
          await sendAppointmentReminder({
            appointmentId:    appt.id,
            clientName:       appt.client.name,
            clientEmail:      appt.client.email,
            professionalName: appt.professional.name,
            serviceName:      appt.service.name,
            servicePrice:     appt.service.price,
            startDateTime:    appt.startDateTime,
            endDateTime:      appt.endDateTime,
          });

          await prisma.appointment.update({
            where: { id: appt.id },
            data:  { reminderSentAt: new Date() },
          });
        }),
      );

      console.log(`[REMINDER JOB] ${appointments.length} lembrete(s) enviado(s)`);
    } catch (err) {
      console.error('[REMINDER JOB ERROR]', err);
    }
  });

  console.log('[REMINDER JOB] Iniciado — executa a cada hora');
}
